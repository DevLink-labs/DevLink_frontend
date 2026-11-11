import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, ApiError } from "@/lib/apiClient";
import { authApi } from "@/features/auth/api/authApi";
import { agentKeys } from "@/features/agents/hooks/useAgents";
import { teamKeys } from "@/features/teams/hooks/useTeams";
import { taskKeys } from "../utils/taskKeys.js";
import { compareSequences } from "../utils/taskSequence.js";
import { mergeAgentPresence, mergeLiveHistory, mergeReadStates, mergeTaskList, observeTask, readTask, taskIsUnread, taskReadKey, taskReadStorageKey } from "../utils/taskRealtimeState.js";

function parseReads(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? mergeReadStates({}, parsed) : {};
  } catch {
    return {};
  }
}

function loadReads(userId) {
  try {
    return parseReads(localStorage.getItem(taskReadStorageKey(userId)));
  } catch {
    return {};
  }
}

function taskPayload(value) {
  const task = value?.task;
  const event = value?.event;
  if (!task || !Number.isSafeInteger(task.taskId) || !Number.isSafeInteger(task.teamId)
    || !task.requesterAgent || !task.receiverAgent || typeof task.createdAt !== "string"
    || !["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "REJECTED"].includes(task.status)) return null;
  if (event != null && (typeof event.eventId !== "string" || typeof event.sequence !== "string" || !/^\d+$/.test(event.sequence)
    || typeof event.eventType !== "string" || typeof event.createdAt !== "string")) return null;
  return { task, event: event ?? null };
}

export function useTaskRealtime({ userId, autoRefresh = true, onError }) {
  const client = useQueryClient();
  const initialReads = useMemo(() => loadReads(userId), [userId]);
  const [stored, setStored] = useState(() => ({ userId, reads: initialReads }));
  const [connection, setConnection] = useState({ userId, connected: false });
  const handlers = useRef({ autoRefresh, onError });
  const resync = useRef(() => {});
  const reads = stored.userId === userId ? stored.reads : initialReads;
  const connected = connection.userId === userId && connection.connected;

  useEffect(() => {
    handlers.current = { autoRefresh, onError };
    if (autoRefresh) resync.current();
  }, [autoRefresh, onError]);

  const updateReads = useCallback((update) => {
    setStored((previous) => {
      const base = previous.userId === userId ? previous.reads : initialReads;
      const next = update(base);
      return next === base && previous.userId === userId ? previous : { userId, reads: next };
    });
  }, [userId, initialReads]);

  const markRead = useCallback((teamId, taskId, sequence, lastActivityAt) => {
    updateReads((current) => readTask(current, teamId, taskId, sequence, lastActivityAt));
  }, [updateReads]);

  useEffect(() => {
    let active = true;
    try {
      const merged = mergeReadStates(reads, loadReads(userId));
      localStorage.setItem(taskReadStorageKey(userId), JSON.stringify(merged));
      if (merged !== reads) queueMicrotask(() => {
        if (active) updateReads((current) => mergeReadStates(current, merged));
      });
    } catch {
      // 저장이 제한된 환경에서는 현재 화면의 읽음 상태 유지
    }
    return () => { active = false; };
  }, [userId, reads, updateReads]);

  useEffect(() => {
    function receiveReadState(event) {
      if (event.key === taskReadStorageKey(userId) && event.newValue) {
        updateReads((current) => mergeReadStates(current, parseReads(event.newValue)));
      }
    }
    window.addEventListener("storage", receiveReadState);
    return () => window.removeEventListener("storage", receiveReadState);
  }, [userId, updateReads]);

  useEffect(() => {
    let active = true;
    let source = null;
    let checkedSessionAt = 0;
    let checkingSession = false;
    const abort = new AbortController();
    const presence = new Map();
    const initializedTeams = new Set();
    const seenEvents = new Set();

    function setConnected(value) {
      if (!active) return;
      setConnection({ userId, connected: value });
      client.setQueryData(taskKeys.stream(userId), value);
    }

    function observeList(query) {
      const key = query.queryKey;
      if (key[0] !== "workspace" || key[1] !== userId) return;
      if (key[2] === "tasks" && key[4] === "list" && Array.isArray(query.state.data)) {
        const initial = !initializedTeams.has(key[3]);
        initializedTeams.add(key[3]);
        updateReads((current) => query.state.data.reduce((next, task) => observeTask(next, task, null, initial), current));
      }
      if (key[2] === "agents" && key[3] === "team" && Array.isArray(query.state.data)) {
        const data = query.state.data;
        let changed = false;
        const patched = data.flatMap((agent) => {
          const latest = presence.get(`${agent.teamId}:${agent.agentId}`);
          if (!latest) return [agent];
          if (latest.deleted) {
            changed = true;
            return [];
          }
          const replacement = mergeAgentPresence(agent, latest);
          if (replacement === agent) return [agent];
          changed = true;
          return [replacement];
        });
        if (changed) client.setQueryData(key, patched);
      }
    }

    for (const query of client.getQueryCache().findAll({ queryKey: ["workspace", userId] })) observeList(query);
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") observeList(event.query);
    });

    function synchronize() {
      if (!active || !handlers.current.autoRefresh) return;
      void client.invalidateQueries({
        queryKey: taskKeys.all(userId),
        predicate: (query) => query.queryKey[4] === "list" || query.queryKey[4] === "detail",
        refetchType: "active",
      });
      void client.refetchQueries({
        queryKey: taskKeys.all(userId),
        predicate: (query) => query.queryKey.at(-1) === "updates",
        type: "active",
      });
    }
    resync.current = synchronize;

    function parseEvent(message) {
      try {
        return JSON.parse(message.data);
      } catch {
        return null;
      }
    }

    function receiveTask(message) {
      if (!active || !handlers.current.autoRefresh) return;
      const payload = taskPayload(parseEvent(message));
      if (!payload) return;
      const { task, event } = payload;
      const seenKey = event ? `${task.teamId}:${task.taskId}:${event.eventId}` : null;
      const duplicate = seenKey !== null && seenEvents.has(seenKey);
      if (seenKey !== null && !duplicate) {
        seenEvents.add(seenKey);
        if (seenEvents.size > 4096) seenEvents.delete(seenEvents.values().next().value);
      }
      const snapshotsKey = taskKeys.snapshots(userId);
      const previous = client.getQueryData(snapshotsKey)?.[String(task.taskId)];
      const newer = !previous || (event && compareSequences(event.sequence, previous.sequence ?? "0") >= 0)
        || (!event && (task.lastActivityAt || task.createdAt) >= (previous.task.lastActivityAt || previous.task.createdAt));
      if (newer) {
        client.setQueryData(snapshotsKey, (current) => ({
          ...current,
          [String(task.taskId)]: { task, sequence: event?.sequence ?? previous?.sequence ?? "0", receivedAt: Date.now() },
        }));
        client.setQueryData(taskKeys.list(userId, task.teamId), (current) => current ? mergeTaskList(current, task) : undefined);
        client.setQueryData(taskKeys.detail(userId, task.teamId, task.taskId), (current) => current ? task : undefined);
      }
      if (event && client.getQueryState(taskKeys.history(userId, task.teamId, task.taskId))) {
        client.setQueryData(taskKeys.live(userId, task.teamId, task.taskId), (current) => mergeLiveHistory(current, [event]));
      }
      updateReads((current) => observeTask(current, task, duplicate ? null : event));
      if (["COMPLETED", "FAILED", "REJECTED"].includes(task.status)) {
        void client.refetchQueries({ queryKey: taskKeys.updates(userId, task.teamId, task.taskId), exact: true, type: "active" });
      }
    }

    function receivePresence(message) {
      if (!active) return;
      const value = parseEvent(message);
      if (!value || !Number.isSafeInteger(value.teamId) || !Number.isSafeInteger(value.agentId)
        || !["ONLINE", "OFFLINE"].includes(value.status)) return;
      presence.set(`${value.teamId}:${value.agentId}`, value);
      const key = agentKeys.list(userId, value.teamId);
      const existing = client.getQueryData(key);
      if (!existing?.some((agent) => agent.agentId === value.agentId) && !value.deleted) {
        if (Array.isArray(existing) && value.agent?.agentId === value.agentId && value.agent?.teamId === value.teamId) {
          client.setQueryData(key, [...existing, { ...value.agent, status: value.status, lastSeenAt: value.lastSeenAt }]);
        } else {
          void client.invalidateQueries({ queryKey: key, exact: true });
        }
      } else {
        const query = client.getQueryCache().find({ queryKey: key, exact: true });
        if (query) observeList(query);
      }
    }

    if (typeof EventSource !== "undefined") {
      source = new EventSource(`${API_BASE_URL}/api/v1/web/events`, { withCredentials: true });
      source.addEventListener("ready", () => {
        presence.clear();
        setConnected(true);
        synchronize();
        void client.invalidateQueries({ queryKey: agentKeys.all(userId), refetchType: "active" });
        void client.invalidateQueries({ queryKey: teamKeys.all(userId), refetchType: "active" });
      });
      source.addEventListener("task-updated", receiveTask);
      source.addEventListener("agent-presence", receivePresence);
      source.addEventListener("resync", synchronize);
      source.addEventListener("subscription-replaced", () => {
        if (!active) return;
        presence.clear();
        source.close();
        setConnected(false);
      });
      source.onerror = () => {
        presence.clear();
        setConnected(false);
        if (checkingSession || Date.now() - checkedSessionAt < 10_000) return;
        checkingSession = true;
        checkedSessionAt = Date.now();
        void authApi.getMe(abort.signal).then((user) => {
          if (active && user.userId !== userId) {
            source.close();
            handlers.current.onError(new ApiError("로그인 계정이 변경되었습니다. 다시 로그인해주세요.", 401));
          }
        }).catch((error) => {
          if (active && error instanceof ApiError && [401, 403].includes(error.status)) {
            source.close();
            handlers.current.onError(error);
          }
        }).finally(() => { checkingSession = false; });
      };
    }
    return () => {
      active = false;
      source?.close();
      abort.abort();
      unsubscribe();
      resync.current = () => {};
      client.setQueryData(taskKeys.stream(userId), false);
    };
  }, [client, userId, updateReads]);

  const isUnread = useCallback((teamId, taskId) => taskIsUnread(reads[taskReadKey(teamId, taskId)]), [reads]);
  const unreadByTeam = useMemo(() => {
    const counts = {};
    for (const [key, entry] of Object.entries(reads)) {
      if (!taskIsUnread(entry)) continue;
      const team = key.split(":")[0];
      counts[team] = (counts[team] ?? 0) + 1;
    }
    return counts;
  }, [reads]);

  return { connected, isUnread, unreadByTeam, markRead };
}
