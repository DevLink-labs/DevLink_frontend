export function getAgentSessionConnections(tasks, teamId, members) {
  if (teamId === null) return [];

  const agentIds = new Set(members.flatMap((member) => member.agents.map((agent) => agent.id)));
  const connections = new Map();
  const activeTasks = tasks
    .filter((task) => task.teamId === teamId && task.status === "IN_PROGRESS")
    .sort((a, b) => a.taskId - b.taskId);

  for (const task of activeTasks) {
    const requesterAgentId = String(task.requesterAgent.agentId);
    const receiverAgentId = String(task.receiverAgent.agentId);
    if (
      requesterAgentId === receiverAgentId
      || !agentIds.has(requesterAgentId)
      || !agentIds.has(receiverAgentId)
    ) continue;

    const id = [requesterAgentId, receiverAgentId].sort().join(":");
    const connection = connections.get(id);
    if (connection) connection.sessionCount += 1;
    else connections.set(id, { id, requesterAgentId, receiverAgentId, sessionCount: 1 });
  }

  return [...connections.values()].sort((a, b) => a.id.localeCompare(b.id));
}
