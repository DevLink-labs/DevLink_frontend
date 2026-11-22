import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NoticeContext } from "@/hooks/useNotice";
import type { NoticeAction, NoticeKind, Notify } from "@/hooks/useNotice";
import NoticeStack from "./NoticeStack";

type Notice = {
  id: number;
  message: string;
  kind: NoticeKind;
  title?: string;
  action?: NoticeAction;
  inspected: boolean;
};

export default function NoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const latestId = useRef(0);
  const notify = useCallback<Notify>(
    (message, kind = "success", action, options) => {
      const notice: Notice = {
        id: ++latestId.current,
        message,
        kind,
        title: options?.title,
        action,
        inspected: false,
      };
      setNotices((current) => [...current, notice]);
    },
    [],
  );

  function inspectNotice(notice: Notice) {
    notice.action?.onClick();
    setNotices((current) =>
      current.map((item) =>
        item.id === notice.id ? { ...item, inspected: true } : item,
      ),
    );
  }

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <NoticeStack
        notices={notices}
        onDismiss={(id: number) =>
          setNotices((current) => current.filter((notice) => notice.id !== id))
        }
        onInspect={inspectNotice}
      />
    </NoticeContext.Provider>
  );
}
