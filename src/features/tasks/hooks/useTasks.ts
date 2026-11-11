import { useEffect } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { getAllTeamTasks, getTaskUpdates, taskApi } from "../api/taskApi";
import type { InfiniteData } from "@tanstack/react-query";
import type { TaskDetail, TaskHistory, TaskListItem } from "../types";
import { taskKeys } from "../utils/taskKeys.js";
import { latestSequence, verifiedSequence, mergeHistoryData, mergeLiveHistory, mergeTaskSnapshots } from "../utils/taskRealtimeState.js";
import type { TaskLiveHistory } from "../utils/taskRealtimeState.js";

export { taskKeys } from "../utils/taskKeys.js";

function useStreamConnected(userId: number) {
  return useQuery({
    queryKey: taskKeys.stream(userId),
    queryFn: async () => false,
    enabled: false,
    initialData: false,
  }).data;
}

export function useTeamTasks(userId: number, teamId: number | null, autoRefresh = true) {
  const client = useQueryClient();
  const connected = useStreamConnected(userId);
  return useQuery({
    queryKey: taskKeys.list(userId, teamId),
    queryFn: async ({ signal }) => {
      const startedAt = Date.now();
      const tasks = await getAllTeamTasks(teamId!, signal);
      const snapshots = client.getQueryData<Record<string, { task: TaskDetail; receivedAt: number }>>(taskKeys.snapshots(userId));
      return mergeTaskSnapshots(tasks, snapshots, startedAt, teamId);
    },
    enabled: teamId !== null,
    staleTime: 15_000,
    refetchOnWindowFocus: autoRefresh,
    refetchOnReconnect: autoRefresh,
    refetchInterval: autoRefresh && !connected ? 30_000 : false,
  });
}

export function useTaskDetail(
  userId: number,
  teamId: number | null,
  taskId: number | null,
  autoRefresh = true,
) {
  const client = useQueryClient();
  const connected = useStreamConnected(userId);
  const query = useQuery({
    queryKey: taskKeys.detail(userId, teamId, taskId),
    queryFn: async ({ signal }) => {
      const startedAt = Date.now();
      const detail = await taskApi.getTaskDetail(teamId!, taskId!, signal);
      const snapshot = client.getQueryData<Record<string, { task: TaskDetail; receivedAt: number }>>(taskKeys.snapshots(userId))?.[String(taskId)];
      return snapshot && snapshot.receivedAt >= startedAt ? snapshot.task : detail;
    },
    enabled: teamId !== null && taskId !== null,
    staleTime: 10_000,
    refetchOnWindowFocus: autoRefresh,
    refetchOnReconnect: autoRefresh,
    refetchInterval: autoRefresh && !connected ? 20_000 : false,
  });

  useEffect(() => {
    const detail = query.data;
    if (!detail || query.isError) return;
    const listKey = taskKeys.list(userId, teamId);
    const listState = client.getQueryState<TaskListItem[]>(listKey);
    if (!listState?.data || listState.dataUpdatedAt > query.dataUpdatedAt) return;
    client.setQueryData<TaskListItem[]>(listKey, (tasks) => tasks?.map((task) => task.taskId === detail.taskId
      ? { ...task, status: detail.status, taskSummary: detail.taskSummary }
      : task), { updatedAt: listState.dataUpdatedAt });
  }, [client, userId, teamId, query.data, query.dataUpdatedAt, query.isError]);

  return query;
}

export function useTaskHistory(
  userId: number,
  teamId: number | null,
  taskId: number | null,
  autoRefresh = true,
) {
  const client = useQueryClient();
  const connected = useStreamConnected(userId);
  const historyKey = taskKeys.history(userId, teamId, taskId);
  const liveKey = taskKeys.live(userId, teamId, taskId);
  const history = useInfiniteQuery({
    queryKey: historyKey,
    queryFn: ({ signal, pageParam }) => taskApi.getTaskHistory(teamId!, taskId!, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext && lastPage.nextBeforeSequence !== null
        ? lastPage.nextBeforeSequence
        : undefined,
    enabled: teamId !== null && taskId !== null,
    // 전체 새로고침에도 과거 페이지는 유지하고 새 기록은 별도 조회
    staleTime: "static",
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });
  const live = useQuery<TaskLiveHistory>({
    queryKey: liveKey,
    queryFn: async () => ({ events: [] }),
    enabled: false,
    initialData: { events: [] },
  });
  const updates = useQuery({
    queryKey: taskKeys.updates(userId, teamId, taskId),
    queryFn: async ({ signal }) => {
      const cachedHistory = client.getQueryData<InfiniteData<TaskHistory, string | null>>(historyKey);
      const cachedLive = client.getQueryData<TaskLiveHistory>(liveKey);
      const anchor = verifiedSequence(cachedHistory, cachedLive);
      const pages = await getTaskUpdates(teamId!, taskId!, anchor, signal);
      const events = pages.flatMap((page) => page.items);
      const sequence = latestSequence({ pages, pageParams: [] }, { events: [] });
      client.setQueryData<TaskLiveHistory>(liveKey, (current) => mergeLiveHistory(current, events, pages.at(-1), sequence === "0" ? anchor : sequence));
      return pages;
    },
    enabled: teamId !== null && taskId !== null && history.data !== undefined,
    staleTime: 10_000,
    refetchOnWindowFocus: autoRefresh,
    refetchOnReconnect: autoRefresh,
    refetchOnMount: autoRefresh ? "always" : false,
    refetchInterval: autoRefresh && !connected ? 20_000 : false,
  });
  const data = mergeHistoryData(history.data, live.data);
  const error = [history.error, updates.error].find(
    (candidate) => candidate instanceof ApiError && [401, 403, 404].includes(candidate.status),
  ) ?? history.error ?? updates.error;

  return {
    ...history,
    data,
    error,
    isError: error !== null,
    isFetching: history.isFetching || updates.isFetching,
    isRefetching: history.isRefetching || updates.isFetching,
    dataUpdatedAt: Math.max(history.dataUpdatedAt, updates.dataUpdatedAt, live.dataUpdatedAt),
    refetch: () => history.data ? updates.refetch() : history.refetch(),
  };
}
