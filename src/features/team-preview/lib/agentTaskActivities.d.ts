import type { TaskListItem } from "@/features/tasks/types";
import type { taskTitle } from "@/features/tasks/utils/taskPresentation";
import type { PreviewAgentActivity } from "../data/previewData";

export function getAgentTaskActivities(input: {
  tasks: TaskListItem[];
  teamId: number | null;
  agentIds: string[];
  loading?: boolean;
  unavailable?: boolean;
  translateTitle?: Parameters<typeof taskTitle>[1];
}): Map<string, PreviewAgentActivity>;
