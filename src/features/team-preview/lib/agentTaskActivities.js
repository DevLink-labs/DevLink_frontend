import { taskTitle } from "@/features/tasks/utils/taskPresentation";

export function getAgentTaskActivities({ tasks, teamId, agentIds, loading = false, unavailable = false }) {
  const state = loading ? "loading" : unavailable ? "unavailable" : "idle";
  const summary = loading ? "작업 정보를 불러오는 중이에요."
    : unavailable ? "작업 정보를 확인할 수 없어요." : "진행 중인 작업이 없어요.";
  const activities = new Map(agentIds.map((id) => [id, { state, summary, activeSessionCount: 0 }]));
  if (teamId === null || loading || unavailable) return activities;

  const activeTasks = tasks
    .filter((task) => task.teamId === teamId && task.status === "IN_PROGRESS")
    .sort((left, right) => (right.lastActivityAt || right.createdAt).localeCompare(left.lastActivityAt || left.createdAt)
      || right.taskId - left.taskId);

  for (const task of activeTasks) {
    const receiverId = String(task.receiverAgent.agentId);
    const requesterId = String(task.requesterAgent.agentId);
    const participants = [[receiverId, "working"]];
    if (requesterId !== receiverId) participants.push([requesterId, "requesting"]);

    for (const [id, role] of participants) {
      const current = activities.get(id);
      if (!current) continue;
      // 직접 수행하는 작업을 우선하고 같은 역할에서는 최근 세션 표시
      if (current.activeSessionCount === 0 || (current.state === "requesting" && role === "working")) {
        activities.set(id, { state: role, summary: taskTitle(task), activeSessionCount: current.activeSessionCount + 1 });
      } else current.activeSessionCount += 1;
    }
  }

  return activities;
}
