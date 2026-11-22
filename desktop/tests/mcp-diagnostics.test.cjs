const assert = require("node:assert/strict");
const { mkdtemp, mkdir, readFile, readdir, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { diagnoseMcpConfiguration, diagnosticMessage } = require("../mcp-diagnostics");
const { inspectSelectedProfile } = require("../setup-profiles");

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "devlink-diagnostics-"));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("devlink-diagnostics-"));
    await rm(root, { recursive: true, force: true });
  });
  const paths = { config: path.join(root, "config.json"), node: path.join(root, "node.exe"), entry: path.join(root, "index.js"), serverUrl: "ws://127.0.0.1:8080/" };
  const runtime = path.join(root, ".devlink-runtime");
  await mkdir(runtime);
  const expected = { userId: "3", teamId: "2", agentId: "7", project: root, tool: "codex" };
  await writeFile(path.join(runtime, "agent-profile.json"), JSON.stringify({
    origin: "http://127.0.0.1:8080/", userId: 3, teamId: 2, projectRoot: root,
    state: { kind: "ready", agent: { agentId: 7, toolType: "CODEX" } },
  }));
  const brokerFile = path.join(runtime, "broker.json");
  await writeFile(brokerFile, JSON.stringify({ schemaVersion: 1, brokerUrl: "http://127.0.0.1:5000", localToken: "secret-not-for-output" }));
  const result = { enabled: true, transport: { type: "stdio", command: paths.node, args: [paths.entry], env: { DEVLINK_BROKER_FILE: brokerFile } } };
  return { root, paths, expected, runtime, brokerFile, result };
}

test("selected legacy schema 1 snapshot without agentId remains diagnosable", async (t) => {
  const f = await fixture(t);
  const profile = await inspectSelectedProfile(f.paths, f.expected);
  assert.deepEqual(profile.issues, []);
  assert.equal(profile.snapshot.state, "present");
  assert.equal(profile.snapshot.schemaVersion, 1);
  const diagnostics = await diagnoseMcpConfiguration(f.result, f.root, f.paths);
  assert.equal(diagnostics.status, "matches");
  assert.ok(!JSON.stringify(profile).includes("secret-not-for-output"));
});

test("wrong profile path differs from rotating credentials at the same path", async (t) => {
  const f = await fixture(t);
  const before = await readFile(f.brokerFile, "utf8");
  const wrong = structuredClone(f.result);
  wrong.transport.env.DEVLINK_BROKER_FILE = path.join(f.root, "another-profile", "broker.json");
  const diagnostics = await diagnoseMcpConfiguration(wrong, f.root, f.paths);
  assert.ok(diagnostics.issues.includes("BROKER_PROFILE_PATH_MISMATCH"));
  assert.ok(diagnosticMessage(diagnostics).includes(f.brokerFile));
  assert.equal(await readFile(f.brokerFile, "utf8"), before);
  await writeFile(f.brokerFile, JSON.stringify({ schemaVersion: 1, brokerUrl: "http://127.0.0.1:6000", localToken: "rotated-secret", agentId: "7" }));
  const profile = await inspectSelectedProfile(f.paths, f.expected);
  assert.deepEqual(profile.issues, []);
  assert.equal((await diagnoseMcpConfiguration(f.result, f.root, f.paths)).status, "matches");
  assert.ok(!JSON.stringify(profile).includes("rotated-secret"));
});

test("account, team, agent, project and tool mismatches are not silently selected", async (t) => {
  const f = await fixture(t);
  for (const patch of [{ userId: "9" }, { teamId: "9" }, { agentId: "9" }, { project: path.join(f.root, "other") }, { tool: "claude-code" }]) {
    const report = await inspectSelectedProfile(f.paths, { ...f.expected, ...patch });
    assert.ok(report.issues.includes("PROFILE_IDENTITY_MISMATCH"));
    assert.equal(report.profilePath, f.paths.config);
  }
});

test("mismatching broker agent is reported but absent legacy agent is accepted", async (t) => {
  const f = await fixture(t);
  await writeFile(f.brokerFile, JSON.stringify({ schemaVersion: 1, agentId: "999", localToken: "secret-not-for-output" }));
  const report = await inspectSelectedProfile(f.paths, f.expected);
  assert.ok(report.issues.includes("BROKER_AGENT_MISMATCH"));
  assert.ok(!JSON.stringify(report).includes("secret-not-for-output"));
});

test("runtime and project paths are diagnosed without exposing arbitrary arguments or environment", async (t) => {
  const f = await fixture(t);
  const result = structuredClone(f.result);
  result.transport.command = path.join(f.root, "old-node.exe");
  result.transport.args = [path.join(f.root, "old-mcp.js"), "sensitive-argument"];
  result.transport.cwd = path.join(f.root, "other");
  result.transport.env.PRIVATE_TOKEN = "environment-secret";
  const report = await diagnoseMcpConfiguration(result, f.root, f.paths);
  assert.ok(report.issues.includes("MCP_RUNTIME_PATH_MISMATCH"));
  assert.ok(report.issues.includes("MCP_PROJECT_PATH_MISMATCH"));
  assert.ok(report.issues.includes("MCP_LAUNCH_CONFIG_MISMATCH"));
  assert.ok(!JSON.stringify(report).includes("sensitive-argument"));
  assert.ok(!JSON.stringify(report).includes("environment-secret"));
});

test("global and project config candidates are read-only and unknown effective config is explicit", async (t) => {
  const f = await fixture(t);
  const before = await readdir(f.root, { recursive: true });
  const home = path.join(f.root, "codex-home");
  const report = await diagnoseMcpConfiguration(null, f.root, f.paths, { codexHome: home });
  assert.equal(report.status, "unknown");
  assert.equal(report.sources[0].path, path.join(home, "config.toml"));
  assert.equal(report.sources[1].path, path.join(f.root, ".codex", "config.toml"));
  assert.deepEqual(await readdir(f.root, { recursive: true }), before);
});
