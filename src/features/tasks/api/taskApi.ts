import { apiClient } from "@/lib/apiClient";
import type { TaskAcceptance, TaskDetail, TaskHistory, TaskListItem, TaskListResponse } from "../types";
import { compareSequences } from "../utils/taskPresentation";

function teamTasksPath(teamId: number): string {
  return `/web/teams/${teamId}/tasks`;
}

export const taskApi = {
  listTasks: (teamId: number, page = 0, signal?: AbortSignal) =>
    apiClient.get<TaskListResponse>(`${teamTasksPath(teamId)}?page=${page}&size=100`, signal),

  getTaskDetail: (teamId: number, taskId: number, signal?: AbortSignal) =>
    apiClient.get<TaskDetail>(`${teamTasksPath(teamId)}/${taskId}`, signal),

  acceptTask: (teamId: number, taskId: number, version: number) =>
    apiClient.post<TaskAcceptance>(`${teamTasksPath(teamId)}/${taskId}/accept`, { version }),

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

  getTaskEventsAfter: (teamId: number, taskId: number, afterSequence: string, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: "50", afterSequence });
    return apiClient.get<TaskHistory>(`${teamTasksPath(teamId)}/${taskId}/events?${params}`, signal);
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
  let afterSequence = anchorSequence;

  // 마지막으로 받은 순번 이후 기록을 순서대로 회수해 누락 방지
  while (true) {
    const response = await taskApi.getTaskEventsAfter(teamId, taskId, afterSequence, signal);
    pages.push(response);

    const next = response.nextAfterSequence;
    if (!response.hasNext || !next || compareSequences(next, afterSequence) <= 0) break;
    afterSequence = next;
  }

  return pages;
}
