import { apiClient } from "@/lib/apiClient";
import type { TaskDetail, TaskHistory, TaskListItem, TaskListResponse } from "../types";
import { compareSequences } from "../utils/taskPresentation";

function teamTasksPath(teamId: number): string {
  return `/web/teams/${teamId}/tasks`;
}

export const taskApi = {
  listTasks: (teamId: number, page = 0, signal?: AbortSignal) =>
    apiClient.get<TaskListResponse>(`${teamTasksPath(teamId)}?page=${page}&size=100`, signal),

  getTaskDetail: (teamId: number, taskId: number, signal?: AbortSignal) =>
    apiClient.get<TaskDetail>(`${teamTasksPath(teamId)}/${taskId}`, signal),

  getTaskHistory: (
    teamId: number,
    taskId: number,
    beforeSequence: string | null = null,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({ limit: "50" });
    if (beforeSequence !== null) params.set("beforeSequence", beforeSequence);
    return apiClient.get<TaskHistory>(
      `${teamTasksPath(teamId)}/${taskId}/events?${params}`,
      signal,
    );
  },
};

export async function getAllTeamTasks(teamId: number, signal?: AbortSignal): Promise<TaskListItem[]> {
  const tasks = new Map<number, TaskListItem>();
  let page = 0;
  let hasNext = true;

  // 생성순 페이지를 모두 읽은 뒤 최근 활동순으로 정렬
  while (hasNext) {
    const response = await taskApi.listTasks(teamId, page, signal);
    for (const task of response.items) tasks.set(task.taskId, task);
    hasNext = response.hasNext;
    page += 1;
  }

  return [...tasks.values()].sort((left, right) => {
    const leftActivity = left.lastActivityAt || left.createdAt;
    const rightActivity = right.lastActivityAt || right.createdAt;
    return rightActivity.localeCompare(leftActivity) || right.taskId - left.taskId;
  });
}

export async function getTaskUpdates(
  teamId: number,
  taskId: number,
  anchorSequence: string,
  signal?: AbortSignal,
): Promise<TaskHistory[]> {
  const pages: TaskHistory[] = [];
  let beforeSequence: string | null = null;

  // 최초에 읽은 순번까지 모두 회수해 갱신 사이에 쌓인 기록의 누락 방지
  while (true) {
    const response = await taskApi.getTaskHistory(teamId, taskId, beforeSequence, signal);
    const reachedAnchor = response.items.some((event) => compareSequences(event.sequence, anchorSequence) <= 0);
    pages.push({
      ...response,
      items: response.items.filter((event) => compareSequences(event.sequence, anchorSequence) > 0),
    });

    if (reachedAnchor || !response.hasNext || response.nextBeforeSequence === null) break;
    beforeSequence = response.nextBeforeSequence;
  }

  return pages;
}
