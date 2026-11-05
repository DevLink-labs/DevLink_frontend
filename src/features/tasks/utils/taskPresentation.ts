import type { TaskEvent, TaskHistory, TaskListItem, TaskStatus } from "../types";

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDING: "대기 중",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
  FAILED: "실패",
  REJECTED: "거절",
};

export function taskTitle(task: Pick<TaskListItem, "taskId" | "taskSummary"> | null | undefined): string {
  if (!task) return "작업 기록";
  return task.taskSummary?.trim() || `작업 #${task.taskId}`;
}

const timeOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
const localFormatter = new Intl.DateTimeFormat("ko-KR", timeOptions);
const wallClockFormatter = new Intl.DateTimeFormat("ko-KR", { ...timeOptions, timeZone: "UTC" });

export function formatTaskTime(value: string | null | undefined, utc = false): string {
  if (!value) return "기록 없음";
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasOffset ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return "기록 없음";
  // 오프셋 없는 시스템 시각은 서버 시간대를 추정하지 않고 원래 시각으로 표시
  return utc || hasOffset ? localFormatter.format(date) : wallClockFormatter.format(date);
}

export function compareSequences(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+/, "") || "0";
  const normalizedRight = right.replace(/^0+/, "") || "0";
  return normalizedLeft.length - normalizedRight.length
    || normalizedLeft.localeCompare(normalizedRight);
}

export function mergeTaskEvents(pages: TaskHistory[] | undefined): TaskEvent[] {
  const events = new Map<string, TaskEvent>();
  for (const page of pages ?? []) {
    for (const event of page.items) events.set(event.eventId, event);
  }
  return [...events.values()].sort((left, right) => compareSequences(left.sequence, right.sequence));
}
