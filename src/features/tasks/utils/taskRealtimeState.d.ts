import type { InfiniteData } from "@tanstack/react-query";
import type { TaskEvent, TaskHistory, TaskListItem } from "../types";
import type { Agent } from "@/features/agents/types";

export function mergeAgentPresence(agent: Agent, latest: { agent?: Partial<Agent>; status: Agent["status"]; lastSeenAt: string | null }): Agent;

export interface TaskLiveHistory {
  events: TaskEvent[];
  metadata?: TaskHistory;
  metadataSequence?: string;
}
export interface TaskReadEntry {
  readSequence: string;
  latestSequence: string;
  readActivity: string;
  latestActivity: string;
  receivedEvents?: Record<string, string>;
  readEvents?: Record<string, true>;
}
export type TaskReadState = Record<string, TaskReadEntry>;
export function mergeEvents(existing?: TaskEvent[], incoming?: TaskEvent[]): TaskEvent[];
export function latestSequence(history?: InfiniteData<TaskHistory, string | null>, live?: TaskLiveHistory): string;
export function verifiedSequence(history?: InfiniteData<TaskHistory, string | null>, live?: TaskLiveHistory): string;
export function mergeLiveHistory(current: TaskLiveHistory | undefined, events: TaskEvent[], metadata?: TaskHistory, metadataSequence?: string): TaskLiveHistory;
export function mergeHistoryData(history: InfiniteData<TaskHistory, string | null> | undefined, live?: TaskLiveHistory): InfiniteData<TaskHistory, string | null> | undefined;
export function mergeTaskList(existing: TaskListItem[], task: TaskListItem): TaskListItem[];
export function mergeTaskSnapshots(tasks: TaskListItem[], snapshots: Record<string, { task: TaskListItem; receivedAt: number }> | undefined, startedAt: number, teamId: number | null): TaskListItem[];
export function taskReadStorageKey(userId: number): string;
export function taskReadKey(teamId: number, taskId: number): string;
export function taskActivity(task: TaskListItem): string;
export function observeTask(reads: TaskReadState, task: TaskListItem, event?: TaskEvent | null, initial?: boolean): TaskReadState;
export function readTask(reads: TaskReadState, teamId: number, taskId: number, sequence: string | null, activity?: string): TaskReadState;
export function taskIsUnread(entry?: TaskReadEntry): boolean;
export function mergeReadStates(current: TaskReadState, incoming: TaskReadState): TaskReadState;
