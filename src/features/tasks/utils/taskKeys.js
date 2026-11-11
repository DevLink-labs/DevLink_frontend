export const taskKeys = {
  all: (userId) => ["workspace", userId, "tasks"],
  team: (userId, teamId) => [...taskKeys.all(userId), teamId],
  list: (userId, teamId) => [...taskKeys.team(userId, teamId), "list"],
  detail: (userId, teamId, taskId) => [...taskKeys.team(userId, teamId), "detail", taskId],
  history: (userId, teamId, taskId) => [...taskKeys.team(userId, teamId), "history", taskId],
  updates: (userId, teamId, taskId) => [...taskKeys.history(userId, teamId, taskId), "updates"],
  live: (userId, teamId, taskId) => [...taskKeys.history(userId, teamId, taskId), "live"],
  stream: (userId) => ["workspace", userId, "task-stream"],
  snapshots: (userId) => ["workspace", userId, "task-snapshots"],
};
