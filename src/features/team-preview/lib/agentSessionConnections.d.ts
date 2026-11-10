import type { TaskListItem } from "@/features/tasks/types";
import type { PreviewMember } from "../data/previewData";

export interface AgentSessionConnection {
  id: string;
  requesterAgentId: string;
  receiverAgentId: string;
  sessionCount: number;
}

export function getAgentSessionConnections(
  tasks: TaskListItem[],
  teamId: number | null,
  members: PreviewMember[],
): AgentSessionConnection[];
