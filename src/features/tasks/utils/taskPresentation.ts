import { getLocale, t as translate } from "@/lib/i18n";
import type { TaskEvent, TaskHistory, TaskListItem, TaskStatus } from "../types";
import { compareSequences } from "./taskSequence.js";

export { compareSequences } from "./taskSequence.js";

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDING: "수락 대기",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
  FAILED: "실패",
  REJECTED: "거절",
};

export function taskTitle(
  task: Pick<TaskListItem, "taskId" | "taskSummary"> | null | undefined,
  translateTitle = translate,
): string {
  if (!task) return translateTitle("작업 기록");
  return task.taskSummary?.trim() || translateTitle("{{value0}}번 세션", { value0: task.taskId });
}

export function parseTaskPrompt(prompt: string): { title: string; description: string } {
  const fallback = { title: "", description: prompt };
  try {
    const parsed: unknown = JSON.parse(prompt);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    const fields = parsed as Record<string, unknown>;
    return {
      title: typeof fields.title === "string" ? fields.title.trim() : "",
      description: typeof fields.description === "string" ? fields.description : "",
    };
  } catch {
    return fallback;
  }
}

const timeOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
export function formatTaskTime(value: string | null | undefined, utc = false, locale = getLocale()): string {
  if (!value) return translate("기록 없음");
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasOffset ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return translate("기록 없음");
  // 오프셋 없는 시스템 시각은 서버 시간대를 추정하지 않고 원래 시각으로 표시
  return new Intl.DateTimeFormat(locale, {
    ...timeOptions,
    ...(!utc && !hasOffset ? { timeZone: "UTC" } : {}),
  }).format(date);
}

export function mergeTaskEvents(pages: TaskHistory[] | undefined): TaskEvent[] {
  const events = new Map<string, TaskEvent>();
  for (const page of pages ?? []) {
    for (const event of page.items) events.set(event.eventId, event);
  }
  return [...events.values()].sort((left, right) => compareSequences(left.sequence, right.sequence));
}
