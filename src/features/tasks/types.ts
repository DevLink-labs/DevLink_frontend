export type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED";

export type TaskEventType =
  | "CREATED"
  | "ACK_PENDING"
  | "ACK_RECEIVED"
  | "DELIVERY_UNKNOWN"
  | "DELIVERY_NOT_SENT"
  | "STATUS_CHANGED"
  | "PROGRESS"
  | "QUESTION"
  | "ANSWER"
  | "NOTIFY_FAILED";

export interface TaskAgent {
  agentId: number;
  name: string;
}

export interface TaskListItem {
  taskId: number;
  teamId: number;
  taskSummary: string | null;
  requesterAgent: TaskAgent;
  receiverAgent: TaskAgent;
  status: TaskStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
}

export interface TaskListResponse {
  items: TaskListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface TaskDetail extends TaskListItem {
  teamName: string;
}

export interface TaskEvent {
  eventId: string;
  sequence: string;
  eventType: TaskEventType;
  authorAgent: TaskAgent | null;
  message: string | null;
  questionEventId: string | null;
  createdAt: string;
}

export interface TaskFile {
  fileId: number;
  relativePath: string;
  changeType: "ADDED" | "MODIFIED" | "DELETED" | "RENAMED";
  diffText: string | null;
}

export interface TaskHistory {
  taskId: number;
  prompt: string;
  resultText: string | null;
  failureReason: string | null;
  rejectionReason: string | null;
  partiallyModified: boolean;
  taskFiles: TaskFile[];
  items: TaskEvent[];
  nextBeforeSequence: string | null;
  hasNext: boolean;
}
