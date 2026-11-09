const { dialog, ipcMain, shell } = require("electron");
const { createHash, randomUUID } = require("node:crypto");
const { lstat, readFile, realpath, stat } = require("node:fs/promises");
const path = require("node:path");
const {
  checkSession,
  detectTools,
  loadDevelopmentPaths,
  runSetup,
  runStatus,
  runGuide,
} = require("./setup-runner");
const {
  listTeamProfiles,
  prepareAccountProfile,
  readSavedBinding,
  resolveProjectPaths,
} = require("./setup-profiles");

const notReady = {
  exitCode: 0,
  result: { data: { connection: { setupReady: false } } },
};

function samePath(actual, expected) {
  if (typeof actual !== "string" || !path.isAbsolute(actual)) return false;
  const normalize = (value) =>
    process.platform === "win32"
      ? path.toNamespacedPath(path.resolve(value)).toLowerCase()
      : path.resolve(value);
  return normalize(actual) === normalize(expected);
}

function matchesProject(data, selection) {
  return (
    data?.connection?.setupReady === true &&
    data.userId === selection.userId &&
    data.teamId === selection.teamId &&
    data.toolType ===
      (selection.tool === "claude-code" ? "claude_code" : "codex") &&
    samePath(data.projectPath, selection.project)
  );
}

function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateAccount(account) {
  if (
    !validId(account?.userId) ||
    !validId(account?.teamId) ||
    typeof account?.email !== "string" ||
    !/^[^\s@]+@[^\s@]+$/.test(account.email) ||
    account.email.length > 255
  ) {
    throw new Error("현재 로그인 계정과 팀을 확인해주세요.");
  }
}

function agentMetadata(value = {}) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !["part", "roles"].includes(key))
  ) {
    throw new Error("담당 파트와 역할 태그를 확인해주세요.");
  }
  const part = value.part === undefined ? "OTHER" : value.part;
  const roles = value.roles === undefined ? [] : value.roles;
  if (
    !["FRONTEND", "BACKEND", "INFRA", "OTHER"].includes(part) ||
    !Array.isArray(roles) ||
    roles.length > 10 ||
    roles.some(
      (role) =>
        typeof role !== "string" ||
        role.length > 64 ||
        /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]*$/.test(
          role,
        ),
    )
  ) {
    throw new Error(
      "담당 파트 또는 역할 태그가 올바르지 않습니다. 태그는 64자 이내로 최대 10개 입력해주세요.",
    );
  }
  return {
    ...(value.part === undefined ? {} : { part }),
    ...(value.roles === undefined
      ? {}
      : {
          roles: [
            ...new Set(
              roles.map((role) =>
                role.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, ""),
              ),
            ),
          ],
        }),
  };
}

function registerSetupHandlers(
  window,
  webOrigin,
  loadPaths = loadDevelopmentPaths,
) {
  let selection;
  let busy = false;
  let documentVersion = 0;
  let accountKey;
  const connections = new Map();
  // 같은 프로젝트의 동시 안내 조회는 진행 중인 결과를 공유
  const guideRequests = new Map();

  function reset() {
    documentVersion++;
    selection = undefined;
    connections.clear();
    guideRequests.clear();
  }

  function useAccount(account) {
    validateAccount(account);
    const key = `${account.userId}:${account.teamId}:${account.email}`;
    if (accountKey !== key) reset();
    accountKey = key;
  }

  function assertCurrent(current, version = documentVersion) {
    if (
      version !== documentVersion ||
      (selection !== current && connections.get(current.id) !== current)
    ) {
      throw new Error(
        "계정이나 화면이 변경됐습니다. 프로젝트 설정을 다시 선택해주세요.",
      );
    }
  }

  async function fingerprint(paths) {
    const parts = [];
    for (const name of [
      "agent-profile.json",
      "user-session.json",
      "selected-team.json",
      "selected-tool.json",
      "broker.json",
    ]) {
      const file = path.join(
        path.dirname(paths.config),
        ".devlink-runtime",
        name,
      );
      const info = await lstat(file).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw new Error("연결 프로필을 다시 확인해주세요.");
      });
      if (
        info &&
        (!info.isFile() || info.isSymbolicLink() || info.size > 16_384)
      ) {
        throw new Error("연결 프로필을 다시 확인해주세요.");
      }
      const bytes = await readFile(file).catch((error) => {
        if (error.code === "ENOENT") return Buffer.alloc(0);
        throw new Error("연결 프로필을 다시 확인해주세요.");
      });
      parts.push(createHash("sha256").update(bytes).digest("hex"));
    }
    for (const file of [paths.config, paths.cli, paths.node, paths.entry]) {
      const info = await stat(file).catch(() => null);
      parts.push(
        info ? [await realpath(file), info.size, info.mtimeMs, info.ino] : null,
      );
    }
    return JSON.stringify([paths.serverUrl, ...parts]);
  }

  function matchesGuide(data, current) {
    return (
      data &&
      data.userId === current.userId &&
      data.teamId === current.teamId &&
      /^\d+$/.test(data.agentId) &&
      data.agentId !== "0" &&
      (!current.agentId || current.agentId === data.agentId) &&
      data.toolType ===
        (current.tool === "claude-code" ? "claude_code" : "codex") &&
      samePath(data.projectPath, current.project) &&
      samePath(data.targetPath, current.targetPath)
    );
  }

  async function readGuide(current) {
    const version = documentVersion;
    const paths = await resolveProjectPaths(
      await loadPaths(),
      current,
      current.project,
    );
    if (
      !samePath(paths.config, current.paths.config) ||
      paths.serverUrl !== current.paths.serverUrl
    ) {
      throw new Error(
        "서버 또는 연결 프로필이 변경됐습니다. 프로젝트 설정을 다시 선택해주세요.",
      );
    }
    const before = await fingerprint(paths);
    if (current.fingerprint && before !== current.fingerprint) {
      throw new Error(
        "연결 프로필이나 실행 파일이 변경됐습니다. 프로젝트 설정을 다시 선택해주세요.",
      );
    }
    const result = await runGuide(paths);
    assertCurrent(current, version);
    const data = result.result?.data;
    if (
      result.exitCode !== 0 ||
      !matchesGuide(data, current) ||
      before !== (await fingerprint(paths))
    ) {
      throw new Error(
        "이 계정의 프로젝트 설정을 확인하지 못했습니다. 연결 프로필과 로그인 상태를 확인해주세요.",
      );
    }
    assertCurrent(current, version);
    current.agentId = data.agentId;
    current.fingerprint = before;
    current.manualConfig = { config: paths.config, serverUrl: paths.serverUrl };
    return data;
  }

  function handle(name, action) {
    ipcMain.handle(`devlink:${name}`, (event, ...args) => {
      const frame = event.senderFrame;
      if (
        event.sender !== window.webContents ||
        !frame ||
        frame.parent ||
        frame.origin !== webOrigin
      ) {
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
    const current = selection?.id === id ? selection : connections.get(id);
    if (!current) throw new Error("프로젝트 폴더를 다시 선택해주세요.");
    return current;
  }

  window.webContents.on("did-start-navigation", (event) => {
    if (event.isMainFrame && !event.isSameDocument) {
      reset();
    }
  });
  window.on("close", (event) => {
    if (busy) event.preventDefault();
  });

  handle("resetSetupContext", () => {
    reset();
    accountKey = undefined;
  });

  handle("listConnections", (_frame, account) =>
    exclusive(async () => {
      useAccount(account);
      const version = documentVersion;
      const available = [];
      connections.clear();
      for (const paths of await listTeamProfiles(await loadPaths(), account)) {
        const before = await fingerprint(paths);
        const result = await runGuide(paths);
        let data = result.exitCode === 0 ? result.result?.data : undefined;
        let authRequired = false;
        if (result.exitCode !== 0) {
          // CLI 세션 만료 시 저장된 Agent 연결을 비밀번호 입력 대상으로 유지
          const session = await checkSession(paths).catch(() => null);
          const binding = ["logged_out", "expired"].includes(session?.state)
            ? await readSavedBinding(paths, account).catch(() => null)
            : null;
          if (binding) {
            authRequired = true;
            data = {
              ...binding,
              userId: String(account.userId),
              teamId: String(account.teamId),
              targetPath: path.join(
                binding.projectPath,
                ...(binding.toolType === "codex"
                  ? [".codex", "config.toml"]
                  : [".mcp.json"]),
              ),
              fileState: "unavailable",
              availability: "auth_required",
            };
          }
        }
        if (version !== documentVersion)
          throw new Error("계정이 변경됐습니다. 설정을 다시 열어주세요.");
        if (
          !data ||
          data.userId !== String(account.userId) ||
          data.teamId !== String(account.teamId) ||
          !["codex", "claude_code"].includes(data.toolType) ||
          !path.isAbsolute(data.projectPath ?? "") ||
          before !== (await fingerprint(paths))
        )
          continue;
        const tool = data.toolType === "codex" ? "codex" : "claude-code";
        const target =
          tool === "codex"
            ? path.join(data.projectPath, ".codex", "config.toml")
            : path.join(data.projectPath, ".mcp.json");
        if (
          !samePath(data.targetPath, target) ||
          !/^[1-9]\d*$/.test(data.agentId)
        )
          continue;
        const current = {
          id: randomUUID(),
          project: data.projectPath,
          name: path.basename(data.projectPath),
          tools: [tool],
          tool,
          paths,
          userId: data.userId,
          teamId: data.teamId,
          email: account.email,
          targetPath: target,
          agentId: data.agentId,
          fingerprint: before,
          needsPassword: authRequired,
          saved: true,
        };
        connections.set(current.id, current);
        available.push({
          id: current.id,
          name: current.name,
          projectPath: current.project,
          tool,
          agentId: current.agentId,
          fileState: data.fileState,
          availability: data.availability,
        });
      }
      if (version !== documentVersion) {
        connections.clear();
        throw new Error("계정이 변경됐습니다. 설정을 다시 열어주세요.");
      }
      return available;
    }),
  );
  handle("getGuide", (_frame, id) => {
    const pending = guideRequests.get(id);
    if (pending) return pending;
    const request = exclusive(() => readGuide(requireSelection(id))).finally(
      () => {
        if (guideRequests.get(id) === request) guideRequests.delete(id);
      },
    );
    guideRequests.set(id, request);
    return request;
  });
  handle("inspectSetup", (_frame, id) =>
    exclusive(async () => {
      const current = requireSelection(id);
      const guide = await readGuide(current);
      const status = await runStatus(current.paths);
      const latest = await readGuide(current);
      const data = status.result?.data;
      const connection =
        status.exitCode === 0 &&
        matchesGuide(
          data && {
            ...data,
            targetPath: data.mcpConfigPath,
          },
          current,
        )
          ? data.connection
          : ["stopped", "unhealthy", "unknown"].includes(
                data?.connection?.broker,
              ) && data.connection.setupReady === false
            ? data.connection
            : null;
      return {
        guide: latest,
        connection: guide.fileState === latest.fileState ? connection : null,
      };
    }),
  );

  handle("status", async (_frame, account) => {
    useAccount(account);
    let firstError;
    // 현재 팀에 연결된 프로젝트 중 하나라도 준비되면 연결됨
    for (const paths of await listTeamProfiles(await loadPaths(), account)) {
      let status;
      try {
        status = await runStatus(paths);
      } catch (error) {
        firstError ??= error;
        continue;
      }
      const data = status.result?.data;
      if (
        status.exitCode === 0 &&
        data?.connection?.setupReady === true &&
        data.userId === String(account.userId) &&
        data.teamId === String(account.teamId)
      ) {
        return status;
      }
    }
    if (firstError) throw firstError;
    return notReady;
  });
  handle("pickFolder", (frame, account) =>
    exclusive(async () => {
      useAccount(account);

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
      const paths = await resolveProjectPaths(
        await loadPaths(),
        account,
        project,
      );
      const tools = await detectTools(paths);
      if (version !== documentVersion) return null;

      selection = {
        id: randomUUID(),
        project,
        name,
        tools,
        paths,
        userId: String(account.userId),
        teamId: String(account.teamId),
        email: account.email,
      };
      return { id: selection.id, name, tools };
    }),
  );

  async function connect(
    frame,
    id,
    tool,
    password,
    metadata,
    options,
    resume = false,
  ) {
    const current = requireSelection(id);
    const version = documentVersion;
    if (
      options !== undefined &&
      (!options ||
        typeof options !== "object" ||
        Array.isArray(options) ||
        Object.keys(options).some((key) => key !== "mcpMode") ||
        !["automatic", "manual"].includes(options.mcpMode))
    )
      throw new Error("설정 방식을 확인해주세요.");
    current.mcpMode = options?.mcpMode ?? current.mcpMode ?? "automatic";
    const agent = agentMetadata(
      metadata === undefined ? current.agentMetadata : metadata,
    );
    if (
      !current.tools.includes(tool) ||
      (current.tool && current.tool !== tool)
    ) {
      throw new Error(
        "감지된 AI 도구를 선택해주세요. 도구를 바꾸려면 폴더를 다시 선택해주세요.",
      );
    }
    if (
      password !== undefined &&
      (!current.needsPassword ||
        typeof password !== "string" ||
        !password ||
        /[\r\n\0]/.test(password) ||
        Buffer.byteLength(password, "utf8") > 72)
    ) {
      throw new Error(
        "비밀번호를 확인해주세요. 비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.",
      );
    }

    current.agentMetadata = agent;
    current.tool = tool;
    current.targetPath =
      tool === "claude-code"
        ? path.join(current.project, ".mcp.json")
        : path.join(current.project, ".codex", "config.toml");
    const paths = await resolveProjectPaths(
      await loadPaths(),
      current,
      current.project,
    );
    if (
      !samePath(paths.config, current.paths.config) ||
      paths.serverUrl !== current.paths.serverUrl
    ) {
      throw new Error(
        "서버 또는 연결 프로필이 변경됐습니다. 프로젝트 폴더를 다시 선택해주세요.",
      );
    }
    await prepareAccountProfile(paths);
    if (password === undefined) {
      const session = await checkSession(paths);
      assertCurrent(current, version);
      if (
        !session ||
        ["logged_out", "expired"].includes(session.state) ||
        (session.authenticated === true &&
          String(session.user?.userId) !== current.userId)
      ) {
        current.needsPassword = true;
        current.fingerprint = await fingerprint(paths);
        return { state: "password" };
      }
      if (
        session.authenticated !== true ||
        String(session.user?.userId) !== current.userId
      ) {
        return {
          state: "error",
          message:
            "CLI 테스트 프로필의 계정과 현재 로그인 계정이 일치하는지 확인해주세요.",
        };
      }
    }

    current.manualConfig = undefined;
    current.needsPassword = false;
    const input = {
      schemaVersion: 1,
      serverUrl: paths.serverUrl,
      user:
        password === undefined
          ? { mode: "session" }
          : { mode: "login", email: current.email },
      team: { id: current.teamId },
      project: resume
        ? { path: current.project }
        : { path: current.project, name: current.name },
      tool: { type: tool },
      agent: resume
        ? { action: "use", id: current.agentId, issueToken: false }
        : { action: "create", name: current.name, ...agent },
      mcp:
        current.mcpMode === "manual"
          ? { mode: "manual" }
          : { mode: "replace", targetPath: current.targetPath },
    };
    assertCurrent(current, version);
    const result = await runSetup(paths, input, password, (progress) => {
      if (selection !== current || frame.detached || frame.origin !== webOrigin)
        return;
      try {
        frame.send("devlink:setup-event", progress);
      } catch {
        /* 화면이 닫힌 경우 진행 이벤트 생략 */
      }
    });
    assertCurrent(current, version);
    current.fingerprint = undefined;

    if (result.exitCode === 0) {
      const status = await runStatus(paths);
      assertCurrent(current, version);
      if (status.exitCode === 0 && matchesProject(status.result.data, current))
        return { state: "done" };
      return {
        state: "error",
        message:
          "설정은 적용됐지만 연결 상태를 확인하지 못했습니다. 잠시 후 같은 폴더로 다시 확인해주세요.",
      };
    }

    const error = result.error;
    if (
      error?.step === "authenticate" &&
      ["SETUP_AUTH_REQUIRED", "SETUP_AUTH_REJECTED"].includes(error.code)
    ) {
      current.needsPassword = true;
      // 재시도 시 프로필 변경 검사를 위해 실행 후 상태 저장
      current.fingerprint = await fingerprint(paths);
      return {
        state: "password",
        message:
          error.code === "SETUP_AUTH_REJECTED"
            ? "비밀번호를 다시 확인해주세요."
            : undefined,
      };
    }

    const manual = error?.manualConfig;
    if (
      error?.code === "SETUP_MANUAL_ACTION_REQUIRED" &&
      samePath(manual?.suggestedTargetPath, current.targetPath) &&
      typeof manual.snippet === "string"
    ) {
      current.manualConfig = {
        config: paths.config,
        serverUrl: paths.serverUrl,
      };
      return {
        state: "manual",
        targetPath: current.targetPath,
        snippet: manual.snippet,
      };
    }

    if (error?.code === "SETUP_PROFILE_CONFLICT") {
      return {
        state: "error",
        code: error.code,
        message:
          "이 폴더는 이 PC에서 다른 AI 도구나 설정으로 이미 연결돼 있습니다. 처음 연결한 AI 도구로 다시 시도해주세요.",
      };
    }

    if (error?.code === "SETUP_AGENT_BINDING_CONFLICT") {
      // 담당 정보를 보내지 않았으면 이름·도구 등 다른 연결 정보 충돌
      return {
        state: "error",
        code: error.code,
        message:
          Object.keys(agent).length > 0
            ? "이 폴더에 연결된 기존 Agent 정보와 입력한 내용이 다릅니다. 기존 Agent의 담당 파트·역할 태그는 이 화면에서 바꿀 수 없으니 해당 항목을 비워 두고 다시 연결해주세요."
            : "이 폴더에 연결된 기존 Agent 정보가 현재 연결 정보와 다릅니다. Agent 목록에서 이름과 AI 도구를 확인하거나 폴더를 다시 선택해주세요.",
      };
    }

    return {
      state: "error",
      code: error?.code,
      message: error?.message ?? "프로젝트를 연결하지 못했습니다.",
    };
  }
  handle("setup", (frame, ...args) => exclusive(() => connect(frame, ...args)));
  handle("resumeSetup", (frame, id, password) =>
    exclusive(async () => {
      const current = requireSelection(id);
      if (current.needsPassword) {
        const paths = await resolveProjectPaths(
          await loadPaths(),
          current,
          current.project,
        );
        if (
          !samePath(paths.config, current.paths.config) ||
          paths.serverUrl !== current.paths.serverUrl ||
          !current.agentId ||
          current.fingerprint !== (await fingerprint(paths))
        ) {
          throw new Error(
            "연결 프로필이 변경됐습니다. 프로젝트 설정을 다시 선택해주세요.",
          );
        }
        assertCurrent(current);
      } else await readGuide(current);
      return connect(
        frame,
        id,
        current.tool,
        password,
        undefined,
        { mcpMode: "manual" },
        true,
      );
    }),
  );

  handle("checkSetup", (_frame, id) =>
    exclusive(async () => {
      const current = requireSelection(id);
      const paths = await resolveProjectPaths(
        await loadPaths(),
        current,
        current.project,
      );
      if (
        !current.manualConfig ||
        !samePath(paths.config, current.manualConfig.config) ||
        paths.serverUrl !== current.manualConfig.serverUrl
      ) {
        throw new Error("같은 테스트 프로필로 연결을 다시 시작해주세요.");
      }
      const { exitCode, result } = await runStatus(paths);
      return exitCode === 0 && matchesProject(result.data, current);
    }),
  );

  handle("openConfigFolder", async (_frame, id) => {
    const current = requireSelection(id);
    if (!current.manualConfig)
      throw new Error("AI 도구 설정 위치를 확인해주세요.");
    await readGuide(current);
    const configDirectory = path.dirname(current.targetPath);
    const resolved = await realpath(configDirectory).catch(() => null);
    const directory =
      resolved && samePath(resolved, configDirectory)
        ? resolved
        : current.project;
    assertCurrent(current);
    if (await shell.openPath(directory))
      throw new Error("설정 폴더를 열지 못했습니다.");
  });
}

module.exports = { registerSetupHandlers };
