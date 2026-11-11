import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { mergeAgentPresence, latestSequence, verifiedSequence, mergeEvents, mergeLiveHistory, mergeHistoryData, mergeTaskSnapshots, observeTask, readTask, taskIsUnread, taskReadKey, taskReadStorageKey, mergeReadStates } from "./taskRealtimeState.js";

const event = (sequence) => ({ eventId: sequence, sequence, eventType: "QUESTION", message: sequence, createdAt: `2026-11-11T01:00:${sequence}` });
const task = (taskId, teamId = 1, activity = "2026-11-11T01:00:00") => ({ taskId, teamId, createdAt: "2026-11-10T00:00:00", lastActivityAt: activity, status: "IN_PROGRESS" });
const page = (items, extra = {}) => ({ taskId: 1, prompt: "request", resultText: null, taskFiles: [], items, nextBeforeSequence: "40", hasNext: true, ...extra });

test("초기 REST 응답보다 먼저 받은 SSE 메시지를 유지하고 재전송을 중복 제거", () => {
  let live = mergeLiveHistory(undefined, [event("100")]);
  const history = { pages: [page([event("50")])], pageParams: [null] };
  live = mergeLiveHistory(live, [event("99"), event("100")]);
  const merged = mergeHistoryData(history, live);
  assert.deepEqual(merged.pages[0].items.map((item) => item.sequence), ["50", "99", "100"]);
  assert.equal(history.pages[0].items.length, 1);
});

test("복구 커서는 SSE 최대 순번을 건너뛰지 않고 검증된 REST 체크포인트만 사용", () => {
  const history = { pages: [page([event("50")])], pageParams: [null] };
  let live = mergeLiveHistory(undefined, [event("100")]);
  assert.equal(latestSequence(history, live), "100");
  assert.equal(verifiedSequence(history, live), "50");
  live = mergeLiveHistory(live, [event("99"), event("100")], page([event("99"), event("100")]), "100");
  assert.equal(verifiedSequence(history, live), "100");
});

test("실시간 결과를 병합해도 과거 기록 더 보기 커서와 기존 페이지를 보존", () => {
  const history = { pages: [page([event("50")]), page([event("39")], { nextBeforeSequence: "20" })], pageParams: [null, "40"] };
  const live = mergeLiveHistory(undefined, [event("51")], page([], { resultText: "done", nextBeforeSequence: null, hasNext: false }), "51");
  const merged = mergeHistoryData(history, live);
  assert.equal(merged.pages[0].resultText, "done");
  assert.equal(merged.pages[0].nextBeforeSequence, "40");
  assert.equal(merged.pages[0].hasNext, true);
  assert.equal(merged.pages[1], history.pages[1]);
  assert.equal(merged.pageParams, history.pageParams);
});

test("늦게 도착한 목록 GET이 진행 중 수신된 새 작업을 지우지 않음", () => {
  const snapshots = {
    2: { task: task(2), receivedAt: 101 },
    3: { task: task(3), receivedAt: 90 },
    4: { task: task(4, 2), receivedAt: 102 },
  };
  assert.deepEqual(mergeTaskSnapshots([task(1)], snapshots, 100, 1).map((item) => item.taskId), [2, 1]);
});

test("최초 목록은 읽음 기준점으로 두고 이후 새 메시지와 새 세션은 미확인 표시", () => {
  const first = task(1);
  let reads = observeTask({}, first, null, true);
  assert.equal(taskIsUnread(reads["1:1"]), false);
  reads = observeTask(reads, task(1, 1, "2026-11-11T01:01:00"), event("10"));
  reads = readTask(reads, 1, 1, "9", first.lastActivityAt);
  assert.equal(taskIsUnread(reads["1:1"]), true);
  reads = readTask(reads, 1, 1, "10", "2026-11-11T01:01:00");
  assert.equal(taskIsUnread(reads["1:1"]), false);
  reads = observeTask(reads, task(2), null, false);
  assert.equal(taskIsUnread(reads["1:2"]), true);
});

test("계정별 저장 키와 팀별 읽음 상태가 분리되고 다른 탭 병합은 반복 갱신하지 않음", () => {
  assert.notEqual(taskReadStorageKey(1), taskReadStorageKey(2));
  assert.notEqual(taskReadKey(1, 5), taskReadKey(2, 5));
  const unread = observeTask({}, task(1), event("5"));
  const read = readTask(unread, 1, 1, "5", task(1).lastActivityAt);
  const merged = mergeReadStates(unread, read);
  assert.equal(taskIsUnread(merged["1:1"]), false);
  assert.equal(mergeReadStates(merged, read), merged);
  assert.deepEqual(mergeEvents([event("9007199254740993")], [event("9007199254740992")]).map((item) => item.sequence), ["9007199254740992", "9007199254740993"]);
});

test("읽은 최대 순번보다 늦게 도착한 새 ID도 미확인 처리하고 탭 병합으로 읽음을 되돌리지 않음", () => {
  const current = task(1);
  let reads = observeTask({}, current, event("100"));
  reads = readTask(reads, 1, 1, "100", current.lastActivityAt);
  assert.equal(taskIsUnread(reads["1:1"]), false);
  const pendingOtherTab = observeTask(reads, current, event("99"));
  assert.equal(taskIsUnread(pendingOtherTab["1:1"]), true);
  reads = readTask(pendingOtherTab, 1, 1, "100", current.lastActivityAt);
  assert.equal(taskIsUnread(reads["1:1"]), false);
  reads = observeTask(reads, current, event("99"));
  assert.equal(taskIsUnread(reads["1:1"]), false);
  const merged = mergeReadStates(reads, pendingOtherTab);
  assert.equal(taskIsUnread(merged["1:1"]), false);
  assert.equal(mergeReadStates(merged, pendingOtherTab), merged);
  assert.equal(taskIsUnread(mergeReadStates(pendingOtherTab, reads)["1:1"]), false);
});

test("Agent 역할 배열이 동일하면 실제 QueryClient 캐시 구독에서 재귀 갱신하지 않음", () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const key = ["workspace", 1, "agents", "team", 1];
  const agent = { agentId: 1, teamId: 1, name: "API", status: "ONLINE", lastSeenAt: null, roles: ["DEVELOPER"] };
  const snapshot = { agent: { ...agent, roles: ["DEVELOPER"] }, status: "ONLINE", lastSeenAt: null };
  client.setQueryData(key, [agent]);
  let updates = 0;
  const unsubscribe = client.getQueryCache().subscribe((change) => {
    if (change.type !== "updated" || change.action.type !== "success") return;
    updates += 1;
    assert.ok(updates < 6);
    const current = change.query.state.data;
    const replacement = mergeAgentPresence(current[0], snapshot);
    if (replacement !== current[0]) client.setQueryData(key, [replacement]);
  });
  try {
    client.setQueryData(key, [{ ...agent, status: "OFFLINE" }]);
    assert.equal(updates, 2);
    assert.equal(client.getQueryData(key)[0].status, "ONLINE");
    assert.equal(client.getQueryData(key)[0].roles, agent.roles);
    client.setQueryData(key, client.getQueryData(key));
    assert.equal(updates, 3);
  } finally {
    unsubscribe();
    client.clear();
  }
});
