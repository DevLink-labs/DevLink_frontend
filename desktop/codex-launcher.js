const { execFile } = require("node:child_process");
const { realpath } = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");

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

async function prepareCodex(project, paths) {
  const codex = await codexExecutable();
  const terminal = await executableOnPath("wt.exe");
  if (!terminal) throw new Error("Windows Terminal을 찾지 못했습니다. 설치 상태를 확인해주세요.");
  const result = await execute(codex, ["mcp", "get", "devlink", "--json", "-c", registrationApproval], {
    cwd: project, windowsHide: true, timeout: 10_000,
  }).then(({ stdout }) => JSON.parse(stdout)).catch(() => null);
  const brokerFile = path.join(path.dirname(paths.config), ".devlink-runtime", "broker.json");
  const transport = result?.transport;
  const configuredBroker = transport?.env?.DEVLINK_BROKER_FILE;
  const normalize = (file) => path.toNamespacedPath(path.resolve(file)).toLowerCase();
  const matchesPath = (value, expected) => typeof value === "string" && path.isAbsolute(value)
    && normalize(value) === normalize(expected);
  const args = transport?.args;
  if (!result?.enabled || transport?.type !== "stdio" || !matchesPath(configuredBroker, brokerFile) ||
      !matchesPath(transport.command, paths.node) || !Array.isArray(args) || !matchesPath(args[0], paths.entry) ||
      !(args.length === 1 || (args.length === 3 && args[1] === "--transport" && args[2] === "stdio")) ||
      (transport.cwd && !matchesPath(transport.cwd, project)) ||
      Object.keys(transport.env).some((name) => name !== "DEVLINK_BROKER_FILE") || transport.env_vars?.length) {
    throw new Error("Codex의 DevLink 설정이 이 Agent와 일치하지 않습니다. 연결 관리에서 프로젝트 설정을 확인해주세요.");
  }
  if (result.disabled_tools?.includes("register_agent") ||
      (result.enabled_tools && !result.enabled_tools.includes("register_agent"))) {
    throw new Error("Codex에서 DevLink의 Agent 연결 도구가 비활성화되어 있습니다.");
  }
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

module.exports = { prepareCodex, launchCodex };
