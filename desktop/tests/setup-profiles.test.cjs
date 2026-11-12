const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { EventEmitter } = require("node:events");
const {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const {
  listTeamProfiles,
  prepareAccountProfile,
  readProfileAgent,
  readSavedBinding,
  resolveProjectPaths,
} = require("../setup-profiles");
const { checkSession, runStatus } = require("../setup-runner");
const { listProfiles } = require("../maintenance/broker-lifecycle");

const accountA = { userId: 3, teamId: 2, email: "a@example.test" };
const accountB = { userId: 5, teamId: 4, email: "b@example.test" };
const origin = "http://127.0.0.1:8080/";

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
    origin,
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
      origin,
      state: { kind: "authenticated", user: { userId: 5 } },
    }),
  );
  return { paths, root, runtime, other: path.join(root, "other-project") };
}

test("기존 Agent의 팀·프로젝트는 기준 프로필을 재사용하고 다른 프로젝트·팀·계정은 각각 분리한다", async (t) => {
  const { paths, root, runtime, other } = await fixture(t);
  const before = await readFile(
    path.join(runtime, "agent-profile.json"),
    "utf8",
  );
  assert.equal(
    (await resolveProjectPaths(paths, accountA, root)).config,
    paths.config,
  );
  const configs = [
    (await resolveProjectPaths(paths, accountA, other)).config,
    (await resolveProjectPaths(paths, { ...accountA, teamId: 9 }, root)).config,
    (await resolveProjectPaths(paths, accountB, root)).config,
    (await resolveProjectPaths(paths, accountB, other)).config,
  ];
  assert.equal(new Set([paths.config, ...configs]).size, 5);

  const b = await resolveProjectPaths(paths, accountB, root);
  await prepareAccountProfile(b);
  assert.deepEqual(await readdir(path.dirname(b.config)), []);
  assert.equal(
    (await resolveProjectPaths(paths, accountB, root)).config,
    b.config,
  );
  assert.equal(
    await readFile(path.join(runtime, "agent-profile.json"), "utf8"),
    before,
  );
});

test("프로필 선택과 미설정 계정 상태 조회는 파일을 만들지 않는다", async (t) => {
  const { paths, root } = await fixture(t);
  const before = await readdir(root, { recursive: true });
  const b = await resolveProjectPaths(paths, accountB, root);
  const status = await runStatus(b);
  assert.equal(status.result.data.connection.setupReady, false);
  assert.equal((await checkSession(b)).state, "logged_out");
  assert.deepEqual(await listTeamProfiles(paths, accountB), []);
  assert.deepEqual(await readdir(root, { recursive: true }), before);
});

test("같은 사용자라도 서버가 다르면 프로필을 분리하고 기존 설정을 보존한다", async (t) => {
  const { paths, root } = await fixture(t);
  const a = await resolveProjectPaths(paths, accountB, root);
  const b = await resolveProjectPaths(
    { ...paths, serverUrl: "ws://localhost:8081/" },
    accountB,
    root,
  );
  assert.notEqual(a.config, b.config);
  await prepareAccountProfile(a);
  const initialized = { serverUrl: paths.serverUrl, localPort: 50001 };
  await writeFile(a.config, JSON.stringify(initialized));
  await prepareAccountProfile(a);
  assert.deepEqual(JSON.parse(await readFile(a.config, "utf8")), initialized);
});

test("기존 Agent가 없을 때만 로그인 세션을 기준으로 기존 프로필을 재사용한다", async (t) => {
  const { paths, runtime, root, other } = await fixture(t);
  await rm(path.join(runtime, "agent-profile.json"));
  assert.equal(
    (await resolveProjectPaths(paths, accountB, other)).config,
    paths.config,
  );
  assert.notEqual(
    (await resolveProjectPaths(paths, accountA, root)).config,
    paths.config,
  );
});

test("이전 계정별 프로필은 같은 팀·프로젝트일 때만 재사용하고 팀 상태 조회에 포함한다", async (t) => {
  const { paths, root, other } = await fixture(t);
  const serverKey = createHash("sha256").update(origin).digest("hex");
  const legacy = path.join(root, "accounts", serverKey, "5", "config.json");
  await mkdir(path.join(path.dirname(legacy), ".devlink-runtime"), {
    recursive: true,
  });
  await writeFile(
    legacy,
    JSON.stringify({ serverUrl: paths.serverUrl, localPort: 50002 }),
  );
  await writeFile(
    path.join(path.dirname(legacy), ".devlink-runtime", "agent-profile.json"),
    JSON.stringify({ origin, userId: 5, teamId: 4, projectRoot: other }),
  );

  assert.equal(
    (await resolveProjectPaths(paths, accountB, other)).config,
    legacy,
  );
  const fresh = await resolveProjectPaths(paths, accountB, root);
  assert.notEqual(fresh.config, legacy);
  assert.notEqual(
    (await resolveProjectPaths(paths, { ...accountB, teamId: 7 }, other))
      .config,
    legacy,
  );

  await prepareAccountProfile(fresh);
  await writeFile(fresh.config, JSON.stringify({ serverUrl: paths.serverUrl }));
  assert.deepEqual(
    (await listTeamProfiles(paths, accountB))
      .map((profile) => profile.config)
      .sort(),
    [legacy, fresh.config].sort(),
  );
  assert.deepEqual(
    await listTeamProfiles(paths, { ...accountB, teamId: 7 }),
    [],
  );
  assert.deepEqual(
    (await listTeamProfiles(paths, accountA)).map((profile) => profile.config),
    [paths.config],
  );
});

test("손상된 프로필은 팀 프로필 목록에서만 빼고 같은 팀의 정상 프로젝트는 계속 돌려준다", async (t) => {
  const { paths, runtime, root, other } = await fixture(t);
  const fresh = await resolveProjectPaths(paths, accountA, other);
  await prepareAccountProfile(fresh);
  await writeFile(fresh.config, JSON.stringify({ serverUrl: paths.serverUrl }));
  const broken = path.join(path.dirname(path.dirname(fresh.config)), "broken");
  await mkdir(broken);
  await writeFile(path.join(broken, "config.json"), "{broken");

  assert.deepEqual(
    (await listTeamProfiles(paths, accountA))
      .map((profile) => profile.config)
      .sort(),
    [paths.config, fresh.config].sort(),
  );
  await writeFile(path.join(runtime, "agent-profile.json"), "broken-json");
  assert.deepEqual(
    (await listTeamProfiles(paths, accountA)).map((profile) => profile.config),
    [fresh.config],
  );
  // 프로젝트를 다시 연결할 때는 손상 안내를 그대로 표시
  await assert.rejects(resolveProjectPaths(paths, accountA, root), /기존 설정/);
});

test("잘못된 계정·팀 ID와 프로젝트, 손상된 기존 프로필은 조용히 새 연결을 만들지 않는다", async (t) => {
  const { paths, runtime, root } = await fixture(t);
  for (const userId of [0, -1, "../../other", Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(
      resolveProjectPaths(paths, { ...accountB, userId }, root),
    );
  }
  await assert.rejects(
    resolveProjectPaths(paths, { ...accountB, teamId: "../1" }, root),
  );
  await assert.rejects(
    resolveProjectPaths(paths, accountB, "relative/project"),
  );
  await writeFile(path.join(runtime, "agent-profile.json"), "broken-json");
  await assert.rejects(resolveProjectPaths(paths, accountB, root), /기존 설정/);
});

test("같은 폴더도 AI 도구마다 별도 프로필을 쓰고 도구 구분 전 프로필은 같은 도구로만 재사용한다", async (t) => {
  const { paths, root, other } = await fixture(t);
  const codex = await resolveProjectPaths(paths, accountB, other, "codex");
  const claude = await resolveProjectPaths(
    paths,
    accountB,
    other,
    "claude-code",
  );
  assert.notEqual(codex.config, claude.config);
  assert.equal(
    (await resolveProjectPaths(paths, accountB, other, "codex")).config,
    codex.config,
  );
  await assert.rejects(
    resolveProjectPaths(paths, accountB, other, "cursor"),
    /AI 도구/,
  );

  // 도구 구분 전 경로에 Agent 없는 프로필은 어느 도구로든 이어서 사용
  const before = await resolveProjectPaths(paths, accountB, other);
  await prepareAccountProfile(before);
  await writeFile(
    before.config,
    JSON.stringify({ serverUrl: paths.serverUrl }),
  );
  for (const tool of ["codex", "claude-code"]) {
    assert.equal(
      (await resolveProjectPaths(paths, accountB, other, tool)).config,
      before.config,
    );
  }

  // Codex Agent가 연결된 뒤에는 Claude Code만 새 프로필로 분리
  const runtime = path.join(path.dirname(before.config), ".devlink-runtime");
  await mkdir(runtime);
  await writeFile(
    path.join(runtime, "agent-profile.json"),
    JSON.stringify({
      origin,
      userId: 5,
      teamId: 4,
      projectRoot: other,
      state: { kind: "ready", agent: { agentId: 8, toolType: "CODEX" } },
    }),
  );
  assert.equal(
    (await resolveProjectPaths(paths, accountB, other, "codex")).config,
    before.config,
  );
  assert.equal(
    (await resolveProjectPaths(paths, accountB, other, "claude-code")).config,
    claude.config,
  );

  // 기준 프로필의 Agent도 연결한 도구로만 재사용
  const base = path.join(root, ".devlink-runtime", "agent-profile.json");
  await writeFile(
    base,
    JSON.stringify({
      origin,
      userId: 3,
      teamId: 2,
      projectRoot: root,
      state: { kind: "create_pending", tool: "CLAUDE_CODE" },
    }),
  );
  assert.equal(
    (await resolveProjectPaths(paths, accountA, root, "claude-code")).config,
    paths.config,
  );
  assert.notEqual(
    (await resolveProjectPaths(paths, accountA, root, "codex")).config,
    paths.config,
  );

  // 도구별 프로필도 팀 목록과 업데이트 시 브로커 종료 대상에 포함
  await prepareAccountProfile(claude);
  await writeFile(
    claude.config,
    JSON.stringify({ serverUrl: paths.serverUrl }),
  );
  assert.deepEqual(
    (await listTeamProfiles(paths, accountB))
      .map((profile) => profile.config)
      .sort(),
    [before.config, claude.config].sort(),
  );
  const profiles = (await listProfiles(root)).map((name) =>
    path.join(root, name),
  );
  assert.ok(profiles.includes(before.config));
  assert.ok(profiles.includes(claude.config));
});

async function bindProfile(config, binding) {
  await prepareAccountProfile({ config, accountProfile: true });
  await writeFile(
    config,
    JSON.stringify({ serverUrl: "ws://127.0.0.1:8080/" }),
  );
  const runtime = path.join(path.dirname(config), ".devlink-runtime");
  await mkdir(runtime, { recursive: true });
  if (binding)
    await writeFile(
      path.join(runtime, "agent-profile.json"),
      JSON.stringify({ origin, userId: 5, teamId: 4, ...binding }),
    );
}

test("Agent가 연결된 같은 도구 프로필을 Agent 없는 도구별 프로필보다 우선한다", async (t) => {
  const { paths, other } = await fixture(t);
  const legacy = (await resolveProjectPaths(paths, accountB, other)).config;
  const empty = (await resolveProjectPaths(paths, accountB, other, "codex"))
    .config;
  assert.notEqual(legacy, empty);
  await bindProfile(empty);
  await bindProfile(legacy, {
    projectRoot: other,
    state: { kind: "ready", agent: { agentId: 9, toolType: "CODEX" } },
  });
  assert.equal(
    (await resolveProjectPaths(paths, accountB, other, "codex")).config,
    legacy,
  );
  // 다른 도구는 Agent 없는 자기 프로필이 아닌 새 경로를 사용
  assert.notEqual(
    (await resolveProjectPaths(paths, accountB, other, "claude-code")).config,
    legacy,
  );
});

test("이 폴더 프로필이 있으면 손상된 기준 프로필 때문에 연결을 막지 않는다", async (t) => {
  const { paths, runtime, other } = await fixture(t);
  const own = (await resolveProjectPaths(paths, accountB, other, "codex"))
    .config;
  await bindProfile(own);
  await writeFile(path.join(runtime, "agent-profile.json"), "broken-json");
  assert.equal(
    (await resolveProjectPaths(paths, accountB, other, "codex")).config,
    own,
  );
  // 이 폴더 프로필이 없는 도구는 기존처럼 손상 안내
  await assert.rejects(
    resolveProjectPaths(paths, accountB, other, "claude-code"),
    /기존 설정/,
  );
});

test("저장된 Agent 이름은 같은 프로젝트·도구의 프로필에서만 읽는다", async (t) => {
  const { paths, root, other } = await fixture(t);
  const profile = await resolveProjectPaths(paths, accountB, other, "codex");
  await bindProfile(profile.config, {
    projectRoot: other,
    state: {
      kind: "needs_token",
      agent: {
        agentId: 41,
        toolType: "CODEX",
        name: "api-agent",
        projectName: "API",
      },
    },
  });
  assert.deepEqual(
    { ...(await readProfileAgent(profile, accountB, other, "codex")) },
    { agentId: "41", name: "api-agent", projectName: "API" },
  );
  assert.equal(
    await readProfileAgent(profile, accountB, other, "claude-code"),
    null,
  );
  assert.equal(await readProfileAgent(profile, accountB, root, "codex"), null);
  assert.equal(
    await readProfileAgent(profile, { ...accountB, teamId: 7 }, other, "codex"),
    null,
  );
});

async function ipcFixture(t) {
  const f = await fixture(t);
  await mkdir(f.other);
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
  const inputs = new Map();
  const notReady = new Set();
  const statusErrors = new Map();
  const statusOverrides = new Map();
  let picked = f.root;
  let authenticatedUser = 5;
  let guideBarrier;
  let sessionState;
  const guideFailures = new Set();
  let setupError = {
    code: "SETUP_MANUAL_ACTION_REQUIRED",
    manualConfig: { snippet: "test config" },
  };
  const runner = {
    loadDevelopmentPaths: async () => f.paths,
    detectTools: async () => ["codex", "claude-code"],
    checkSession: async () =>
      sessionState
        ? { state: sessionState, authenticated: false }
        : { authenticated: true, user: { userId: authenticatedUser } },
    runGuide: async (paths) => {
      calls.push({ kind: "guide", config: paths.config });
      if (guideBarrier) await guideBarrier;
      const input = inputs.get(paths.config);
      if (!input || guideFailures.has(paths.config))
        return { exitCode: 6, result: {} };
      const project = input.project.path;
      const toolType = input.tool.type === "codex" ? "codex" : "claude_code";
      return {
        exitCode: 0,
        result: {
          data: {
            userId: "5",
            teamId: input.team.id,
            agentId: "201",
            projectPath: project,
            toolType,
            targetPath:
              input.mcp.targetPath ??
              path.join(
                project,
                toolType === "codex" ? ".codex/config.toml" : ".mcp.json",
              ),
            observedAt: new Date().toISOString(),
            availability: "ready",
            fileState: "entry_missing",
            editKind: "add_entry",
            copyItems: [
              {
                scope: "entry",
                syntax: "toml",
                title: "DevLink",
                snippet: "test",
              },
            ],
            reason: "merge_toml_table",
            nextActions: [],
          },
        },
      };
    },
    runStatus: async (paths) => {
      calls.push({ kind: "status", config: paths.config });
      if (statusErrors.has(paths.config)) throw statusErrors.get(paths.config);
      if (statusOverrides.has(paths.config))
        return statusOverrides.get(paths.config);
      const input = inputs.get(paths.config);
      return {
        exitCode: 0,
        result: {
          data: {
            userId: "5",
            teamId: input?.team.id ?? "2",
            toolType: input?.tool.type === "codex" ? "codex" : "claude_code",
            projectPath: input?.project.path ?? f.root,
            agentId: "201",
            mcpConfigPath:
              input?.mcp.targetPath ??
              path.join(
                input?.project.path ?? f.root,
                input?.tool.type === "codex"
                  ? ".codex/config.toml"
                  : ".mcp.json",
              ),
            connection: {
              setupReady: !notReady.has(paths.config),
              hostSession: "unbound",
              collaborationReady: false,
            },
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
        agent: input.agent,
        input,
      });
      inputs.set(paths.config, input);
      // CLI가 새 프로필 설정 파일을 만드는 동작
      await writeFile(
        paths.config,
        JSON.stringify({ serverUrl: paths.serverUrl }),
      );
      return {
        exitCode: setupError.code === "SETUP_MANUAL_ACTION_REQUIRED" ? 3 : 6,
        error: {
          ...setupError,
          manualConfig: setupError.manualConfig && {
            ...setupError.manualConfig,
            suggestedTargetPath:
              input.mcp.targetPath ??
              path.join(
                input.project.path,
                input.tool.type === "codex"
                  ? ".codex/config.toml"
                  : ".mcp.json",
              ),
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
              filePaths: [picked],
            }),
          },
          ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
          shell: { openPath: async () => "" },
        };
      if (name === "./setup-runner") return runner;
      if (name === "./setup-profiles")
        return {
          listTeamProfiles,
          prepareAccountProfile,
          readProfileAgent,
          readSavedBinding,
          resolveProjectPaths,
        };
      return require(name);
    },
  });
  module.exports.registerSetupHandlers(window, frame.origin);
  return {
    ...f,
    calls,
    window,
    notReady,
    guideFailures,
    statusErrors,
    statusOverrides,
    pick: (folder) => {
      picked = folder;
    },
    setAuthenticatedUser: (id) => {
      authenticatedUser = id;
    },
    setSetupError: (error) => {
      setupError = error;
    },
    setGuideBarrier: (promise) => {
      guideBarrier = promise;
    },
    setSessionState: (state) => {
      sessionState = state;
    },
    invoke: (name, ...args) => handlers.get(`devlink:${name}`)(event, ...args),
  };
}

function setupConfigs(calls) {
  return calls
    .filter((call) => call.kind === "setup")
    .map((call) => call.config);
}

test("IPC 담당 정보는 검증·정규화하고 재시도 시 보존하며 생략 시 CLI 기본값·프로필을 따른다", async (t) => {
  const f = await ipcFixture(t);
  let selection = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selection.id, "codex", undefined, {
    part: "BACKEND",
    roles: [" API ", "API", "인증"],
  });
  const custom = f.calls.find((call) => call.kind === "setup").agent;
  assert.equal(custom.part, "BACKEND");
  assert.deepEqual(Array.from(custom.roles), ["API", "인증"]);

  await f.invoke("setup", selection.id, "codex");
  const retried = f.calls.filter((call) => call.kind === "setup").at(-1).agent;
  assert.equal(retried.part, "BACKEND");
  assert.deepEqual(Array.from(retried.roles), ["API", "인증"]);

  selection = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selection.id, "codex");
  const defaults = f.calls.filter((call) => call.kind === "setup").at(-1).agent;
  assert.equal(defaults.part, undefined);
  assert.equal(defaults.roles, undefined);
});

test("IPC의 잘못된 담당 정보는 세션 확인과 CLI 실행 전에 거부한다", async (t) => {
  const f = await ipcFixture(t);
  const selection = await f.invoke("pickFolder", accountB);
  for (const metadata of [
    { part: "backend" },
    { part: null },
    { roles: null },
    { roles: "API" },
    { roles: [" "] },
    { roles: [null] },
    { roles: ["😀".repeat(33)] },
    { roles: Array(11).fill("API") },
    { unexpected: true },
  ]) {
    await assert.rejects(
      f.invoke("setup", selection.id, "codex", undefined, metadata),
      /담당 파트/,
    );
  }
  assert.equal(f.calls.length, 0);
});

test("IPC 상태 조회·설정·수동 확인은 같은 프로젝트 프로필을 사용하고 계정을 바꿔도 유지된다", async (t) => {
  const f = await ipcFixture(t);
  const empty = await f.invoke("status", accountB);
  assert.equal(empty.result.data.connection.setupReady, false);
  assert.equal(empty.hasSavedConnections, false);
  assert.equal(f.calls.length, 0);

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
  const ready = await f.invoke("status", accountB);
  assert.equal(f.calls.at(-1).config, configs[0]);
  assert.equal(ready.result.data.connection.setupReady, true);
  assert.equal(ready.hasSavedConnections, true);
});

test("같은 계정의 두 번째 프로젝트와 다른 팀은 별도 프로필로 연결하고 팀 상태는 해당 팀 프로필만 본다", async (t) => {
  const f = await ipcFixture(t);
  const connect = async (account, folder) => {
    f.pick(folder);
    const selection = await f.invoke("pickFolder", account);
    assert.equal(
      (await f.invoke("setup", selection.id, "codex")).state,
      "manual",
    );
    return setupConfigs(f.calls).at(-1);
  };
  const first = await connect(accountB, f.root);
  const second = await connect(accountB, f.other);
  const otherTeam = await connect({ ...accountB, teamId: 7 }, f.root);
  assert.equal(new Set([f.paths.config, first, second, otherTeam]).size, 4);
  assert.equal(await connect(accountB, f.root), first);

  f.notReady.add(first);
  f.calls.length = 0;
  const status = await f.invoke("status", accountB);
  assert.equal(status.result.data.connection.setupReady, true);
  assert.equal(status.result.data.projectPath, await realpath(f.other));
  assert.ok(f.calls.every((call) => [first, second].includes(call.config)));

  f.notReady.add(second);
  const offline = await f.invoke("status", accountB);
  assert.equal(offline.result.data.connection.setupReady, false);
  assert.equal(offline.hasSavedConnections, false);
  f.calls.length = 0;
  assert.equal(
    (await f.invoke("status", { ...accountB, teamId: 7 })).result.data
      .connection.setupReady,
    true,
  );
  assert.deepEqual(
    f.calls.map((call) => call.config),
    [otherTeam],
  );
});

test("같은 폴더를 Codex와 Claude Code로 각각 연결하면 별도 프로필·Agent로 목록에 함께 표시한다", async (t) => {
  const f = await ipcFixture(t);
  f.pick(f.other);
  const connect = async (tool) => {
    const selection = await f.invoke("pickFolder", accountB);
    assert.deepEqual(Array.from(selection.tools), ["codex", "claude-code"]);
    assert.equal((await f.invoke("setup", selection.id, tool)).state, "manual");
    return f.calls.filter((call) => call.kind === "setup").at(-1);
  };
  const codex = await connect("codex");
  const claude = await connect("claude-code");
  assert.notEqual(codex.config, claude.config);
  assert.equal(codex.input.agent.action, "create");
  assert.equal(claude.input.agent.action, "create");
  assert.equal(codex.input.project.path, claude.input.project.path);
  assert.equal(
    codex.input.mcp.targetPath,
    path.join(await realpath(f.other), ".codex", "config.toml"),
  );
  assert.equal(
    claude.input.mcp.targetPath,
    path.join(await realpath(f.other), ".mcp.json"),
  );
  assert.equal((await connect("codex")).config, codex.config);

  const saved = await f.invoke("listConnections", accountB);
  assert.deepEqual(Array.from(saved, (connection) => connection.tool).sort(), [
    "claude-code",
    "codex",
  ]);
  assert.equal(
    new Set(saved.map((connection) => connection.projectPath)).size,
    1,
  );
  // 저장된 각 연결의 안내 조회도 자기 도구 프로필을 사용
  for (const connection of saved) {
    f.calls.length = 0;
    const guide = await f.invoke("getGuide", connection.id);
    assert.equal(
      guide.toolType,
      connection.tool === "codex" ? "codex" : "claude_code",
    );
    assert.deepEqual(
      f.calls.map((call) => call.config),
      [connection.tool === "codex" ? codex.config : claude.config],
    );
  }
});

test("한 도구의 손상된 프로필은 그 도구 연결만 막고 다른 도구는 연결한다", async (t) => {
  const f = await ipcFixture(t);
  const project = await realpath(f.other);
  f.pick(project);
  const claude = await resolveProjectPaths(
    f.paths,
    accountB,
    project,
    "claude-code",
  );
  await prepareAccountProfile(claude);
  await writeFile(claude.config, "{broken");
  const selection = await f.invoke("pickFolder", accountB);
  await assert.rejects(
    f.invoke("setup", selection.id, "claude-code"),
    /기존 설정/,
  );
  assert.equal(f.calls.length, 0);
  const codex = await f.invoke("pickFolder", accountB);
  assert.equal((await f.invoke("setup", codex.id, "codex")).state, "manual");

  // 모든 도구의 프로필이 손상되면 폴더 선택에서 안내
  const codexProfile = await resolveProjectPaths(
    f.paths,
    accountB,
    project,
    "codex",
  );
  await writeFile(codexProfile.config, "{broken");
  await assert.rejects(f.invoke("pickFolder", accountB), /기존 설정/);
});

test("폴더로 다시 연결하면 폴더명이 아닌 저장된 Agent·프로젝트 이름을 사용한다", async (t) => {
  const f = await ipcFixture(t);
  const project = await realpath(f.other);
  f.pick(project);
  const profile = await resolveProjectPaths(
    f.paths,
    accountB,
    project,
    "codex",
  );
  await bindProfile(profile.config, {
    projectRoot: project,
    state: {
      kind: "ready",
      agent: {
        agentId: 41,
        toolType: "CODEX",
        name: "api-agent",
        projectName: "API",
      },
    },
  });
  const selection = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selection.id, "codex");
  const { input, config } = f.calls.find((call) => call.kind === "setup");
  assert.equal(config, profile.config);
  assert.equal(input.agent.name, "api-agent");
  assert.equal(input.project.name, "API");

  // 다른 도구의 새 연결은 폴더명 사용
  const next = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", next.id, "claude-code");
  const created = f.calls.filter((call) => call.kind === "setup").at(-1).input;
  assert.equal(created.agent.name, path.basename(project));
});

test("토큰이 필요한 기존 Agent는 동의 후에만 같은 Agent 토큰을 발급해 연결한다", async (t) => {
  const f = await ipcFixture(t);
  f.pick(f.other);
  f.setSetupError({
    code: "SETUP_TOKEN_REQUIRED",
    message: "token required",
    known: { agentId: "77" },
  });
  const selection = await f.invoke("pickFolder", accountB);
  // 화면 요청으로는 재개·토큰 발급 인자를 전달할 수 없음
  const result = await f.invoke(
    "setup",
    selection.id,
    "codex",
    undefined,
    undefined,
    undefined,
    true,
    true,
  );
  assert.deepEqual({ ...result }, { state: "token", agentId: "77" });
  const first = f.calls.find((call) => call.kind === "setup").input;
  assert.equal(first.agent.action, "create");

  f.setSetupError({
    code: "SETUP_MANUAL_ACTION_REQUIRED",
    manualConfig: { snippet: "test config" },
  });
  assert.equal((await f.invoke("issueToken", selection.id)).state, "manual");
  const issued = f.calls.filter((call) => call.kind === "setup").at(-1).input;
  assert.deepEqual(
    { ...issued.agent },
    { action: "use", id: "77", issueToken: true },
  );
  assert.equal(issued.project.name, undefined);
  assert.equal(issued.mcp.mode, "replace");
  // 동의 요청 없이 반복 발급하지 않음
  await assert.rejects(
    f.invoke("issueToken", selection.id),
    /토큰 발급이 필요한/,
  );
});

test("동의 후 토큰 발급 결과를 확인하지 못하면 다시 발급하지 않고 한글로 안내한다", async (t) => {
  const f = await ipcFixture(t);
  f.pick(f.other);
  f.setSetupError({
    code: "SETUP_TOKEN_REQUIRED",
    message: "The known Agent requires explicit token preparation.",
    known: { agentId: "77" },
  });
  const selection = await f.invoke("pickFolder", accountB);
  assert.equal((await f.invoke("setup", selection.id, "codex")).state, "token");
  const result = await f.invoke("issueToken", selection.id);
  assert.equal(result.state, "error");
  assert.equal(result.code, "SETUP_TOKEN_REQUIRED");
  assert.match(result.message, /발급 결과를 확인하지 못했습니다/);
  assert.equal(
    f.calls.filter((call) => call.kind === "setup").at(-1).input.agent
      .issueToken,
    true,
  );
  // 같은 연결에서 동의 없이 바로 재발급하지 않음
  await assert.rejects(
    f.invoke("issueToken", selection.id),
    /토큰 발급이 필요한/,
  );
});

test("팀 상태 조회는 한 프로필이 실패해도 준비된 다른 프로필을 확인한다", async (t) => {
  const f = await ipcFixture(t);
  for (const folder of [f.root, f.other]) {
    f.pick(folder);
    const selection = await f.invoke("pickFolder", accountB);
    await f.invoke("setup", selection.id, "codex");
  }
  const profiles = await listTeamProfiles(f.paths, accountB);
  const failure = new Error("CLI timeout");
  f.statusErrors.set(profiles[0].config, failure);
  f.calls.length = 0;
  const status = await f.invoke("status", accountB);
  assert.equal(status.result.data.connection.setupReady, true);
  assert.deepEqual(
    f.calls.map((call) => call.config),
    profiles.map((profile) => profile.config),
  );

  f.notReady.add(profiles[1].config);
  await assert.rejects(
    f.invoke("status", accountB),
    (error) => error === failure,
  );
});

test("프로필 충돌은 원래 오류 코드와 함께 도구 확인 안내를 돌려준다", async (t) => {
  const f = await ipcFixture(t);
  f.setSetupError({ code: "SETUP_PROFILE_CONFLICT", message: "conflict" });
  const selection = await f.invoke("pickFolder", accountB);
  const result = await f.invoke("setup", selection.id, "codex");
  assert.equal(result.state, "error");
  assert.equal(result.code, "SETUP_PROFILE_CONFLICT");
  assert.match(result.message, /다른 연결 설정/);
});

test("기존 Agent와 담당 정보가 다르면 한글 안내를 돌려주고 비운 담당 정보로 다시 연결한다", async (t) => {
  const f = await ipcFixture(t);
  f.setSetupError({
    code: "SETUP_AGENT_BINDING_CONFLICT",
    message: "Agent identity, metadata or binding differs.",
  });
  const selection = await f.invoke("pickFolder", accountB);
  const result = await f.invoke("setup", selection.id, "codex", undefined, {
    part: "BACKEND",
    roles: ["API"],
  });
  assert.equal(result.state, "error");
  assert.equal(result.code, "SETUP_AGENT_BINDING_CONFLICT");
  assert.match(result.message, /비워 두고/);

  const retried = await f.invoke("setup", selection.id, "codex", undefined, {});
  const cleared = f.calls.filter((call) => call.kind === "setup").at(-1).agent;
  assert.equal(cleared.part, undefined);
  assert.equal(cleared.roles, undefined);
  // 담당 정보 없이 난 충돌은 이름·도구 확인 안내
  assert.equal(retried.code, "SETUP_AGENT_BINDING_CONFLICT");
  assert.doesNotMatch(retried.message, /비워 두고/);
  assert.match(retried.message, /폴더를 다시 선택/);
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

test("명시적 직접 설정은 담당 정보를 유지하고 targetPath 없이 manual로 준비한다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  const result = await f.invoke(
    "setup",
    selected.id,
    "codex",
    undefined,
    { part: "BACKEND" },
    { mcpMode: "manual" },
  );
  assert.equal(result.state, "manual");
  const input = f.calls.find((call) => call.kind === "setup").input;
  assert.equal(input.mcp.mode, "manual");
  assert.equal(input.mcp.targetPath, undefined);
  assert.equal(input.agent.part, "BACKEND");
  assert.equal((await f.invoke("getGuide", selected.id)).agentId, "201");
  for (const options of [
    { mcpMode: "replace" },
    { mcpMode: "manual", targetPath: "other" },
    [],
  ]) {
    await assert.rejects(
      f.invoke("setup", selected.id, "codex", undefined, undefined, options),
      /설정 방식/,
    );
  }
});

test("저장 프로젝트 목록·안내·검사는 준비 명령 없이 조회하고 재개는 기존 Agent를 사용한다", async (t) => {
  const f = await ipcFixture(t);
  for (const folder of [f.root, f.other]) {
    f.pick(folder);
    const selected = await f.invoke("pickFolder", accountB);
    await f.invoke("setup", selected.id, "codex", undefined, undefined, {
      mcpMode: "manual",
    });
  }
  f.calls.length = 0;
  const saved = await f.invoke("listConnections", accountB);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].config, undefined);
  assert.equal(saved[0].fingerprint, undefined);
  for (const connection of saved) {
    await f.invoke("getGuide", connection.id);
    const result = await f.invoke("inspectSetup", connection.id);
    assert.equal(result.guide.projectPath, connection.projectPath);
    assert.equal(result.connection.hostSession, "unbound");
    assert.equal(result.connection.collaborationReady, false);
  }
  assert.equal(
    f.calls.some((call) => call.kind === "setup"),
    false,
  );
  await f.invoke("resumeSetup", saved[0].id);
  const input = f.calls.find((call) => call.kind === "setup").input;
  assert.equal(input.agent.action, "use");
  assert.equal(input.agent.id, "201");
  assert.equal(input.agent.issueToken, false);
  assert.equal(input.project.name, undefined);
  assert.equal(input.mcp.mode, "manual");
});

test("계정·문서 전환과 프로필 변경은 이전 설정 핸들을 무효화한다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selected.id, "codex");
  await f.invoke("getGuide", selected.id);
  const config = setupConfigs(f.calls)[0];
  await writeFile(
    path.join(path.dirname(config), ".devlink-runtime", "broker.json"),
    "changed",
  ).catch(async () => {
    await mkdir(path.join(path.dirname(config), ".devlink-runtime"));
    await writeFile(
      path.join(path.dirname(config), ".devlink-runtime", "broker.json"),
      "changed",
    );
  });
  await assert.rejects(
    f.invoke("getGuide", selected.id),
    /프로필이나 실행 파일이 변경/,
  );
  const saved = await f.invoke("listConnections", accountB);
  await f.invoke("status", accountA);
  await assert.rejects(f.invoke("getGuide", saved[0].id), /다시 선택/);
  const again = await f.invoke("listConnections", accountB);
  f.window.webContents.emit("did-start-navigation", {
    isMainFrame: true,
    isSameDocument: false,
  });
  await assert.rejects(f.invoke("getGuide", again[0].id), /다시 선택/);
});

test("설정 조회 중 계정 컨텍스트가 바뀌면 늦게 도착한 안내를 반환하지 않는다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selected.id, "codex");
  let release;
  f.setGuideBarrier(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const pending = assert.rejects(
    f.invoke("getGuide", selected.id),
    /변경|다시 선택/,
  );
  await f.invoke("resetSetupContext");
  release();
  await pending;
});

test("같은 프로젝트의 안내 조회가 겹치면 진행 중인 결과를 함께 받고 CLI는 한 번만 실행한다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selected.id, "codex");
  let release;
  f.setGuideBarrier(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  f.calls.length = 0;
  // 개발 모드 StrictMode의 이중 effect처럼 응답 전에 같은 조회를 다시 요청
  const first = f.invoke("getGuide", selected.id);
  const second = f.invoke("getGuide", selected.id);
  assert.equal(first, second);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.agentId, "201");
  assert.equal(b, a);
  assert.equal(f.calls.filter((call) => call.kind === "guide").length, 1);

  // 완료된 뒤의 조회는 새로 실행하고, 다른 작업과 겹치면 기존처럼 거부
  f.setGuideBarrier(undefined);
  assert.equal((await f.invoke("getGuide", selected.id)).agentId, "201");
  assert.equal(f.calls.filter((call) => call.kind === "guide").length, 2);
  let releaseSetup;
  f.setGuideBarrier(
    new Promise((resolve) => {
      releaseSetup = resolve;
    }),
  );
  const listing = f.invoke("listConnections", accountB);
  await assert.rejects(f.invoke("getGuide", selected.id), /진행 중/);
  releaseSetup();
  await listing;
});

test("기존 Agent 재개에서 CLI 로그인 만료가 확인돼도 비밀번호 입력 뒤 같은 Agent로 이어간다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selected.id, "codex");
  const saved = (await f.invoke("listConnections", accountB))[0];
  f.setAuthenticatedUser(0);
  assert.equal((await f.invoke("resumeSetup", saved.id)).state, "password");
  const result = await f.invoke("resumeSetup", saved.id, "fixture-password");
  assert.equal(result.state, "manual");
  assert.equal(
    f.calls.filter((call) => call.kind === "setup").at(-1).agent.action,
    "use",
  );
});

test("재개 중 비밀번호가 틀려도 같은 연결에서 다시 입력해 이어간다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selected.id, "codex");
  const saved = (await f.invoke("listConnections", accountB))[0];
  f.setAuthenticatedUser(0);
  assert.equal((await f.invoke("resumeSetup", saved.id)).state, "password");
  f.setSetupError({ step: "authenticate", code: "SETUP_AUTH_REJECTED" });
  const rejected = await f.invoke("resumeSetup", saved.id, "wrong-password");
  assert.equal(rejected.state, "password");
  assert.match(rejected.message, /비밀번호/);
  f.setSetupError({
    code: "SETUP_MANUAL_ACTION_REQUIRED",
    manualConfig: { snippet: "test config" },
  });
  const result = await f.invoke("resumeSetup", saved.id, "fixture-password");
  assert.equal(result.state, "manual");
  const last = f.calls.filter((call) => call.kind === "setup").at(-1);
  assert.equal(last.input.user.mode, "login");
  assert.equal(last.agent.id, "201");
});

test("CLI 로그인이 만료된 저장 프로젝트는 목록에 남기고 비밀번호로 재개한다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selected.id, "codex");
  const config = f.calls.find((call) => call.kind === "setup").config;
  const runtime = path.join(path.dirname(config), ".devlink-runtime");
  await mkdir(runtime, { recursive: true });
  await writeFile(
    path.join(runtime, "agent-profile.json"),
    JSON.stringify({
      schemaVersion: 1,
      origin,
      userId: 5,
      teamId: 4,
      projectRoot: f.root,
      state: {
        kind: "ready",
        agent: { agentId: 201, teamId: 4, ownerUserId: 5, toolType: "CODEX" },
        token: "fixture",
      },
    }),
  );
  f.guideFailures.add(config);

  f.setSessionState("authenticated");
  assert.equal((await f.invoke("listConnections", accountB)).length, 0);

  f.setSessionState("expired");
  f.notReady.add(config);
  const status = await f.invoke("status", accountB);
  assert.equal(status.result.data.connection.setupReady, false);
  assert.equal(status.hasSavedConnections, true);
  const saved = await f.invoke("listConnections", accountB);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].availability, "auth_required");
  assert.equal(saved[0].agentId, "201");
  assert.equal(saved[0].projectPath, f.root);
  await assert.rejects(f.invoke("getGuide", saved[0].id));

  assert.equal((await f.invoke("resumeSetup", saved[0].id)).state, "password");
  f.guideFailures.delete(config);
  f.setSessionState(undefined);
  const result = await f.invoke("resumeSetup", saved[0].id, "fixture-password");
  assert.equal(result.state, "manual");
  const last = f.calls.filter((call) => call.kind === "setup").at(-1);
  assert.equal(last.input.user.mode, "login");
  assert.equal(last.agent.action, "use");
  assert.equal(last.agent.id, "201");
});

test("프로젝트별 검사는 다른 Agent의 준비 상태를 사용하지 않고 중지 상태는 성공으로 바꾸지 않는다", async (t) => {
  const f = await ipcFixture(t);
  const selected = await f.invoke("pickFolder", accountB);
  await f.invoke("setup", selected.id, "codex");
  const config = setupConfigs(f.calls)[0];
  const data = {
    userId: "5",
    teamId: "4",
    agentId: "999",
    toolType: "codex",
    projectPath: await realpath(f.root),
    mcpConfigPath: path.join(await realpath(f.root), ".codex", "config.toml"),
    connection: {
      broker: "running",
      setupReady: true,
      collaborationReady: true,
      hostSession: "bound",
    },
  };
  f.statusOverrides.set(config, { exitCode: 0, result: { data } });
  assert.equal((await f.invoke("inspectSetup", selected.id)).connection, null);
  f.statusOverrides.set(config, {
    exitCode: 0,
    result: {
      data: {
        connection: {
          broker: "stopped",
          setupReady: false,
          collaborationReady: false,
          hostSession: "not_checked",
        },
      },
    },
  });
  const stopped = (await f.invoke("inspectSetup", selected.id)).connection;
  assert.equal(stopped.broker, "stopped");
  assert.equal(stopped.setupReady, false);
});
