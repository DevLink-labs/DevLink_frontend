import { compareSequences } from "./taskSequence.js";
import { replaceEqualDeep } from "@tanstack/react-query";

export function mergeAgentPresence(agent, latest) {
  return replaceEqualDeep(agent, { ...agent, ...latest.agent, status: latest.status, lastSeenAt: latest.lastSeenAt });
}

export function mergeEvents(existing = [], incoming = []) {
  const events = new Map(existing.map((event) => [event.eventId, event]));
  for (const event of incoming) events.set(event.eventId, event);
  return [...events.values()].sort((left, right) => compareSequences(left.sequence, right.sequence));
}

export function latestSequence(history, live) {
  const events = [...(history?.pages ?? []).flatMap((page) => page.items), ...(live?.events ?? [])];
  return events.reduce((latest, event) => compareSequences(event.sequence, latest) > 0 ? event.sequence : latest, "0");
}

export function verifiedSequence(history, live) {
  const historySequence = latestSequence(history);
  const checkpoint = live?.metadataSequence ?? "0";
  return compareSequences(checkpoint, historySequence) > 0 ? checkpoint : historySequence;
}

export function mergeLiveHistory(current, events, metadata, metadataSequence = "0") {
  const prior = current ?? { events: [] };
  const acceptMetadata = metadata && compareSequences(metadataSequence, prior.metadataSequence ?? "0") >= 0;
  return {
    ...prior,
    events: mergeEvents(prior.events, events),
    ...(acceptMetadata ? { metadata, metadataSequence } : {}),
  };
}

export function mergeHistoryData(history, live) {
  if (!history?.pages.length || !live) return history;
  const first = history.pages[0];
  const metadata = live.metadata ?? first;
  return {
    ...history,
    pages: [{
      ...metadata,
      items: mergeEvents(first.items, live.events),
      nextBeforeSequence: first.nextBeforeSequence,
      hasNext: first.hasNext,
    }, ...history.pages.slice(1)],
  };
}

export function mergeTaskList(existing, task) {
  return [...existing.filter((item) => item.taskId !== task.taskId), task].sort((left, right) =>
    (right.lastActivityAt || right.createdAt).localeCompare(left.lastActivityAt || left.createdAt)
    || right.taskId - left.taskId);
}

export function mergeTaskSnapshots(tasks, snapshots, startedAt, teamId) {
  let merged = tasks;
  for (const snapshot of Object.values(snapshots ?? {})) {
    if (snapshot.task.teamId === teamId && snapshot.receivedAt >= startedAt) merged = mergeTaskList(merged, snapshot.task);
  }
  return merged;
}

export function taskReadStorageKey(userId) {
  return `devlink:${userId}:task-read-state`;
}

export function taskReadKey(teamId, taskId) {
  return `${teamId}:${taskId}`;
}

export function taskActivity(task) {
  return task.lastActivityAt || task.createdAt || "";
}

export function observeTask(reads, task, event = null, initial = false) {
  const key = taskReadKey(task.teamId, task.taskId);
  const previous = reads[key];
  const activity = taskActivity(task);
  const sequence = event?.sequence ?? "0";
  if (!previous) {
    return { ...reads, [key]: {
      readSequence: "0",
      latestSequence: sequence,
      readActivity: initial ? activity : "",
      latestActivity: activity,
      receivedEvents: event ? { [event.eventId]: sequence } : {},
      readEvents: {},
    } };
  }
  const latest = compareSequences(sequence, previous.latestSequence) > 0 ? sequence : previous.latestSequence;
  const latestActivity = activity > previous.latestActivity ? activity : previous.latestActivity;
  const receivedEvents = previous.receivedEvents ?? {};
  const unseen = event && !Object.hasOwn(receivedEvents, event.eventId);
  if (latest === previous.latestSequence && latestActivity === previous.latestActivity && !unseen) return reads;
  return { ...reads, [key]: {
    ...previous,
    latestSequence: latest,
    latestActivity,
    ...(unseen ? { receivedEvents: { ...receivedEvents, [event.eventId]: sequence } } : {}),
  } };
}

export function readTask(reads, teamId, taskId, sequence, activity = "") {
  const key = taskReadKey(teamId, taskId);
  const previous = reads[key];
  if (!previous) return reads;
  const readSequence = sequence && compareSequences(sequence, previous.readSequence) > 0 ? sequence : previous.readSequence;
  const readActivity = activity > previous.readActivity ? activity : previous.readActivity;
  const readEvents = { ...previous.readEvents };
  let changed = false;
  for (const id of Object.keys(previous.receivedEvents ?? {})) {
    if (readEvents[id]) continue;
    readEvents[id] = true;
    changed = true;
  }
  if (readSequence === previous.readSequence && readActivity === previous.readActivity && !changed) return reads;
  return { ...reads, [key]: { ...previous, readSequence, readActivity, readEvents } };
}

export function taskIsUnread(entry) {
  return Boolean(entry && (compareSequences(entry.latestSequence, entry.readSequence) > 0
    || entry.latestActivity > entry.readActivity
    || Object.keys(entry.receivedEvents ?? {}).some((id) => !entry.readEvents?.[id])));
}

function eventRecords(value, read = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, sequence]) => /^\d+$/.test(id)
    && (read ? sequence === true : typeof sequence === "string" && /^\d+$/.test(sequence))));
}

function sameRecords(left = {}, right = {}) {
  return Object.keys(left).length === Object.keys(right).length
    && Object.keys(left).every((key) => left[key] === right[key]);
}

export function mergeReadStates(current, incoming) {
  const merged = { ...current };
  let changed = false;
  for (const [key, value] of Object.entries(incoming)) {
    if (!/^\d+:\d+$/.test(key) || !value || !["readSequence", "latestSequence", "readActivity", "latestActivity"].every((field) => typeof value[field] === "string")
      || !/^\d+$/.test(value.readSequence) || !/^\d+$/.test(value.latestSequence)) continue;
    const prior = merged[key];
    const receivedEvents = { ...prior?.receivedEvents, ...eventRecords(value.receivedEvents) };
    const readEvents = { ...prior?.readEvents, ...eventRecords(value.readEvents, true) };
    merged[key] = prior ? {
      readSequence: compareSequences(value.readSequence, prior.readSequence) > 0 ? value.readSequence : prior.readSequence,
      latestSequence: compareSequences(value.latestSequence, prior.latestSequence) > 0 ? value.latestSequence : prior.latestSequence,
      readActivity: value.readActivity > prior.readActivity ? value.readActivity : prior.readActivity,
      latestActivity: value.latestActivity > prior.latestActivity ? value.latestActivity : prior.latestActivity,
      receivedEvents,
      readEvents,
    } : { ...value, receivedEvents, readEvents };
    if (!prior || ["readSequence", "latestSequence", "readActivity", "latestActivity"].some((field) => merged[key][field] !== prior[field])
      || !sameRecords(receivedEvents, prior.receivedEvents) || !sameRecords(readEvents, prior.readEvents)) changed = true;
  }
  return changed ? merged : current;
}
