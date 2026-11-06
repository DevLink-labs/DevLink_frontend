const { dialog, ipcMain, shell } = require("electron");
const { randomUUID } = require("node:crypto");
const { realpath, stat } = require("node:fs/promises");
const path = require("node:path");
const { checkSession, detectTools, loadDevelopmentPaths, runSetup, runStatus } = require("./setup-runner");

function samePath(actual, expected) {
  if (typeof actual !== "string" || !path.isAbsolute(actual)) return false;
  const normalize = (value) => process.platform === "win32"
    ? path.toNamespacedPath(path.resolve(value)).toLowerCase()
    : path.resolve(value);
  return normalize(actual) === normalize(expected);
}

function matchesProject(data, selection) {
  return data?.connection?.setupReady === true
    && data.userId === selection.userId && data.teamId === selection.teamId
    && data.toolType === (selection.tool === "claude-code" ? "claude_code" : "codex")
    && samePath(data.projectPath, selection.project);
}

function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function registerSetupHandlers(window, webOrigin) {
  let selection;
  let busy = false;
  let documentVersion = 0;

  function handle(name, action) {
    ipcMain.handle(`devlink:${name}`, (event, ...args) => {
      const frame = event.senderFrame;
      if (event.sender !== window.webContents || !frame || frame.parent || frame.origin !== webOrigin) {
        throw new Error("허용되지 않은 데스크톱 요청입니다.");
      }
      return action(frame, ...args);
    });
  }

  async function exclusive(action) {
    if (busy) throw new Error("이 PC 연결 작업이 진행 중입니다.");
    busy = true;
    try {
      return await action();
    } finally {
      busy = false;
    }
  }

  function requireSelection(id) {
    if (!selection || selection.id !== id) throw new Error("프로젝트 폴더를 다시 선택해주세요.");
    return selection;
  }

  window.webContents.on("did-start-navigation", (event) => {
    if (event.isMainFrame && !event.isSameDocument) {
      documentVersion++;
      selection = undefined;
    }
  });
  window.on("close", (event) => { if (busy) event.preventDefault(); });

  handle("status", () => runStatus());
  handle("pickFolder", (frame, account) => exclusive(async () => {
    if (!validId(account?.userId) || !validId(account?.teamId) || typeof account?.email !== "string"
      || !/^[^\s@]+@[^\s@]+$/.test(account.email) || account.email.length > 255) {
      throw new Error("현재 로그인 계정과 팀을 확인해주세요.");
    }

    selection = undefined;
    const version = documentVersion;
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: "연결할 프로젝트 폴더 선택",
      properties: ["openDirectory"],
    });
    if (canceled || !filePaths[0] || frame.detached) return null;

    const project = await realpath(filePaths[0]);
    const name = path.basename(project).trim();
    if (!name || name.length > 100 || !(await stat(project)).isDirectory()) {
      throw new Error("이름이 1~100자인 프로젝트 폴더를 선택해주세요.");
    }
    const tools = await detectTools(await loadDevelopmentPaths());
    if (version !== documentVersion) return null;

    selection = {
      id: randomUUID(), project, name, tools,
      userId: String(account.userId), teamId: String(account.teamId), email: account.email,
    };
    return { id: selection.id, name, tools };
  }));

  handle("setup", (frame, id, tool, password) => exclusive(async () => {
    const current = requireSelection(id);
    if (!current.tools.includes(tool) || (current.tool && current.tool !== tool)) {
      throw new Error("감지된 AI 도구를 선택해주세요. 도구를 바꾸려면 폴더를 다시 선택해주세요.");
    }
    if (password !== undefined && (!current.needsPassword || typeof password !== "string" || !password
      || /[\r\n\0]/.test(password) || Buffer.byteLength(password, "utf8") > 72)) {
      throw new Error("비밀번호를 확인해주세요. 비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.");
    }

    current.tool = tool;
    current.targetPath = tool === "claude-code"
      ? path.join(current.project, ".mcp.json")
      : path.join(current.project, ".codex", "config.toml");
    const paths = await loadDevelopmentPaths();
    if (password === undefined) {
      const session = await checkSession(paths);
      if (!session || ["logged_out", "expired"].includes(session.state)) {
        current.needsPassword = true;
        return { state: "password" };
      }
      if (session.authenticated !== true || String(session.user?.userId) !== current.userId) {
        return { state: "error", message: "CLI 테스트 프로필의 계정과 현재 로그인 계정이 일치하는지 확인해주세요." };
      }
    }

    current.manualConfig = undefined;
    current.needsPassword = false;
    const input = {
      schemaVersion: 1,
      serverUrl: paths.serverUrl,
      user: password === undefined ? { mode: "session" } : { mode: "login", email: current.email },
      team: { id: current.teamId },
      project: { path: current.project, name: current.name },
      tool: { type: tool },
      agent: { action: "create", name: current.name },
      mcp: { mode: "apply", targetPath: current.targetPath },
    };
    const result = await runSetup(paths, input, password, (progress) => {
      if (selection !== current || frame.detached || frame.origin !== webOrigin) return;
      try { frame.send("devlink:setup-event", progress); } catch { /* 화면이 닫힌 경우 진행 이벤트 생략 */ }
    });

    if (result.exitCode === 0) {
      const status = await runStatus(paths);
      if (status.exitCode === 0 && matchesProject(status.result.data, current)) return { state: "done" };
      return { state: "error", message: "설정은 적용됐지만 연결 상태를 확인하지 못했습니다. 잠시 후 같은 폴더로 다시 확인해주세요." };
    }

    const error = result.error;
    if (error?.step === "authenticate" && ["SETUP_AUTH_REQUIRED", "SETUP_AUTH_REJECTED"].includes(error.code)) {
      current.needsPassword = true;
      return { state: "password", message: error.code === "SETUP_AUTH_REJECTED" ? "비밀번호를 다시 확인해주세요." : undefined };
    }

    const manual = error?.manualConfig;
    if (error?.code === "SETUP_MANUAL_ACTION_REQUIRED" && samePath(manual?.suggestedTargetPath, current.targetPath)
      && typeof manual.snippet === "string") {
      current.manualConfig = { config: paths.config, serverUrl: paths.serverUrl };
      return { state: "manual", targetPath: current.targetPath, snippet: manual.snippet };
    }

    return { state: "error", code: error?.code, message: error?.message ?? "프로젝트를 연결하지 못했습니다." };
  }));

  handle("checkSetup", (_frame, id) => exclusive(async () => {
    const current = requireSelection(id);
    const paths = await loadDevelopmentPaths();
    if (!current.manualConfig || !samePath(paths.config, current.manualConfig.config)
      || paths.serverUrl !== current.manualConfig.serverUrl) {
      throw new Error("같은 테스트 프로필로 연결을 다시 시작해주세요.");
    }
    const { exitCode, result } = await runStatus(paths);
    return exitCode === 0 && matchesProject(result.data, current);
  }));

  handle("openConfigFolder", async (_frame, id) => {
    const current = requireSelection(id);
    if (!current.manualConfig) throw new Error("AI 도구 설정 위치를 확인해주세요.");
    const configDirectory = path.dirname(current.targetPath);
    const resolved = await realpath(configDirectory).catch(() => null);
    const directory = resolved && samePath(resolved, configDirectory) ? resolved : current.project;
    if (await shell.openPath(directory)) throw new Error("설정 폴더를 열지 못했습니다.");
  });
}

module.exports = { registerSetupHandlers };
