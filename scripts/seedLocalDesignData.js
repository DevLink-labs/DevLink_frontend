import { spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoAgents, demoFileChanges, demoTasks, demoUsers } from "./localDesignFixture.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(directory, "design-seed.local");
const teamId = 2;
const viewerUserId = 1;
const origin = "http://127.0.0.1:8080";
const container = "devlink_server-postgres-1";
const prefix = "ui-design-v1-";
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, "utf8"))
  : { teamId, viewerUserId, origin, users: {}, agents: {} };

if (state.teamId !== teamId || state.viewerUserId !== viewerUserId || state.origin !== origin) {
  throw new Error("로컬 시연 데이터의 대상 팀과 계정을 확인해주세요.");
}

function saveState() {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function literal(value) {
  return value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
}

function sql(statement) {
  const result = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "devlink", "-d", "devlink", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"], {
    input: statement,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`로컬 DB 요청 실패: ${result.stderr || result.error?.message}`);
  return result.stdout.trim();
}

function client() {
  const cookies = new Map();
  return async function request(route, body) {
    let csrf;
    if (body !== undefined) csrf = await request("/auth/csrf");
    const response = await fetch(`${origin}/api/v1${route}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
        ...(body === undefined ? {} : { "Content-Type": "application/json", [csrf.headerName]: csrf.token }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
    for (const entry of response.headers.getSetCookie()) {
      const cookie = entry.split(";", 1)[0];
      const index = cookie.indexOf("=");
      cookies.set(cookie.slice(0, index), cookie.slice(index + 1));
    }
    const envelope = await response.json();
    if (!response.ok || !envelope.success) throw new Error(`${route}: HTTP ${response.status}, ${envelope.code ?? "요청 실패"}`);
    return envelope.data;
  };
}

const target = JSON.parse(sql(`SELECT json_build_object('teamId', t.id, 'name', t.name, 'viewer', u.name) FROM teams t JOIN team_members m ON m.team_id=t.id JOIN users u ON u.id=m.user_id WHERE t.id=${teamId} AND u.id=${viewerUserId};`));
if (!target) throw new Error("현재 계정이 속한 로컬 시연 팀을 찾지 못했습니다.");
console.log(`로컬 대상 확인: 팀 #${target.teamId} ${target.name} / ${target.viewer}`);

for (const user of demoUsers) {
  const existing = sql(`SELECT id FROM users WHERE email=${literal(user.email)};`);
  if (existing && !state.users[user.key]) throw new Error(`동일한 더미 이메일이 이미 있습니다: ${user.email}`);
  if (!existing) {
    const password = `Demo-${randomBytes(18).toString("base64url")}!`;
    const request = client();
    const created = await request("/auth/signup", { email: user.email, password, name: user.name, nickname: user.nickname });
    state.users[user.key] = { id: created.userId, email: user.email, password };
    saveState();
  }
}

let statement = "BEGIN;\nSELECT pg_advisory_xact_lock(2147483000, 11010);\n";
statement += "CREATE TEMP TABLE design_seed_agents (key text PRIMARY KEY, id bigint NOT NULL) ON COMMIT DROP;\n";
for (const [index, user] of demoUsers.entries()) {
  const userId = state.users[user.key].id;
  statement += `INSERT INTO team_members (team_id,user_id,role,joined_at) VALUES (${teamId},${userId},'MEMBER',(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '${index + 3} days') ON CONFLICT (team_id,user_id) DO NOTHING;\n`;
}

for (const [index, agent] of demoAgents.entries()) {
  const ownerId = agent.owner === "viewer" ? viewerUserId : state.users[agent.owner].id;
  const token = state.agents[agent.key]?.token ?? randomBytes(32).toString("base64url");
  state.agents[agent.key] = { ...state.agents[agent.key], token, name: agent.name, online: agent.online };
  const hash = createHash("sha256").update(token).digest("hex");
  const seen = index % 3 === 0 ? "NULL" : `(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '${index + 1} hours'`;
  statement += `INSERT INTO agents (team_id,owner_user_id,name,role_description,tool_type,project_name,connection_token_hash,status,last_seen_at,part,roles) VALUES (${teamId},${ownerId},${literal(agent.name)},${literal(agent.role)},${literal(agent.tool)},${literal(agent.project)},${literal(hash)},'OFFLINE',${seen},${literal(agent.part)},'[]'::jsonb) ON CONFLICT (team_id,name,tool_type) DO NOTHING;\n`;
  statement += `INSERT INTO design_seed_agents SELECT ${literal(agent.key)},id FROM agents WHERE team_id=${teamId} AND owner_user_id=${ownerId} AND name=${literal(agent.name)} AND tool_type=${literal(agent.tool)};\n`;
}
saveState();

function event(type, text, offset, author = "NULL", question = "NULL", key = null) {
  return `INSERT INTO task_events (task_id,event_type,content,created_at,author_agent_id,question_event_id,request_key) VALUES (v_task,${literal(type)},${literal(text)},v_created + INTERVAL '${offset} seconds',${author},${question},${literal(key)})`;
}

for (const [index, task] of demoTasks.entries()) {
  const prompt = JSON.stringify({ title: task.title, description: task.description });
  const started = ["IN_PROGRESS", "COMPLETED", "FAILED"].includes(task.status) ? "v_created + INTERVAL '1 minute'" : "NULL";
  const completed = ["COMPLETED", "FAILED", "REJECTED"].includes(task.status) ? "v_created + INTERVAL '40 minutes'" : "NULL";
  statement += `DO $seed$ DECLARE v_task bigint; v_from bigint; v_to bigint; v_owner bigint; v_question bigint; v_created timestamp := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '${90 + index * 12} minutes'; BEGIN
    SELECT id INTO STRICT v_from FROM design_seed_agents WHERE key=${literal(task.from)};
    SELECT id INTO STRICT v_to FROM design_seed_agents WHERE key=${literal(task.to)};
    SELECT owner_user_id INTO STRICT v_owner FROM agents WHERE id=v_from;
    IF NOT EXISTS (SELECT 1 FROM tasks WHERE requester_agent_id=v_from AND request_key=${literal(prefix + task.key)}) THEN
      INSERT INTO tasks (request_key,team_id,requester_agent_id,requester_user_id,receiver_agent_id,prompt,status,task_summary,result_text,partially_modified,created_at,delivered_at,started_at,completed_at)
      VALUES (${literal(prefix + task.key)},${teamId},v_from,v_owner,v_to,${literal(prompt)},${literal(task.status)},${literal(task.title)},${literal(task.result)},${Boolean(task.partial)},v_created,${task.status === "PENDING" ? "NULL" : "v_created + INTERVAL '20 seconds'"},${started},${completed}) RETURNING id INTO v_task;
      ${event("CREATED", "로컬 디자인 확인용 작업 요청을 생성했습니다.", 0)};
  `;
  if (task.status === "PENDING") {
    statement += `${event("PROGRESS", "수신 Agent의 수락을 기다리고 있습니다.", 30)};\n`;
  } else if (task.status !== "REJECTED") {
    statement += `${event("STATUS_CHANGED", "PENDING → IN_PROGRESS", 60)};\n`;
    statement += `${event("PROGRESS", "요청 내용을 확인하고 담당 프로젝트의 관련 파일을 검토하고 있습니다.", 90, "v_to")};\n`;
    const count = task.longHistory ? 32 : 2;
    for (let turn = 0; turn < count; turn += 1) {
      const question = turn === 0 && task.question ? task.question : `${turn + 1}차 확인: ${task.longHistory ? "대화 기록의 페이지 이동과 스크롤 위치가 유지되는지" : "이번 변경의 완료 기준과 기존 동작이 유지되는지"} 확인해주실 수 있나요?`;
      const answer = turn === 0 && task.answer ? task.answer : `${turn + 1}차 검토를 마쳤습니다. ${task.longHistory ? "기록 순서와 질문 참조가 정상이며 이전 메시지를 불러온 뒤에도 읽던 위치를 유지합니다." : "요청한 기준을 확인했고 기존 데이터 조회와 권한 처리 흐름을 유지했습니다."}`;
      statement += `${event("QUESTION", question, 120 + turn * 60, turn % 2 === 0 ? "v_from" : "v_to", "NULL", `question-${turn + 1}`)} RETURNING id INTO v_question;\n`;
      statement += `${event("ANSWER", answer, 150 + turn * 60, turn % 2 === 0 ? "v_to" : "v_from", "v_question", `answer-${turn + 1}`)};\n`;
    }
  }
  if (["COMPLETED", "FAILED", "REJECTED"].includes(task.status)) {
    statement += `${event("STATUS_CHANGED", `${task.status === "REJECTED" ? "PENDING" : "IN_PROGRESS"} → ${task.status}`, 2400)};\n`;
  }
  for (const key of task.files ?? []) {
    const file = demoFileChanges[key];
    statement += `INSERT INTO task_files (task_id,relative_path,change_type,diff_text) VALUES (v_task,${literal(file.path)},${literal(file.type)},${literal(file.diff)});\n`;
  }
  statement += "END IF; END $seed$;\n";
}

statement += `SELECT json_build_object('agents',(SELECT json_object_agg(key,id) FROM design_seed_agents),'tasks',(SELECT json_agg(json_build_object('id',id,'status',status,'title',task_summary)) FROM tasks WHERE team_id=${teamId} AND request_key LIKE ${literal(prefix + "%")}));\nCOMMIT;`;
const inserted = JSON.parse(sql(statement));
for (const [key, id] of Object.entries(inserted.agents)) state.agents[key].id = id;
state.tasks = inserted.tasks;
saveState();

const statuses = Object.fromEntries(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "REJECTED"].map((status) => [status, inserted.tasks.filter((task) => task.status === status).length]));
const validation = JSON.parse(sql(`SELECT json_build_object(
  'visibleTasks',(SELECT count(*) FROM tasks t JOIN agents a ON a.id=t.requester_agent_id JOIN agents b ON b.id=t.receiver_agent_id WHERE t.team_id=${teamId} AND t.request_key LIKE ${literal(prefix + "%")} AND (a.owner_user_id=${viewerUserId} OR b.owner_user_id=${viewerUserId})),
  'invalidQuestions',(SELECT count(*) FROM task_events e JOIN tasks t ON t.id=e.task_id LEFT JOIN task_events q ON q.id=e.question_event_id AND q.task_id=e.task_id WHERE t.request_key LIKE ${literal(prefix + "%")} AND e.event_type='ANSWER' AND (q.id IS NULL OR q.event_type<>'QUESTION')),
  'longHistoryEvents',(SELECT count(*) FROM task_events e JOIN tasks t ON t.id=e.task_id WHERE t.request_key=${literal(prefix + "running-long-history")}),
  'files',(SELECT count(*) FROM task_files f JOIN tasks t ON t.id=f.task_id WHERE t.request_key LIKE ${literal(prefix + "%")}));`));
if (validation.visibleTasks !== demoTasks.length || validation.invalidQuestions !== 0 || validation.longHistoryEvents <= 50) throw new Error(`시연 데이터 검증 실패: ${JSON.stringify(validation)}`);

const verifiedTasks = new Set();
for (const user of demoUsers) {
  const request = client();
  await request("/auth/login", { email: user.email, password: state.users[user.key].password });
  const agents = await request(`/agents/teams/${teamId}`);
  const members = await request(`/teams/${teamId}/members`);
  const tasks = await request(`/web/teams/${teamId}/tasks?page=0&size=100`);
  if (!demoAgents.every((agent) => agents.some((item) => item.agentId === state.agents[agent.key].id))) throw new Error("API Agent 목록 누락");
  if (!demoUsers.every((member) => members.some((item) => item.userId === state.users[member.key].id))) throw new Error("API 팀원 목록 누락");
  for (const task of tasks.items.filter((item) => inserted.tasks.some((seed) => seed.id === item.taskId))) {
    await request(`/web/teams/${teamId}/tasks/${task.taskId}`);
    const history = await request(`/web/teams/${teamId}/tasks/${task.taskId}/events?limit=50`);
    if (!JSON.parse(history.prompt).title || history.items.length === 0) throw new Error("API 대화 기록 누락");
    if (history.hasNext) await request(`/web/teams/${teamId}/tasks/${task.taskId}/events?limit=50&beforeSequence=${history.nextBeforeSequence}`);
    verifiedTasks.add(task.taskId);
  }
  await request("/auth/logout", {});
}
if (verifiedTasks.size !== demoTasks.length) throw new Error(`API에서 검증된 세션 수가 다릅니다: ${verifiedTasks.size}`);
console.log(JSON.stringify({ team: target, dummyMembers: demoUsers.length, dummyAgents: demoAgents.length, sessions: inserted.tasks.length, statuses, validation, apiVerifiedSessions: verifiedTasks.size }, null, 2));
