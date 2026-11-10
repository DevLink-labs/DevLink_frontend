const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createUpdateNotifier, describe } = require("../update-notifier");

const account = { userId: 5, email: "user@example.com", teamIds: [2] };
const scope = {
  userId: "5",
  teamId: "2",
  agentId: "201",
  toolType: "codex",
  projectPath: "C:\\work\\shop",
};

function page(updates, extra = {}) {
  return {
    exitCode: 0,
    result: {
      schemaVersion: 1,
      scope,
      updates,
      nextCursor: `cursor-${Math.random()}`,
      hasMore: false,
      cursorReset: false,
      coverage: "local",
      ...extra,
    },
  };
}

async function fixture(t, { profiles = { 2: ["a"] }, projectOf } = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "devlink-updates-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const statePath = path.join(dir, "state", "update-cursors.json");
  const calls = [];
  const replies = [];
  const shown = [];
  const create = () =>
    createUpdateNotifier({
      loadPaths: async () => ({ serverUrl: "ws://127.0.0.1:8080/" }),
      listProfiles: async (_paths, scoped) => {
        if (profiles[scoped.teamId] === "error") throw new Error("broken");
        return (profiles[scoped.teamId] ?? []).map((name) => ({
          config: path.join(dir, name, "config.json"),
        }));
      },
      runUpdates: async (paths, args) => {
        calls.push({
          profile: path.basename(path.dirname(paths.config)),
          args,
        });
        return replies.shift() ?? page([]);
      },
      projectOf,
      statePath,
      show: (items) => shown.push(items),
      intervalMs: 60_000,
    });
  return { statePath, calls, replies, shown, create };
}

async function started(f, notifier = f.create(), next = account) {
  notifier.watch(next);
  await notifier.poll();
  return notifier;
}

test("처음에는 기존 이력을 건너뛰고 이후 새 소식만 한 번씩 알린다", async (t) => {
  const f = await fixture(t);
  f.replies.push(page([], { nextCursor: "c1" }));
  const notifier = await started(f);
  assert.deepEqual(
    f.calls.map((call) => call.args),
    [["--latest"]],
  );
  assert.equal(f.shown.length, 0);

  const created = {
    eventId: "e1",
    kind: "TASK_CREATED",
    direction: "received",
    taskId: "101",
    requesterAgentId: "11",
  };
  const question = {
    eventId: "7",
    kind: "TASK_QUESTION_CREATED",
    taskId: "102",
    sequence: "1",
  };
  f.replies.push(page([created, question], { nextCursor: "c2" }));
  await notifier.poll();
  assert.deepEqual(f.calls.at(-1).args, ["--cursor", "c1", "--limit", "50"]);
  assert.deepEqual(f.shown.pop(), [
    {
      title: "새 작업 요청",
      body: "[shop] Agent 11에게서 새 작업(#101)이 도착했습니다.",
      kind: "TASK_CREATED",
      teamId: "2",
      taskId: "101",
    },
    {
      title: "새 질문",
      body: "[shop] 작업(#102)에 질문이 도착했습니다.",
      kind: "TASK_QUESTION_CREATED",
      teamId: "2",
      taskId: "102",
    },
  ]);

  // 같은 이벤트가 다시 나와도 알리지 않음
  f.replies.push(page([created], { nextCursor: "c3" }));
  await notifier.poll();
  assert.equal(f.shown.length, 0);
  notifier.stop();

  // 앱을 다시 시작해도 저장한 위치부터 이어서 조회
  const saved = JSON.parse(await readFile(f.statePath, "utf8"));
  assert.equal(Object.values(saved.profiles)[0].cursor, "c3");
  f.replies.push(page([created], { nextCursor: "c4" }));
  await started(f);
  assert.deepEqual(f.calls.at(-1).args, ["--cursor", "c3", "--limit", "50"]);
  assert.equal(f.shown.length, 0);
});

test("보낸 작업은 최신 버전만 알리고 진행 중 상태와 늦게 온 낮은 버전은 생략한다", async (t) => {
  const f = await fixture(t);
  f.replies.push(page([], { nextCursor: "c1" }));
  const notifier = await started(f);
  const sent = (eventId, taskVersion, kind, status) => ({
    eventId,
    kind,
    direction: "sent",
    taskId: "201",
    taskVersion: String(taskVersion),
    status,
  });
  f.replies.push(
    page([
      sent("s1", 1, "TASK_STATUS_CHANGED", "IN_PROGRESS"),
      sent("s2", 3, "TASK_STATUS_CHANGED", "FAILED"),
      {
        eventId: "overdue:202",
        kind: "TASK_OVERDUE",
        direction: "sent",
        taskId: "202",
        minutes: 30,
      },
    ]),
  );
  await notifier.poll();
  assert.deepEqual(
    f.shown.pop().map((item) => [item.title, item.taskId]),
    [
      ["작업 실패", "201"],
      ["결과 지연", "202"],
    ],
  );
  f.replies.push(page([sent("s3", 2, "TASK_COMPLETED", "COMPLETED")]));
  await notifier.poll();
  assert.equal(f.shown.length, 0);
});

test("이력이 초기화되면 알리지 않고, 잘못된 위치는 끝 위치부터 다시 시작한다", async (t) => {
  const f = await fixture(t);
  f.replies.push(page([], { nextCursor: "c1" }));
  const notifier = await started(f);
  const created = {
    eventId: "e1",
    kind: "TASK_CREATED",
    taskId: "101",
    requesterAgentId: "11",
  };
  f.replies.push(page([created], { cursorReset: true, nextCursor: "c2" }));
  await notifier.poll();
  assert.equal(f.shown.length, 0);

  f.replies.push({
    exitCode: 2,
    result: { schemaVersion: 1, error: { code: "UPDATES_INPUT_INVALID" } },
  });
  await notifier.poll();
  assert.deepEqual(f.calls.at(-1).args, ["--cursor", "c2", "--limit", "50"]);
  f.replies.push(page([], { nextCursor: "c3" }));
  await notifier.poll();
  assert.deepEqual(f.calls.at(-1).args, ["--latest"]);
});

test("다른 사용자 응답·실패는 위치를 옮기지 않고 hasMore면 이어서 읽는다", async (t) => {
  const f = await fixture(t);
  f.replies.push(page([], { nextCursor: "c1" }));
  const notifier = await started(f);
  const created = (id) => ({
    eventId: id,
    kind: "TASK_CREATED",
    taskId: id,
    requesterAgentId: "11",
  });

  f.replies.push(page([created("1")], { scope: { ...scope, userId: "6" } }));
  await notifier.poll();
  f.replies.push({
    exitCode: 1,
    result: { schemaVersion: 1, error: { code: "LOCAL_UPDATES_UNAVAILABLE" } },
  });
  await notifier.poll();
  assert.equal(f.shown.length, 0);

  f.replies.push(page([created("2")], { hasMore: true, nextCursor: "c2" }));
  f.replies.push(page([created("3")], { nextCursor: "c3" }));
  await notifier.poll();
  assert.deepEqual(
    f.calls.slice(-3).map((call) => call.args[1]),
    ["c1", "c1", "c2"],
  );
  assert.deepEqual(
    f.shown.pop().map((item) => item.taskId),
    ["2", "3"],
  );
});

test("여러 팀의 프로필을 한 번씩 조회하고 읽지 못한 팀은 건너뛴다", async (t) => {
  const f = await fixture(t, {
    profiles: { 2: ["a", "b"], 3: ["b"], 4: "error" },
  });
  await started(f, undefined, { ...account, teamIds: [2, 3, 4] });
  assert.deepEqual(
    f.calls.map((call) => call.profile),
    ["a", "b"],
  );
});

test("감시를 멈추거나 계정이 바뀌는 중이면 조회 결과를 알리지 않는다", async (t) => {
  const f = await fixture(t);
  f.replies.push(page([], { nextCursor: "c1" }));
  const notifier = await started(f);
  notifier.stop();
  await notifier.poll();
  assert.equal(f.calls.length, 1);

  notifier.watch(account);
  await notifier.poll();
  const created = {
    eventId: "e1",
    kind: "TASK_CREATED",
    taskId: "101",
    requesterAgentId: "11",
  };
  let release;
  const reply = page([created]);
  f.replies.push(
    new Promise((resolve) => {
      release = () => resolve(reply);
    }),
  );
  const pending = notifier.poll();
  notifier.watch({ ...account, userId: 6 });
  release();
  await pending;
  assert.equal(f.shown.length, 0);
  notifier.stop();
});

test("연결 폴더가 사라지면 프로필마다 한 번만 알림 중단을 안내하고 복구 후 다시 사라지면 또 안내한다", async (t) => {
  const missing = path.join(
    os.tmpdir(),
    `devlink-missing-project-${process.pid}`,
  );
  await rm(missing, { recursive: true, force: true });
  t.after(() => rm(missing, { recursive: true, force: true }));
  // CLI는 Windows 확장 경로 형식으로 저장
  const f = await fixture(t, { projectOf: async () => "\\\\?\\" + missing });
  const mismatch = {
    exitCode: 1,
    result: { schemaVersion: 1, error: { code: "UPDATES_BINDING_MISMATCH" } },
  };
  f.replies.push(mismatch);
  const notifier = await started(f);
  assert.equal(f.shown.length, 1);
  const [notice] = f.shown[0];
  assert.equal(notice.kind, "PROJECT_MISSING");
  assert.equal(notice.teamId, "2");
  assert.equal(notice.taskId, undefined);
  assert.ok(
    notice.body.startsWith(
      `[${path.basename(missing)}] 연결한 프로젝트 폴더를 찾을 수 없어`,
    ),
  );

  // 같은 상태가 이어지면 재시작 후에도 다시 알리지 않음
  f.replies.push(mismatch);
  await notifier.poll();
  notifier.stop();
  const restarted = f.create();
  f.replies.push(mismatch);
  await started(f, restarted);
  assert.equal(f.shown.length, 1);

  // 폴더가 복구되면 안내 상태를 지우고, 다시 사라지면 한 번 더 안내
  await mkdir(missing);
  f.replies.push(page([], { nextCursor: "c1" }));
  await restarted.poll();
  await rm(missing, { recursive: true });
  f.replies.push(mismatch);
  await restarted.poll();
  assert.equal(f.shown.length, 2);
  assert.equal(f.shown[1][0].kind, "PROJECT_MISSING");
  restarted.stop();
});

test("폴더가 남아 있거나 다른 이유로 거부되면 알림 중단을 안내하지 않는다", async (t) => {
  const f = await fixture(t, { projectOf: async () => os.tmpdir() });
  f.replies.push(
    {
      exitCode: 1,
      result: { schemaVersion: 1, error: { code: "UPDATES_BINDING_MISMATCH" } },
    },
    {
      exitCode: 1,
      result: {
        schemaVersion: 1,
        error: { code: "LOCAL_UPDATES_UNAVAILABLE" },
      },
    },
  );
  const notifier = await started(f);
  await notifier.poll();
  assert.equal(f.shown.length, 0);
  notifier.stop();
});

test("알림 문구는 지원하는 종류만 만든다", () => {
  assert.equal(
    describe({ kind: "TASK_STATUS_CHANGED", status: "IN_PROGRESS" }, "p"),
    null,
  );
  assert.equal(describe({ kind: "UNKNOWN" }, "p"), null);
  assert.equal(
    describe({ kind: "TASK_ANSWER_CREATED", taskId: "9" }, "p").body,
    "[p] 작업(#9)에 답변이 도착했습니다.",
  );
  assert.equal(
    describe(
      { kind: "TASK_STATUS_CHANGED", status: "REJECTED", taskId: "9" },
      "p",
    ).title,
    "작업 거절",
  );
  assert.equal(
    describe({ kind: "TASK_COMPLETED", taskId: "9" }, "p").title,
    "작업 완료",
  );
});
