const { createHash } = require("node:crypto");
const { mkdir, readFile } = require("node:fs/promises");
const path = require("node:path");

function serverOrigin(serverUrl) {
  const url = new URL(serverUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return `${url.origin}/`;
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

async function resolveAccountPaths(paths, account) {
  const userId = Number(account?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("현재 로그인 계정을 확인해주세요.");
  }
  const origin = serverOrigin(paths.serverUrl);
  const serverKey = createHash("sha256").update(origin).digest("hex");
  const config = path.join(
    path.dirname(paths.config),
    "accounts",
    serverKey,
    String(userId),
    "config.json",
  );
  const scopedConfig = await readJson(config);
  if (scopedConfig && serverOrigin(scopedConfig.serverUrl) !== origin) {
    throw new Error(
      "계정별 CLI 프로필의 서버가 변경됐습니다. 연결 설정을 확인해주세요.",
    );
  }

  if (!scopedConfig) {
    const runtime = path.join(path.dirname(paths.config), ".devlink-runtime");
    const binding = await readJson(path.join(runtime, "agent-profile.json"));
    const session = binding
      ? null
      : await readJson(path.join(runtime, "user-session.json"));
    const legacyUser = binding?.userId ?? session?.state?.user?.userId;
    const legacyOrigin = binding?.origin ?? session?.origin;
    if (legacyUser === userId && legacyOrigin === origin) return paths;
  }

  return { ...paths, config, accountProfile: true };
}

async function prepareAccountProfile(paths) {
  if (!paths.accountProfile) return;
  try {
    await mkdir(path.dirname(paths.config), { recursive: true, mode: 0o700 });
  } catch {
    throw new Error("계정별 CLI 연결 프로필 폴더를 생성하지 못했습니다.");
  }
}

module.exports = { prepareAccountProfile, resolveAccountPaths };
