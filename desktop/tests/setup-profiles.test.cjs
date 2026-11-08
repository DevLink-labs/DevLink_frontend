const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const {
  prepareAccountProfile,
  resolveAccountPaths,
} = require("../setup-profiles");
const { checkSession, runStatus } = require("../setup-runner");

const accountA = { userId: 3, teamId: 2, email: "a@example.test" };
const accountB = { userId: 5, teamId: 4, email: "b@example.test" };

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "devlink-profiles-test-"));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("devlink-profiles-test-"));
    await rm(root, { recursive: true, force: true });
  });
  const paths = {
    config: path.join(root, "config.json"),
    serverUrl: "ws://127.0.0.1:8080/",
    cli: "unused",
    node: "unused",
    entry: "unused",
  };
  await writeFile(
    paths.config,
    JSON.stringify({ serverUrl: paths.serverUrl, localPort: 57589 }),
  );
  const runtime = path.join(root, ".devlink-runtime");
  await mkdir(runtime);
  const binding = {
    origin: "http://127.0.0.1:8080/",
    userId: 3,
    teamId: 2,
    projectRoot: root,
    state: { kind: "needs_token", agent: { agentId: 3, ownerUserId: 3 } },
  };
  await writeFile(
    path.join(runtime, "agent-profile.json"),
    JSON.stringify(binding),
  );
  await writeFile(
    path.join(runtime, "user-session.json"),
    JSON.stringify({
      origin: binding.origin,
      state: { kind: "authenticated", user: { userId: 5 } },
    }),
  );
  return { paths, root, runtime };
}

test("새 계정은 기존 Agent와 다른 프로필을 사용하고 원래 계정은 기존 연결을 재사용한다", async (t) => {
  const { paths, runtime } = await fixture(t);
  const before = await readFile(
    path.join(runtime, "agent-profile.json"),
    "utf8",
  );
  const b = await resolveAccountPaths(paths, accountB);
  assert.notEqual(b.config, paths.config);
  await prepareAccountProfile(b);
  assert.deepEqual(await readdir(path.dirname(b.config)), []);
  assert.equal(
    (await resolveAccountPaths(paths, accountA)).config,
    paths.config,
  );
  assert.equal((await resolveAccountPaths(paths, accountB)).config, b.config);
  assert.equal(
    await readFile(path.join(runtime, "agent-profile.json"), "utf8"),
    before,
  );
});

test("프로필 선택과 미설정 계정 상태 조회는 파일을 만들지 않는다", async (t) => {
  const { paths, root } = await fixture(t);
  const before = await readdir(root, { recursive: true });
  const b = await resolveAccountPaths(paths, accountB);
  const status = await runStatus(b);
  assert.equal(status.result.data.connection.setupReady, false);
  assert.equal((await checkSession(b)).state, "logged_out");
  assert.deepEqual(await readdir(root, { recursive: true }), before);
});

test("같은 사용자라도 서버가 다르면 프로필을 분리하고 기존 설정을 보존한다", async (t) => {
  const { paths } = await fixture(t);
  const a = await resolveAccountPaths(paths, accountB);
  const b = await resolveAccountPaths(
    { ...paths, serverUrl: "ws://localhost:8081/" },
    accountB,
  );
  assert.notEqual(a.config, b.config);
  await prepareAccountProfile(a);
  const initialized = { serverUrl: paths.serverUrl, localPort: 50001 };
  await writeFile(a.config, JSON.stringify(initialized));
  await prepareAccountProfile(a);
  assert.deepEqual(JSON.parse(await readFile(a.config, "utf8")), initialized);
});

test("기존 Agent가 없을 때만 로그인 세션을 기준으로 기존 프로필을 재사용한다", async (t) => {
  const { paths, runtime } = await fixture(t);
  await rm(path.join(runtime, "agent-profile.json"));
  assert.equal(
    (await resolveAccountPaths(paths, accountB)).config,
    paths.config,
  );
  assert.notEqual(
    (await resolveAccountPaths(paths, accountA)).config,
    paths.config,
  );
});

test("잘못된 계정 ID와 손상된 기존 프로필은 조용히 새 연결을 만들지 않는다", async (t) => {
  const { paths, runtime } = await fixture(t);
  for (const userId of [0, -1, "../../other", Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(resolveAccountPaths(paths, { userId }));
  }
  await writeFile(path.join(runtime, "agent-profile.json"), "broken-json");
  await assert.rejects(resolveAccountPaths(paths, accountB), /기존 설정/);
});

async function ipcFixture(t) {
  const f = await fixture(t);
  const handlers = new Map();
  const window = new EventEmitter();
  window.webContents = new EventEmitter();
  const frame = {
    origin: "http://localhost:5173",
    parent: null,
    detached: false,
    send() {},
  };
  const event = { sender: window.webContents, senderFrame: frame };
  const calls = [];
  let authenticatedUser = 5;
  const runner = {
    loadDevelopmentPaths: async () => f.paths,
    detectTools: async () => ["codex", "claude-code"],
    checkSession: async () => ({
      authenticated: true,
      user: { userId: authenticatedUser },
    }),
    runStatus: async (paths) => {
      calls.push({ kind: "status", config: paths.config });
      return {
        exitCode: 0,
        result: {
          data: {
            userId: "5",
            teamId: "4",
            toolType: "claude_code",
            projectPath: f.root,
            connection: { setupReady: true },
          },
        },
      };
    },
    runSetup: async (paths, input) => {
      calls.push({
        kind: "setup",
        config: paths.config,
        teamId: input.team.id,
        mcpMode: input.mcp.mode,
      });
      return {
        exitCode: 3,
        error: {
          code: "SETUP_MANUAL_ACTION_REQUIRED",
          manualConfig: {
            suggestedTargetPath: input.mcp.targetPath,
            snippet: "test config",
          },
        },
      };
    },
  };
  const module = { exports: {} };
  const source = await readFile(
    path.join(__dirname, "..", "setup-ipc.js"),
    "utf8",
  );
  vm.runInNewContext(source, {
    module,
    process,
    URL,
    Buffer,
    require(name) {
      if (name === "electron")
        return {
          dialog: {
            showOpenDialog: async () => ({
              canceled: false,
              filePaths: [f.root],
            }),
          },
          ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
          shell: { openPath: async () => "" },
        };
      if (name === "./setup-runner") return runner;
      if (name === "./setup-profiles")
        return { prepareAccountProfile, resolveAccountPaths };
      return require(name);
    },
  });
  module.exports.registerSetupHandlers(window, frame.origin);
  return {
    ...f,
    calls,
    setAuthenticatedUser: (id) => {
      authenticatedUser = id;
    },
    invoke: (name, ...args) => handlers.get(`devlink:${name}`)(event, ...args),
  };
}

test("IPC 상태 조회·설정·수동 확인은 같은 계정별 프로필을 사용하고 계정을 바꿔도 유지된다", async (t) => {
  const f = await ipcFixture(t);
  await f.invoke("status", accountB);
  const selection = await f.invoke("pickFolder", accountB);
  assert.equal(selection.paths, undefined);
  const result = await f.invoke("setup", selection.id, "claude-code");
  assert.equal(result.state, "manual");
  assert.equal(
    f.calls.find((call) => call.kind === "setup").mcpMode,
    "replace",
  );
  assert.equal(await f.invoke("checkSetup", selection.id), true);
  const configs = f.calls.map((call) => call.config);
  assert.ok(configs.every((config) => config === configs[0]));
  assert.notEqual(configs[0], f.paths.config);
  await f.invoke("status", accountA);
  assert.equal(f.calls.at(-1).config, f.paths.config);
  await f.invoke("status", accountB);
  assert.equal(f.calls.at(-1).config, configs[0]);
});

test("이전 계정의 CLI 세션은 설정을 실행하지 않고 현재 계정 비밀번호를 요청한다", async (t) => {
  const f = await ipcFixture(t);
  const selection = await f.invoke("pickFolder", accountA);
  const result = await f.invoke("setup", selection.id, "codex");
  assert.equal(result.state, "password");
  assert.equal(f.calls.filter((call) => call.kind === "setup").length, 0);
  await assert.rejects(f.invoke("status", { ...accountB, userId: -1 }), /계정/);
});

test("폴더 선택 뒤 서버가 변경되면 설정과 수동 확인을 다른 프로필로 진행하지 않는다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  const originalServer = f.paths.serverUrl;
  f.paths.serverUrl = "ws://127.0.0.1:8081/";
  await assert.rejects(
    f.invoke("setup", selected.id, "claude-code"),
    /프로필이 변경/,
  );
  assert.equal(f.calls.filter((call) => call.kind === "setup").length, 0);
  f.paths.serverUrl = originalServer;
  assert.equal(
    (await f.invoke("setup", selected.id, "claude-code")).state,
    "manual",
  );
  f.paths.serverUrl = "ws://127.0.0.1:8081/";
  await assert.rejects(
    f.invoke("checkSetup", selected.id),
    /같은 테스트 프로필/,
  );
});
