import type { TaskListItem } from "@/features/tasks/types";
import type { PreviewAgentActivity } from "../data/previewData";

export function getAgentTaskActivities(input: {
  tasks: TaskListItem[];
  teamId: number | null;
  agentIds: string[];
  loading?: boolean;
  unavailable?: boolean;
}): Map<string, PreviewAgentActivity>;
