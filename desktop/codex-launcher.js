const { execFile } = require("node:child_process");
const { realpath } = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");
const { diagnoseMcpConfiguration, diagnosticMessage } = require("./mcp-diagnostics");

const execute = promisify(execFile);
const registrationApproval = "mcp_servers.devlink.tools.register_agent.approval_mode=approve";

async function executableOnPath(name) {
  const where = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "where.exe");
  const result = await execute(where, [`$PATH:${name}`], { windowsHide: true, timeout: 5_000 }).catch(() => null);
  return result?.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => path.isAbsolute(line));
}

async function codexExecutable() {
  const npm = process.env.APPDATA;
  if (npm && path.isAbsolute(npm)) {
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const target = `${arch === "arm64" ? "aarch64" : "x86_64"}-pc-windows-msvc`;
    const binary = await realpath(path.join(npm, "npm", "node_modules", "@openai", "codex",
      "node_modules", "@openai", `codex-win32-${arch}`, "vendor", target, "bin", "codex.exe")).catch(() => null);
    if (binary) return binary;
  }
  const binary = await executableOnPath("codex.exe");
  if (!binary) throw new Error("Codex CLI를 찾지 못했습니다. Codex가 설치되어 있는지 확인해주세요.");
  return binary;
}

async function inspectCodex(project, paths, codex) {
  const executable = codex ?? await codexExecutable().catch(() => null);
  if (!executable) return diagnoseMcpConfiguration(null, project, paths);
  const result = await execute(executable, ["mcp", "get", "devlink", "--json", "-c", registrationApproval], {
    cwd: project, windowsHide: true, timeout: 10_000,
  }).then(({ stdout }) => JSON.parse(stdout)).catch(() => null);
  const diagnostics = await diagnoseMcpConfiguration(result, project, paths);
  if (result?.disabled_tools?.includes("register_agent") ||
      (result?.enabled_tools && !result.enabled_tools.includes("register_agent"))) {
    diagnostics.status = "mismatch";
    diagnostics.issues.push("MCP_REGISTER_TOOL_DISABLED");
  }
  return diagnostics;
}

async function prepareCodex(project, paths) {
  const codex = await codexExecutable();
  const terminal = await executableOnPath("wt.exe");
  if (!terminal) throw new Error("Windows Terminal을 찾지 못했습니다. 설치 상태를 확인해주세요.");
  const diagnostics = await inspectCodex(project, paths, codex);
  if (diagnostics.issues.includes("MCP_REGISTER_TOOL_DISABLED")) {
    throw new Error("Codex에서 DevLink의 Agent 연결 도구가 비활성화되어 있습니다.");
  }
  if (diagnostics.status !== "matches") throw new Error(diagnosticMessage(diagnostics));
  return { codex, terminal };
}

async function launchCodex({ codex, terminal }, project) {
  const prompt = "DevLink MCP의 register_agent를 빈 인자 {}로 한 번 호출하여 이 Codex 세션을 현재 프로젝트의 기존 Agent에 연결해 주세요. 파일 변경이나 작업 조회, 생성, 수락 없이 연결 결과만 알려주세요.";
  const terminalArgument = (value) => value.replaceAll(";", "\\;");
  try {
    await execute(terminal, ["-w", "new", "new-tab", "--title", "DevLink Codex",
      "--startingDirectory", terminalArgument(project), terminalArgument(codex), "--no-daemon", "-C", terminalArgument(project),
      "-c", registrationApproval, "--", prompt], {
      windowsHide: true, timeout: 10_000,
    });
  } catch {
    throw new Error("Codex 터미널을 열지 못했습니다. Windows Terminal과 Codex 설치 상태를 확인해주세요.");
  }
}

function codexAppUrl(project, teamId, agentId, taskId) {
  const connect = [
    `DevLink get_my_context({})로 프로젝트, 팀 ${teamId}, Agent ${agentId}를 확인하세요.`,
    "일치하고 hostSession=unbound면 register_agent({}) 후 다시 확인하세요.",
    "identity=verified와 hostSession=bound일 때만 진행하세요.",
  ];
  const prompt = taskId === undefined
    ? [...connect, "작업 조회·생성·변경과 파일 변경 없이 연결 결과만 알려주세요."]
    : [
      ...connect,
      `get_task_result({"taskId":"${taskId}"})로 수신 Agent와 IN_PROGRESS 상태를 확인하세요.`,
      "재수락 없이 요청 범위만 작업하세요. 최신 version으로 성공 시 complete_task, 실행 실패 시 update_task_status(FAILED)를 호출하세요.",
    ];
  const url = `codex://new?path=${encodeURIComponent(project)}&prompt=${encodeURIComponent(prompt.join(" "))}`;
  if (url.length > 2081) {
    throw new Error("Codex 앱에 전달할 링크가 너무 깁니다. Codex에서 프로젝트 폴더를 직접 열어주세요.");
  }
  return url;
}

async function launchCodexApp(shell, url) {
  try {
    await shell.openExternal(url);
  } catch {
    throw new Error("Codex 앱을 열지 못했습니다. Codex 데스크톱 앱의 설치 상태를 확인해주세요.");
  }
}

module.exports = { prepareCodex, inspectCodex, launchCodex, codexAppUrl, launchCodexApp };
