import test from "node:test";
import assert from "node:assert/strict";
import { getAgentSessionConnections } from "./agentSessionConnections.js";

const members = [{ agents: [{ id: "1" }, { id: "2" }, { id: "3" }] }];

function task(taskId, requester, receiver, status = "PENDING", teamId = 1) {
  return {
    taskId,
    teamId,
    requesterAgent: { agentId: requester },
    receiverAgent: { agentId: receiver },
    status,
  };
}

test("수락 대기 요청은 방향별로 집계하고 같은 Agent 간 진행 중 연결과 함께 유지", () => {
  const connections = getAgentSessionConnections([
    task(8, 2, 1),
    task(7, 1, 2),
    task(6, 1, 2),
    task(5, 1, 2, "IN_PROGRESS"),
    task(4, 2, 1, "IN_PROGRESS"),
  ], 1, members);

  assert.deepEqual(connections, [
    { id: "1:2", requesterAgentId: "2", receiverAgentId: "1", sessionCount: 2, status: "IN_PROGRESS" },
    { id: "pending:1:2", requesterAgentId: "1", receiverAgentId: "2", sessionCount: 2, status: "PENDING" },
    { id: "pending:2:1", requesterAgentId: "2", receiverAgentId: "1", sessionCount: 1, status: "PENDING" },
  ]);
});

test("현재 팀의 알려진 서로 다른 Agent 사이에 있는 대기·진행 중 요청만 연결", () => {
  const connections = getAgentSessionConnections([
    task(1, 1, 2),
    task(2, 2, 3, "IN_PROGRESS"),
    task(3, 1, 3, "PENDING", 2),
    task(4, 1, 1),
    task(5, 1, 99),
    task(6, 99, 1, "IN_PROGRESS"),
    task(7, 1, 3, "COMPLETED"),
    task(8, 1, 3, "FAILED"),
    task(9, 1, 3, "REJECTED"),
  ], 1, members);

  assert.deepEqual(connections.map(({ id }) => id), ["2:3", "pending:1:2"]);
  assert.deepEqual(getAgentSessionConnections([task(1, 1, 2)], null, members), []);
});

test("동일 요청 목록은 입력 순서와 무관하게 동일한 연결과 방향을 반환", () => {
  const tasks = [task(3, 3, 1), task(2, 2, 1, "IN_PROGRESS"), task(1, 1, 2, "IN_PROGRESS")];
  const original = [...tasks];

  assert.deepEqual(
    getAgentSessionConnections(tasks, 1, members),
    getAgentSessionConnections([...tasks].reverse(), 1, members),
  );
  assert.deepEqual(tasks, original);
});

test("수락과 종료 상태를 반영하면 대기 연결이 진행 중 연결로 바뀌고 제거", () => {
  assert.equal(getAgentSessionConnections([task(1, 1, 2)], 1, members)[0].status, "PENDING");
  const accepted = getAgentSessionConnections([task(1, 1, 2, "IN_PROGRESS")], 1, members);
  assert.deepEqual(accepted.map(({ id, status }) => ({ id, status })), [{ id: "1:2", status: "IN_PROGRESS" }]);
  assert.deepEqual(getAgentSessionConnections([task(1, 1, 2, "COMPLETED")], 1, members), []);
});
