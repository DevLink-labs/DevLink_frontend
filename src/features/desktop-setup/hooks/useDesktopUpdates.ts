import { useEffect, useRef } from "react";
import { getDesktopApi } from "../api/desktopApi";
import type { DesktopTaskTarget, DesktopTaskUpdate } from "../api/desktopApi";

interface Options {
  userId: number;
  email: string;
  teamIds: number[];
  onUpdates: (items: DesktopTaskUpdate[]) => void;
  onOpenTask: (target: DesktopTaskTarget) => void;
}

// 데스크톱 앱에서만 이 PC의 작업·질문·답변 소식을 구독
export function useDesktopUpdates({
  userId,
  email,
  teamIds,
  onUpdates,
  onOpenTask,
}: Options) {
  const updates = getDesktopApi()?.updates;
  const handlers = useRef({ onUpdates, onOpenTask });
  const teamKey = teamIds.join(",");

  useEffect(() => {
    handlers.current = { onUpdates, onOpenTask };
  });

  useEffect(() => {
    if (!updates) return;
    const offUpdates = updates.onUpdates((items) =>
      handlers.current.onUpdates(items),
    );
    const offOpenTask = updates.onOpenTask((target) =>
      handlers.current.onOpenTask(target),
    );
    return () => {
      offUpdates();
      offOpenTask();
    };
  }, [updates]);

  useEffect(() => {
    if (!updates || !teamKey) return;
    void updates
      .watch({ userId, email, teamIds: teamKey.split(",").map(Number) })
      .catch(() => {});
    return () => {
      void updates.stop().catch(() => {});
    };
  }, [updates, userId, email, teamKey]);
}
