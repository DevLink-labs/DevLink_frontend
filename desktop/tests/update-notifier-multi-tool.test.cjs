const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { createUpdateNotifier } = require("../update-notifier");

const account = { userId: 5, email: "user@example.com", teamIds: [2] };

test("같은 폴더를 여러 AI 도구로 연결했으면 폴더 누락 알림을 한 번만 보낸다", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "devlink-updates-multi-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const shared = path.join(dir, "missing-shared");
  const other = path.join(dir, "missing-other");
  // 도구별 프로필 두 개는 같은 폴더, 나머지 하나는 다른 폴더
  const projects = { codex: shared, claude: shared, another: other };
  const shown = [];
  const notifier = createUpdateNotifier({
    loadPaths: async () => ({ serverUrl: "ws://127.0.0.1:8080/" }),
    listProfiles: async () =>
      Object.keys(projects).map((name) => ({
        config: path.join(dir, name, "config.json"),
      })),
    runUpdates: async () => ({
      exitCode: 1,
      result: { schemaVersion: 1, error: { code: "UPDATES_BINDING_MISMATCH" } },
    }),
    // CLI는 Windows 확장 경로 형식으로 저장
    projectOf: async (paths) =>
      "\\\\?\\" + projects[path.basename(path.dirname(paths.config))],
    statePath: path.join(dir, "state", "update-cursors.json"),
    show: (items) => shown.push(items),
    intervalMs: 60_000,
  });
  notifier.watch(account);
  await notifier.poll();
  notifier.stop();

  assert.equal(shown.length, 1);
  const bodies = shown[0].map((item) => item.body);
  assert.equal(bodies.length, 2);
  assert.ok(bodies[0].startsWith("[missing-shared] "));
  assert.ok(bodies[1].startsWith("[missing-other] "));
  assert.ok(shown[0].every((item) => item.kind === "PROJECT_MISSING"));
});
