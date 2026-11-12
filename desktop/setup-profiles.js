const { createHash } = require("node:crypto");
const { mkdir, readFile, readdir } = require("node:fs/promises");
const path = require("node:path");

function serverOrigin(serverUrl) {
  const url = new URL(serverUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return `${url.origin}/`;
}

function projectKey(project) {
  const resolved = path.resolve(project);
  return process.platform === "win32"
    ? path.toNamespacedPath(resolved).toLowerCase()
    : resolved;
}

const toolTypes = { codex: "CODEX", "claude-code": "CLAUDE_CODE" };

function profileHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

// Agent가 정해지지 않은 프로필은 어느 도구로든 이어서 연결
function sameTool(binding, tool) {
  const bound = binding?.state?.agent?.toolType ?? binding?.state?.tool;
  return tool === undefined || bound === undefined || bound === toolTypes[tool];
}

function hasAgent(binding) {
  return Boolean(binding?.state?.agent) || binding?.state?.kind === "create_pending";
}

function checkedId(value, message) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(message);
  return id;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(
      "CLI 연결 프로필을 읽을 수 없습니다. 기존 설정을 확인해주세요.",
    );
  }
}

function runtimeFile(config, name) {
  return path.join(path.dirname(config), ".devlink-runtime", name);
}

function accountScope(paths, account) {
  const userId = checkedId(account?.userId, "현재 로그인 계정을 확인해주세요.");
  const teamId = checkedId(account?.teamId, "현재 팀을 확인해주세요.");
  const origin = serverOrigin(paths.serverUrl);
  const serverKey = createHash("sha256").update(origin).digest("hex");
  const root = path.join(path.dirname(paths.config), "accounts", serverKey, String(userId));
  return { userId, teamId, origin, root, teams: path.join(root, "teams", String(teamId)) };
}

// 기존 Agent가 연결된 기준 프로필과 이전 계정별 프로필
function legacyConfigs(paths, scope) {
  return [paths.config, path.join(scope.root, "config.json")];
}

function scoped(paths, config) {
  return config === paths.config ? paths : { ...paths, config, accountProfile: true };
}

function boundTo(binding, scope, project, tool) {
  return binding?.origin === scope.origin && binding.userId === scope.userId
    && binding.teamId === scope.teamId
    && (project === undefined || (typeof binding.projectRoot === "string"
      && projectKey(binding.projectRoot) === projectKey(project)))
    && sameTool(binding, tool);
}

// 같은 폴더도 AI 도구마다 별도 프로필·Agent로 연결
async function resolveProjectPaths(paths, account, project, tool) {
  const scope = accountScope(paths, account);
  if (typeof project !== "string" || !path.isAbsolute(project)) {
    throw new Error("프로젝트 폴더를 다시 선택해주세요.");
  }
  if (tool !== undefined && !toolTypes[tool]) {
    throw new Error("AI 도구를 다시 선택해주세요.");
  }
  const key = projectKey(project);
  const config = path.join(scope.teams, profileHash(key), "config.json");
  const toolConfig = tool === undefined
    ? config
    : path.join(scope.teams, profileHash(`${key}\0${tool}`), "config.json");
  // 도구 구분 전 프로필은 다른 도구의 Agent가 없을 때만 재사용
  // - 같은 도구 Agent가 연결된 프로필을 Agent 없는 프로필보다 우선
  let empty;
  for (const candidate of new Set([toolConfig, config])) {
    const projectConfig = await readJson(candidate);
    if (!projectConfig) continue;
    if (serverOrigin(projectConfig.serverUrl) !== scope.origin) {
      throw new Error(
        "계정별 CLI 프로필의 서버가 변경됐습니다. 연결 설정을 확인해주세요.",
      );
    }
    const binding = await readJson(runtimeFile(candidate, "agent-profile.json"));
    if (!sameTool(binding, tool)) continue;
    if (hasAgent(binding)) return scoped(paths, candidate);
    empty ??= candidate;
  }

  let emptyLegacy;
  for (const legacy of legacyConfigs(paths, scope)) {
    // 이 폴더 프로필이 있으면 이전 프로필 손상으로 연결을 막지 않음
    const binding = await readJson(runtimeFile(legacy, "agent-profile.json"))
      .catch((error) => {
        if (empty) return null;
        throw error;
      });
    if (!boundTo(binding, scope, project, tool)) continue;
    if (hasAgent(binding)) return scoped(paths, legacy);
    emptyLegacy ??= legacy;
  }
  if (empty) return scoped(paths, empty);
  if (emptyLegacy) return scoped(paths, emptyLegacy);

  // 기준 프로필에 Agent가 없으면 같은 계정의 로그인 세션 재사용
  const binding = await readJson(runtimeFile(paths.config, "agent-profile.json"));
  if (!binding) {
    const session = await readJson(runtimeFile(paths.config, "user-session.json"));
    if (session?.state?.user?.userId === scope.userId && session.origin === scope.origin) {
      return paths;
    }
  }
  return { ...paths, config: toolConfig, accountProfile: true };
}

async function listTeamProfiles(paths, account) {
  const scope = accountScope(paths, account);
  const profiles = [];
  // 손상된 프로필 하나 때문에 같은 팀의 다른 프로젝트를 놓치지 않도록 해당 항목만 제외
  const readable = (file) => readJson(file).catch(() => null);
  for (const legacy of legacyConfigs(paths, scope)) {
    if (boundTo(await readable(runtimeFile(legacy, "agent-profile.json")), scope)) {
      profiles.push(scoped(paths, legacy));
    }
  }
  const entries = await readdir(scope.teams, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw new Error("CLI 연결 프로필을 읽을 수 없습니다. 기존 설정을 확인해주세요.");
  });
  for (const entry of entries) {
    const config = path.join(scope.teams, entry.name, "config.json");
    if (entry.isDirectory() && await readable(config)) profiles.push(scoped(paths, config));
  }
  return profiles;
}

// 프로필에 등록된 같은 프로젝트·도구 Agent의 이름 (재연결 시 폴더명 대신 사용)
async function readProfileAgent(paths, account, project, tool) {
  const scope = accountScope(paths, account);
  const binding = await readJson(runtimeFile(paths.config, "agent-profile.json"));
  if (!boundTo(binding, scope, project, tool) || !hasAgent(binding)) return null;
  const { agent, name = agent?.name, projectName = agent?.projectName } = binding.state;
  if (typeof name !== "string" || typeof projectName !== "string") return null;
  return {
    agentId: Number.isSafeInteger(agent?.agentId) && agent.agentId > 0
      ? String(agent.agentId)
      : undefined,
    name,
    projectName,
  };
}

// CLI 세션 만료로 안내를 조회할 수 없을 때 표시할 저장된 Agent 연결
async function readSavedBinding(paths, account) {
  const scope = accountScope(paths, account);
  const binding = await readJson(runtimeFile(paths.config, "agent-profile.json"));
  const agent = binding?.state?.agent;
  const toolType = { CODEX: "codex", CLAUDE_CODE: "claude_code" }[agent?.toolType];
  if (
    !boundTo(binding, scope) ||
    typeof binding.projectRoot !== "string" ||
    !["ready", "needs_token"].includes(binding.state.kind) ||
    !Number.isSafeInteger(agent.agentId) ||
    agent.agentId <= 0 ||
    agent.ownerUserId !== scope.userId ||
    agent.teamId !== scope.teamId ||
    !toolType
  ) {
    return null;
  }
  return { projectPath: binding.projectRoot, agentId: String(agent.agentId), toolType };
}

async function prepareAccountProfile(paths) {
  if (!paths.accountProfile) return;
  try {
    await mkdir(path.dirname(paths.config), { recursive: true, mode: 0o700 });
  } catch {
    throw new Error("계정별 CLI 연결 프로필 폴더를 생성하지 못했습니다.");
  }
}

module.exports = {
  listTeamProfiles,
  prepareAccountProfile,
  readProfileAgent,
  readSavedBinding,
  resolveProjectPaths,
};
