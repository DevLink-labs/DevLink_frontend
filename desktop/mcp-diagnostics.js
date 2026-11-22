const { lstat } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function safePath(value) {
  return typeof value === "string" && value.length <= 4096 &&
    !/[\x00-\x1f\x7f]/.test(value) && path.isAbsolute(value)
    ? path.normalize(value) : null;
}

function samePath(actual, expected) {
  if (!safePath(actual) || !safePath(expected)) return false;
  const normalize = (value) => process.platform === "win32"
    ? path.toNamespacedPath(path.resolve(value)).toLowerCase() : path.resolve(value);
  return normalize(actual) === normalize(expected);
}

async function configSource(scope, file) {
  const location = safePath(file);
  const info = location && await lstat(location).catch(() => null);
  return { scope, path: location, present: Boolean(info?.isFile() && !info.isSymbolicLink()) };
}

async function diagnoseMcpConfiguration(result, project, paths, options = {}) {
  const tool = options.tool ?? "codex";
  const expected = {
    profilePath: safePath(paths.config),
    brokerFile: safePath(path.join(path.dirname(paths.config), ".devlink-runtime", "broker.json")),
    nodePath: safePath(paths.node),
    mcpPath: safePath(paths.entry),
    projectPath: safePath(project),
  };
  const transport = result?.transport;
  const effective = {
    brokerFile: safePath(transport?.env?.DEVLINK_BROKER_FILE),
    nodePath: safePath(transport?.command),
    mcpPath: safePath(transport?.args?.[0]),
    projectPath: safePath(transport?.cwd),
  };
  const issues = [];
  if (!result || !transport) issues.push("MCP_CONFIG_UNAVAILABLE");
  else {
    if (!samePath(effective.brokerFile, expected.brokerFile)) issues.push("BROKER_PROFILE_PATH_MISMATCH");
    if (!samePath(effective.nodePath, expected.nodePath) || !samePath(effective.mcpPath, expected.mcpPath)) issues.push("MCP_RUNTIME_PATH_MISMATCH");
    if (transport.cwd && !samePath(effective.projectPath, expected.projectPath)) issues.push("MCP_PROJECT_PATH_MISMATCH");
    const args = transport.args;
    if (!result.enabled || transport.type !== "stdio" || !Array.isArray(args) ||
        !(args.length === 1 || (args.length === 3 && args[1] === "--transport" && args[2] === "stdio")) ||
        !transport.env || Object.keys(transport.env).some((name) => name !== "DEVLINK_BROKER_FILE") || transport.env_vars?.length) {
      issues.push("MCP_LAUNCH_CONFIG_MISMATCH");
    }
  }
  const home = safePath(options.codexHome ?? process.env.CODEX_HOME) ?? path.join(os.homedir(), ".codex");
  const sources = await Promise.all([
    configSource("global", tool === "codex" ? path.join(home, "config.toml") : path.join(os.homedir(), ".claude.json")),
    configSource("project", tool === "codex" ? path.join(project, ".codex", "config.toml") : path.join(project, ".mcp.json")),
  ]);
  // 자격 파일 내용과 임의 환경변수·인자는 진단 결과에서 제외
  return { status: issues.length ? result ? "mismatch" : "unknown" : "matches", issues, expected, effective, sources };
}

function diagnosticMessage(diagnostics) {
  const reason = diagnostics.issues.includes("BROKER_PROFILE_PATH_MISMATCH")
    ? "DEVLINK_BROKER_FILE이 선택한 DevLink 프로필과 다릅니다. 파일 재읽기만으로 다른 프로필 경로를 복구하지 않습니다."
    : diagnostics.issues.includes("MCP_RUNTIME_PATH_MISMATCH")
      ? "실제 Node 또는 MCP 실행 경로가 선택한 DevLink 실행 환경과 다릅니다."
      : "AI 도구의 DevLink 설정을 확인하지 못했습니다.";
  return `${reason} 프로젝트 설정과 전역 설정을 확인한 뒤 해당 AI 도구 세션을 다시 열어주세요. ` +
    `선택한 프로필: ${diagnostics.expected.profilePath}; ` +
    `예상 broker: ${diagnostics.expected.brokerFile}; 실제 broker: ${diagnostics.effective.brokerFile ?? "확인 불가"}; ` +
    `예상 Node: ${diagnostics.expected.nodePath}; 실제 Node: ${diagnostics.effective.nodePath ?? "확인 불가"}; ` +
    `예상 MCP: ${diagnostics.expected.mcpPath}; 실제 MCP: ${diagnostics.effective.mcpPath ?? "확인 불가"}`;
}

module.exports = { diagnoseMcpConfiguration, diagnosticMessage };
