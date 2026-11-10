const { createHash } = require("node:crypto");
const {
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} = require("node:fs/promises");
const path = require("node:path");

const MAX_PAGES = 5;
const MAX_REMEMBERED = 500;
const SENT_KINDS = ["TASK_STATUS_CHANGED", "TASK_COMPLETED"];

// 알림으로 보여줄 항목만 제목·본문 생성
function describe(update, project) {
  // 번호 뒤 조사가 어색하지 않도록 주어는 괄호로 표기
  const task = `작업(#${update.taskId})`;
  const prefix = `[${project}] `;
  switch (update.kind) {
    case "TASK_CREATED":
      return {
        title: "새 작업 요청",
        body: `${prefix}Agent ${update.requesterAgentId}에게서 새 ${task}이 도착했습니다.`,
      };
    case "TASK_QUESTION_CREATED":
      return {
        title: "새 질문",
        body: `${prefix}${task}에 질문이 도착했습니다.`,
      };
    case "TASK_ANSWER_CREATED":
      return {
        title: "새 답변",
        body: `${prefix}${task}에 답변이 도착했습니다.`,
      };
    case "TASK_COMPLETED":
      return {
        title: "작업 완료",
        body: `${prefix}보낸 ${task}이 완료됐습니다.`,
      };
    case "TASK_STATUS_CHANGED":
      if (update.status === "FAILED")
        return {
          title: "작업 실패",
          body: `${prefix}보낸 ${task}이 실패했습니다.`,
        };
      if (update.status === "REJECTED")
        return {
          title: "작업 거절",
          body: `${prefix}보낸 ${task}이 거절됐습니다.`,
        };
      return null;
    case "TASK_OVERDUE":
      return {
        title: "결과 지연",
        body: `${prefix}보낸 ${task}의 결과가 ${update.minutes}분째 없습니다.`,
      };
    default:
      return null;
  }
}

function validPage(result, account) {
  return (
    result?.schemaVersion === 1 &&
    result.scope?.userId === String(account.userId) &&
    /^[1-9]\d*$/.test(result.scope.teamId ?? "") &&
    typeof result.scope.projectPath === "string" &&
    Array.isArray(result.updates) &&
    typeof result.nextCursor === "string" &&
    result.nextCursor.length > 0
  );
}

// 오래된 기록부터 지워 보관 개수 제한
function remember(list, value) {
  list.push(value);
  if (list.length > MAX_REMEMBERED)
    list.splice(0, list.length - MAX_REMEMBERED);
}

function createUpdateNotifier({
  loadPaths,
  listProfiles,
  runUpdates,
  projectOf,
  statePath,
  show,
  intervalMs = 5_000,
}) {
  let account;
  let version = 0;
  let timer;
  let inflight;
  let state;

  async function loadState() {
    if (state) return state;
    try {
      const saved = JSON.parse(await readFile(statePath, "utf8"));
      state = saved?.schemaVersion === 1 && saved.profiles ? saved : undefined;
    } catch {
      state = undefined;
    }
    state ??= { schemaVersion: 1, profiles: {} };
    return state;
  }

  async function saveState() {
    await mkdir(path.dirname(statePath), { recursive: true });
    const temporary = `${statePath}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state), "utf8");
    await rename(temporary, statePath);
  }

  // 연결한 프로젝트 폴더가 사라져 조회가 거부되면 프로필마다 한 번만 안내
  async function missingProject(paths, current, teamId, entry, result) {
    if (
      result?.error?.code !== "UPDATES_BINDING_MISMATCH" ||
      entry.missingProject ||
      !projectOf
    )
      return [];
    const project = await projectOf(paths, { ...current, teamId }).catch(
      () => undefined,
    );
    if (!project) return [];
    const folder = project.replace(/^\\\\\?\\/, "");
    if (
      await stat(folder).then(
        () => true,
        () => false,
      )
    )
      return [];
    entry.missingProject = true;
    return [
      {
        title: "알림 중단",
        body: `[${path.basename(folder) || folder}] 연결한 프로젝트 폴더를 찾을 수 없어 이 프로젝트의 알림을 받을 수 없습니다. 폴더를 복구하거나 다시 연결해주세요.`,
        kind: "PROJECT_MISSING",
        teamId: String(teamId),
      },
    ];
  }

  async function pollProfile(paths, current, teamId) {
    const key = createHash("sha256")
      .update(path.resolve(paths.config))
      .digest("hex");
    const entry = (state.profiles[key] ??= { seen: [], versions: [] });
    // 처음 조회는 기존 이력을 건너뛰고 시작 위치만 저장
    if (!entry.cursor) {
      const { exitCode, result } = await runUpdates(paths, ["--latest"]);
      if (exitCode === 0 && validPage(result, current)) {
        entry.cursor = result.nextCursor;
        delete entry.missingProject;
        return [];
      }
      return missingProject(paths, current, teamId, entry, result);
    }
    const items = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { exitCode, result } = await runUpdates(paths, [
        "--cursor",
        entry.cursor,
        "--limit",
        "50",
      ]);
      if (result?.error?.code === "UPDATES_INPUT_INVALID") {
        delete entry.cursor;
        break;
      }
      if (exitCode !== 0 || !validPage(result, current)) {
        items.push(
          ...(await missingProject(paths, current, teamId, entry, result)),
        );
        break;
      }
      delete entry.missingProject;
      const project =
        path.basename(result.scope.projectPath) || result.scope.projectPath;
      for (const update of result.updates) {
        const id = `${update.kind}:${update.eventId}`;
        if (entry.seen.includes(id)) continue;
        remember(entry.seen, id);
        // 보낸 작업은 이미 알린 버전 이하의 상태를 무시
        if (SENT_KINDS.includes(update.kind)) {
          const taskVersion = Number(update.taskVersion);
          const known = entry.versions.find(
            ([taskId]) => taskId === update.taskId,
          );
          if (known && known[1] >= taskVersion) continue;
          if (known) known[1] = taskVersion;
          else remember(entry.versions, [update.taskId, taskVersion]);
        }
        // 이력이 초기화된 페이지는 다시 나온 항목일 수 있어 알리지 않음
        const text = !result.cursorReset && describe(update, project);
        if (!text) continue;
        const item = {
          ...text,
          kind: update.kind,
          teamId: result.scope.teamId,
          taskId: update.taskId,
        };
        const previous = SENT_KINDS.includes(update.kind)
          ? items.findIndex(
              (other) =>
                SENT_KINDS.includes(other.kind) &&
                other.taskId === update.taskId,
            )
          : -1;
        if (previous >= 0) items[previous] = item;
        else items.push(item);
      }
      entry.cursor = result.nextCursor;
      if (!result.hasMore) break;
    }
    return items;
  }

  // 조회가 진행 중이면 같은 결과를 기다림
  function poll() {
    if (!account) return inflight ?? Promise.resolve();
    inflight ??= pollAll().finally(() => {
      inflight = undefined;
    });
    return inflight;
  }

  async function pollAll() {
    const current = account;
    const started = version;
    try {
      await loadState();
      const paths = await loadPaths();
      const configs = new Set();
      const items = [];
      for (const teamId of current.teamIds) {
        const profiles = await listProfiles(paths, {
          ...current,
          teamId,
        }).catch(() => []);
        for (const profile of profiles) {
          if (configs.has(profile.config)) continue;
          configs.add(profile.config);
          items.push(
            ...(await pollProfile(profile, current, teamId).catch(() => [])),
          );
        }
      }
      if (started !== version) return;
      await saveState();
      if (items.length) show(items);
    } catch {
      /* 다음 주기에 다시 조회 */
    }
  }

  function watch(next) {
    const key = JSON.stringify([next.userId, next.email, next.teamIds]);
    if (
      account &&
      key === JSON.stringify([account.userId, account.email, account.teamIds])
    )
      return;
    version++;
    account = next;
    clearInterval(timer);
    timer = setInterval(() => void poll(), intervalMs);
    timer.unref?.();
    // 이전 계정 조회가 끝난 뒤 새 계정으로 바로 조회
    void (inflight ?? Promise.resolve()).then(poll);
  }

  function stop() {
    version++;
    account = undefined;
    clearInterval(timer);
    timer = undefined;
  }

  return { watch, stop, poll };
}

module.exports = { createUpdateNotifier, describe };
