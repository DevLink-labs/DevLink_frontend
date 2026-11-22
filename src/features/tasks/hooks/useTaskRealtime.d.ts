export function useTaskRealtime(options: {
  userId: number;
  autoRefresh?: boolean;
  onError: (error: unknown) => void;
  onCompleted?: (task: import("../types").TaskListItem) => void;
}): {
  connected: boolean;
  isUnread: (teamId: number, taskId: number) => boolean;
  unreadByTeam: Record<string, number>;
  markRead: (teamId: number, taskId: number, sequence: string | null, lastActivityAt?: string) => void;
};
