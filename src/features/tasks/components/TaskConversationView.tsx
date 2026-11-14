import { getLocale, useTranslation, t as translate } from "@/lib/i18n";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from "react";
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from '@/components/ui'
import { ApiError } from '@/lib/apiClient'
import { taskApi } from '../api/taskApi'
import { taskKeys, useTaskDetail, useTaskHistory } from '../hooks/useTasks'
import type { TaskDetail, TaskEvent, TaskHistory } from '../types'
import { compareSequences, formatTaskTime, mergeTaskEvents, parseTaskPrompt, taskStatusLabels, taskTitle } from '../utils/taskPresentation'
import '../styles/task-conversation.css'

interface TaskConversationViewProps {
  userId: number
  teamId: number
  taskId: number
  autoRefresh: boolean
  active?: boolean;
  onRead?: (teamId: number, taskId: number, sequence: string | null, lastActivityAt?: string) => void;
  onError: (error: unknown) => void
  onBack?: () => void
}

interface TaskConversationPreviewProps {
  preview: {
    detail: TaskDetail;
    history: TaskHistory;
    enteringEventId?: string;
    followLatest?: boolean;
    capture?: boolean;
    onAccept?: () => void;
  };
  onBack?: () => void;
}

const eventLabels: Record<string, string> = {
  CREATED: '작업 생성',
  STATUS_CHANGED: '상태 변경',
  PROGRESS: '진행 기록',
  QUESTION: '질문',
  ANSWER: '답변',
}

const fileChangeLabels = { ADDED: '추가', MODIFIED: '수정', DELETED: '삭제', RENAMED: '이름 변경' }

function errorMessage(error: unknown, fallback = "기록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.") {
  return error instanceof Error ? error.message : fallback
}

function isAccessError(error: unknown): error is ApiError {
  return error instanceof ApiError && [401, 403, 404].includes(error.status)
}

function RecordTime({ value, utc = false, className }: { value: string; utc?: boolean; className?: string }) {
  const { t, i18n } = useTranslation();
  const localTime = utc || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  return <time className={className} title={localTime ? t("내 기기의 시간대 기준") : t("서버에 기록된 시각")}>{formatTaskTime(value, utc, getLocale(i18n.language))}<span className="tc-time-basis">· {localTime ? t("내 시간") : t("서버 시각")}</span></time>
}

function CollapsibleMessage({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { t } = useTranslation();
  const contentId = useId();
  const container = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const collapseFrame = useRef<number | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const collapsed = overflowing && !expanded;

  useEffect(() => {
    const body = content.current;
    const viewport = clip.current;
    if (!body || !viewport) return;

    const observer = new ResizeObserver(() => {
      const previewHeight = Number.parseFloat(getComputedStyle(viewport).getPropertyValue("--tc-preview-height"));
      setOverflowing(body.scrollHeight > previewHeight + 1);
    });
    observer.observe(body);
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      if (collapseFrame.current !== null) cancelAnimationFrame(collapseFrame.current);
    };
  }, []);

  function toggle() {
    setExpanded(!expanded);
    if (!expanded) return;
    collapseFrame.current = requestAnimationFrame(() => {
      collapseFrame.current = null;
      const message = container.current;
      const viewport = message?.closest<HTMLElement>(".tc-viewport");
      if (!message || !viewport) return;
      const messageBounds = message.getBoundingClientRect();
      const viewportBounds = viewport.getBoundingClientRect();
      if (messageBounds.top < viewportBounds.top || messageBounds.bottom > viewportBounds.bottom) {
        viewport.scrollTop += messageBounds.top - viewportBounds.top - 16;
      }
    });
  }

  return (
    <div ref={container} className={`tc-collapsible ${overflowing ? expanded ? "is-expanded" : "is-collapsed" : ""} ${className}`}>
      <div ref={clip} id={contentId} className="tc-collapsible-clip" onFocusCapture={() => {
        if (collapsed) setExpanded(true);
      }}>
        <div ref={content} className="tc-collapsible-content">{children}</div>
      </div>
      {overflowing && (
        <button type="button" className="tc-collapse-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={toggle}>
          <span>{expanded ? t("접기") : t("펼치기")}</span><Icon name="chevron" size={14} />
        </button>
      )}
    </div>
  );
}

function eventMessage(event: TaskEvent, translateMessage = translate) {
  if (event.eventType !== "STATUS_CHANGED" || event.message === null) return event.message;
  const transition = event.message.match(/^\s*(PENDING|IN_PROGRESS)\s*(?:→|->)\s*(IN_PROGRESS|COMPLETED)(?:\s*:.*)?\s*$/s);
  if (transition?.[1] === "PENDING" && transition[2] === "IN_PROGRESS") {
    return translateMessage("작업요청을 수락했습니다. (IN_PROGRESS)");
  }
  if (transition?.[1] === "IN_PROGRESS" && transition[2] === "COMPLETED") {
    return translate("작업이 완료되었습니다. (COMPLETED)");
  }
  return event.message;
}

function InitialTaskRequest({ prompt, fallbackTitle }: { prompt: string; fallbackTitle: string }) {
  const { t } = useTranslation();
  const request = parseTaskPrompt(prompt);

  return (
    <section className="tc-bubble tc-request-card" aria-label={t("최초 작업 요청")}>
      <header className="tc-request-heading">
        <span className="tc-message-kind">{t("최초 작업 요청")}</span>
        <h3>{request.title || fallbackTitle}</h3>
      </header>
      <CollapsibleMessage>
        <div className="tc-request-description">
          {request.description.trim() ? (
            <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
              h1: "h4",
              h2: "h4",
              h3: "h5",
              table: ({ children }) => <div className="tc-request-table"><table>{children}</table></div>,
              a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
            }}>
              {request.description}
            </Markdown>
          ) : <p>{t("등록된 요청 설명이 없습니다.")}</p>}
        </div>
      </CollapsibleMessage>
    </section>
  );
}

function EventMessage({ event, detail, eventsById, enter = false }: {
  event: TaskEvent
  detail: TaskDetail
  eventsById: Map<string, TaskEvent>
  enter?: boolean;
}) {
  const { t } = useTranslation();
  const conversation = event.eventType === 'QUESTION' || event.eventType === 'ANSWER'
  const author = event.authorAgent
  const requester = author?.agentId === detail.requesterAgent.agentId
  const receiver = author?.agentId === detail.receiverAgent.agentId
  const question = event.questionEventId ? eventsById.get(event.questionEventId) : undefined
  const enterClass = enter ? " tc-record-enter" : "";

  if (!conversation || !author || (!requester && !receiver)) {
    return (
      <li className={`tc-system-record${enterClass}`} data-event-id={event.eventId}>
        <span className="tc-system-symbol"><Icon name={event.eventType === 'CREATED' ? 'plus' : 'check'} size={13} /></span>
        <div>
          <div className="tc-system-meta"><strong>{t(eventLabels[event.eventType] ?? "작업 기록")}</strong><RecordTime value={event.createdAt} utc={conversation} /></div>
          {author && <span className="tc-system-author">{author.name}</span>}
          {event.questionEventId && <span className="tc-system-reference">{t("질문 #")}{event.questionEventId}{t("에 대한 답변")}</span>}
          {event.message !== null && <CollapsibleMessage><p className="tc-message-text">{eventMessage(event, t)}</p></CollapsibleMessage>}
        </div>
      </li>
    )
  }

  return (
    <li className={`tc-message-row ${requester ? 'tc-requester' : 'tc-receiver'}${enterClass}`} data-event-id={event.eventId}>
      <span className="tc-agent-avatar" aria-hidden="true"><Icon name="agent" size={18} /></span>
      <div className="tc-message-content">
        <div className="tc-message-meta"><strong>{author.name}</strong></div>
        <div className="tc-bubble">
          <span className="tc-message-kind">{t(eventLabels[event.eventType])}</span>
          <CollapsibleMessage>
            {event.questionEventId && (
              <div className="tc-question-reference">
                <span>{question ? t("질문 #{{value0}}에 대한 답변", { value0: event.questionEventId }) : t("이전 질문 #{{value0}}에 대한 답변", { value0: event.questionEventId })}</span>
                {question?.message && <p>{question.message}</p>}
              </div>
            )}
            <p className="tc-message-text">{event.message ?? t("저장된 메시지 본문이 없습니다.")}</p>
          </CollapsibleMessage>
        </div>
        <RecordTime className="tc-message-time" value={event.createdAt} utc />
      </div>
    </li>
  )
}

function TaskResult({ history, enter = false }: { history: TaskHistory; enter?: boolean }) {
  const { t } = useTranslation();
  const failed = history.failureReason !== null
  const rejected = history.rejectionReason !== null
  const text = history.resultText ?? history.failureReason ?? history.rejectionReason
  if (text === null && history.taskFiles.length === 0) return null

  return (
    <section className={`tc-result-card ${failed || rejected ? 'tc-result-attention' : ''}${enter ? " tc-record-enter" : ""}`} aria-label={t("저장된 작업 결과")}>
      <header>
        <span className="tc-result-icon"><Icon name={failed || rejected ? 'shield' : 'check'} size={18} /></span>
        <div><h3>{failed ? t("작업 실패") : rejected ? t("작업 거절") : history.resultText !== null ? t("작업 결과") : t("변경 파일")}</h3></div>
        {failed && history.partiallyModified && <span className="tc-partial-badge">{t("일부 수정됨")}</span>}
      </header>
      {text !== null && <CollapsibleMessage className="tc-result-text"><p className="tc-message-text">{text}</p></CollapsibleMessage>}
      {history.taskFiles.length > 0 && (
        <div className="tc-result-files">
          <h4>{t("변경 파일")}{" "}<span>{history.taskFiles.length}</span></h4>
          {history.taskFiles.map((file) => (
            <details className="tc-file" key={file.fileId}>
              <summary><Icon name="chevron" size={14} /><span className="tc-file-path">{file.relativePath}</span><span className="tc-file-change" data-change={file.changeType}>{t(fileChangeLabels[file.changeType], { context: "file" })}</span></summary>
              {file.diffText !== null ? <pre className="tc-file-diff"><code>{file.diffText}</code></pre> : <p className="tc-file-empty">{t("저장된 diff가 없습니다.")}</p>}
            </details>
          ))}
        </div>
      )}
    </section>
  )
}

function ConversationHeader({ taskId, detail, onBack, children }: {
  taskId: number;
  detail?: TaskDetail;
  onBack?: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const title = detail ? taskTitle(detail, t) : t("작업 #{{value0}}", { value0: taskId });

  return (
    <header className="tc-header">
      <div className="tc-heading">
        {onBack && <button type="button" className="icon-button tc-back" onClick={onBack} aria-label={t("작업 목록으로 돌아가기")}><Icon name="arrow" size={18} /></button>}
        <div>
          <h2 title={title}>{title}</h2>
          {detail && (
            <div className="tc-context">
              <p className="tc-team-name" title={t("팀 · {{value0}}", { value0: detail.teamName })}><Icon name="team" size={13} /><span>{t("팀 ·")}{" "}{detail.teamName}</span></p>
              <div className="tc-participants" aria-label={t("대화 참여 Agent")}>
                <Icon name="agent" size={13} />
                <span title={detail.requesterAgent.name}>{detail.requesterAgent.name}</span>
                <span className="tc-participant-divider" aria-hidden="true">·</span>
                <span title={detail.receiverAgent.name}>{detail.receiverAgent.name}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="tc-header-actions">
        {detail && <span key={detail.status} className={`dashboard-task-badge dashboard-task-${detail.status.toLowerCase()}`}>{t(taskStatusLabels[detail.status])}</span>}
        {children}
      </div>
    </header>
  );
}

function ConversationTimeline({ detail, history, events, enteringEventId, children }: {
  detail: TaskDetail;
  history: TaskHistory;
  events: TaskEvent[];
  enteringEventId?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const eventsById = useMemo(() => new Map(events.map((event) => [event.eventId, event])), [events]);

  return (
    <div className="tc-timeline">
      <div className="tc-history-start"><span /> <span>{t("작업 대화 기록")}</span> <span /></div>
      <div className="tc-message-row tc-requester tc-initial-request">
        <span className="tc-agent-avatar" aria-hidden="true"><Icon name="agent" size={18} /></span>
        <div className="tc-message-content">
          <div className="tc-message-meta"><strong>{detail.requesterAgent.name}</strong></div>
          <InitialTaskRequest prompt={history.prompt} fallbackTitle={taskTitle(detail, t)} />
          <RecordTime className="tc-message-time" value={detail.createdAt} />
        </div>
      </div>

      {children}

      {events.length > 0 ? (
        <ol className="tc-events">
          {events.map((event) => (
            <EventMessage key={event.eventId} event={event} detail={detail} eventsById={eventsById}
              enter={event.eventId === enteringEventId} />
          ))}
        </ol>
      ) : <div className="tc-no-events"><Icon name="book" size={18} /><p>{t("아직 저장된 대화 기록이 없습니다.")}</p><span>{t("새로운 기록이 생기면 이곳에서 확인할 수 있습니다.")}</span></div>}

      <TaskResult history={history} enter={enteringEventId !== undefined} />
      <div className="tc-latest-marker"><span />{t("현재 불러온 기록의 끝")}<span /></div>
    </div>
  );
}

function ConversationPreview({ preview, onBack }: TaskConversationPreviewProps) {
  const { t } = useTranslation();
  const { detail, history, enteringEventId, followLatest, capture, onAccept } = preview;
  const viewport = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = viewport.current;
    if (!container) return;
    const smooth = followLatest && !capture && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({ top: followLatest ? container.scrollHeight : 0, behavior: smooth ? "smooth" : "instant" });
  }, [history.items.length, followLatest, capture]);

  return (
    <section className="task-conversation demo-task-conversation" aria-label={t("작업 대화 기록")}>
      <ConversationHeader taskId={detail.taskId} detail={detail} onBack={onBack}>
        {detail.status === "PENDING" && onAccept && (
          <button type="button" className="button button-primary button-small" onClick={onAccept}>{t("수락")}</button>
        )}
      </ConversationHeader>
      <div className="tc-body">
        <div className="tc-viewport" ref={viewport} tabIndex={0} aria-label={t("작업 요청과 Agent 대화 기록")}>
          <ConversationTimeline detail={detail} history={history} events={history.items}
            enteringEventId={capture ? undefined : enteringEventId} />
        </div>
      </div>
    </section>
  );
}

function ConversationContent({ userId, teamId, taskId, autoRefresh, active = true, onRead, onError, onBack }: TaskConversationViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient()
  const [blockedError, setBlockedError] = useState<ApiError | null>(null)
  const activeTaskId = blockedError ? null : taskId
  const detailQuery = useTaskDetail(userId, teamId, activeTaskId, autoRefresh)
  const historyQuery = useTaskHistory(userId, teamId, activeTaskId, autoRefresh)
  const acceptTask = useMutation({
    mutationFn: (version: number) => taskApi.acceptTask(teamId, taskId, version),
    retry: false,
    onSuccess: (accepted) => {
      queryClient.setQueryData<TaskDetail>(taskKeys.detail(userId, teamId, taskId), (current) =>
        current?.status === "PENDING" && (current.version ?? 0) <= accepted.version
          ? { ...current, status: accepted.status, version: accepted.version, startedAt: accepted.startedAt, canAccept: false }
          : current,
      );
    },
    onError,
    onSettled: async (_accepted, error) => {
      if (error instanceof ApiError && error.status === 401) return;
      await Promise.all([
        detailQuery.refetch(),
        historyQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: taskKeys.list(userId, teamId), exact: true }),
      ]);
    },
  });
  const observedAccessError = [detailQuery.error, historyQuery.error].find(isAccessError) ?? null
  if (observedAccessError && blockedError === null) setBlockedError(observedAccessError)
  const accessError = blockedError ?? observedAccessError
  const detail = accessError ? undefined : detailQuery.data
  const acceptVersion = detail?.canAccept === true && detail.status === "PENDING" ? detail.version : undefined;
  const pages = accessError ? undefined : historyQuery.data?.pages
  const latestHistory = pages?.[0]
  const events = useMemo(() => mergeTaskEvents(pages), [pages])
  const viewport = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const pendingInitialScroll = useRef(true);
  const knownEventIds = useRef(new Set<string>());
  const oldestSequence = useRef<string | null>(null);
  const prependPosition = useRef<{ height: number; top: number; eventId: string | null; offset: number } | null>(null)
  const atLatest = useRef(true);
  const followingLatest = useRef(false);
  const previouslyVisible = useRef(false);
  const readAcknowledgement = useRef<string | null>(null);
  const pendingUiFrames = useRef(new Set<number>());
  const enteringRecords = useRef(new Map<HTMLElement, () => void>());
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const [newEvents, setNewEvents] = useState(0)
  const [awayFromLatest, setAwayFromLatest] = useState(false)
  const error = accessError ?? detailQuery.error ?? historyQuery.error
  const refreshing = detailQuery.isFetching || historyQuery.isFetching

  const scheduleViewportState = useCallback((update: () => void) => {
    const frame = requestAnimationFrame(() => {
      pendingUiFrames.current.delete(frame);
      update();
    });
    pendingUiFrames.current.add(frame);
  }, []);

  const acknowledgeRead = useCallback(() => {
    const container = viewport.current;
    if (!onRead || !active || !previouslyVisible.current || document.hidden || !container?.isConnected || !detail || !latestHistory || refreshing
      || container.scrollHeight - container.scrollTop - container.clientHeight > 8) return;
    const sequence = events.at(-1)?.sequence ?? null;
    const activity = detail.lastActivityAt ?? detail.createdAt;
    const acknowledgement = `${sequence ?? ""}:${activity}:${events.length}`;
    if (readAcknowledgement.current === acknowledgement) return;
    readAcknowledgement.current = acknowledgement;
    onRead(teamId, taskId, sequence, activity);
  }, [onRead, active, detail, latestHistory, refreshing, events, teamId, taskId]);

  useEffect(() => {
    const frames = pendingUiFrames.current;
    const records = enteringRecords.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onVisibilityChange = () => setDocumentVisible(!document.hidden);
    const onMotionChange = () => {
      if (motion.matches) records.forEach((finish) => finish());
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    motion.addEventListener("change", onMotionChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motion.removeEventListener("change", onMotionChange);
      frames.forEach(cancelAnimationFrame);
      frames.clear();
      records.forEach((finish) => finish());
    };
  }, []);

  useEffect(() => {
    if (!blockedError) return
    queryClient.removeQueries({ queryKey: taskKeys.detail(userId, teamId, taskId), exact: true })
    queryClient.removeQueries({ queryKey: taskKeys.history(userId, teamId, taskId) })
    initialized.current = false
    pendingInitialScroll.current = true;
    knownEventIds.current.clear();
    oldestSequence.current = null;
    followingLatest.current = false;
    readAcknowledgement.current = null;
    prependPosition.current = null
  }, [blockedError, queryClient, userId, teamId, taskId])

  useEffect(() => {
    if (error) onError(error)
  }, [error, onError])

  useLayoutEffect(() => {
    const visible = active && documentVisible && !document.hidden;
    const wasVisible = previouslyVisible.current;
    previouslyVisible.current = visible;
    const container = viewport.current
    if (!container || !detail || !latestHistory) return
    const loadingEarlier = prependPosition.current !== null;
    const previousOldest = oldestSequence.current;
    if (!initialized.current) {
      initialized.current = true
      events.forEach((event) => knownEventIds.current.add(event.eventId));
    }
    const added = events.filter((event) => !knownEventIds.current.has(event.eventId)
      && (!loadingEarlier || previousOldest === null || compareSequences(event.sequence, previousOldest) >= 0));
    events.forEach((event) => knownEventIds.current.add(event.eventId));
    oldestSequence.current = events[0]?.sequence ?? null;

    if (!visible) {
      followingLatest.current = false;
      enteringRecords.current.forEach((finish) => finish());
      if (added.length) {
        atLatest.current = false;
        scheduleViewportState(() => {
          setAwayFromLatest(true);
          setNewEvents((count) => count + added.length);
        });
      }
      return;
    }
    if (pendingInitialScroll.current) {
      container.scrollTop = container.scrollHeight;
      pendingInitialScroll.current = false;
      atLatest.current = true;
      scheduleViewportState(() => {
        setNewEvents(0);
        setAwayFromLatest(false);
      });
      acknowledgeRead();
      return;
    }
    if (prependPosition.current && !historyQuery.isFetchingNextPage) {
      const position = prependPosition.current;
      const anchor = Array.from(container.querySelectorAll<HTMLElement>("[data-event-id]"))
        .find((record) => record.dataset.eventId === position.eventId);
      container.scrollTop = anchor
        ? container.scrollTop + anchor.getBoundingClientRect().top - container.getBoundingClientRect().top - position.offset
        : position.top + container.scrollHeight - position.height;
      prependPosition.current = null
    }
    let addedCount = 0;
    if (added.length) {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const ids = new Set(added.map((event) => event.eventId));
        for (const record of container.querySelectorAll<HTMLElement>("[data-event-id]")) {
          if (!ids.has(record.dataset.eventId ?? "")) continue;
          const onAnimationEnd = (animation: AnimationEvent) => {
            if (animation.target === record) finish();
          };
          const finish = () => {
            record.classList.remove("tc-record-enter");
            record.removeEventListener("animationend", onAnimationEnd);
            record.removeEventListener("animationcancel", onAnimationEnd);
            enteringRecords.current.delete(record);
          };
          record.addEventListener("animationend", onAnimationEnd);
          record.addEventListener("animationcancel", onAnimationEnd);
          enteringRecords.current.set(record, finish);
          record.classList.add("tc-record-enter");
        }
      }
      addedCount = added.length;
    }
    if (wasVisible && atLatest.current && !loadingEarlier
      && container.scrollHeight - container.scrollTop - container.clientHeight > 8) {
      followingLatest.current = true;
      container.scrollTo({ top: container.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    const away = !followingLatest.current && container.scrollHeight - container.scrollTop - container.clientHeight > 80;
    if (!followingLatest.current) {
      atLatest.current = !away;
    }
    scheduleViewportState(() => {
      setAwayFromLatest(away);
      setNewEvents((count) => away ? count + addedCount : 0);
    });
    acknowledgeRead();
  }, [active, documentVisible, detail, latestHistory, events, historyQuery.isFetchingNextPage, acknowledgeRead, scheduleViewportState]);

  useEffect(() => {
    const container = viewport.current;
    if (!container || !active || !documentVisible) return;
    const observer = new ResizeObserver(() => {
      if (previouslyVisible.current && container.isConnected && !document.hidden && (atLatest.current || followingLatest.current) && !prependPosition.current
        && container.scrollHeight - container.scrollTop - container.clientHeight > 8) {
        followingLatest.current = true;
        container.scrollTo({ top: container.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
      acknowledgeRead();
    });
    observer.observe(container);
    const timeline = container.querySelector(".tc-timeline");
    if (timeline) observer.observe(timeline);
    return () => observer.disconnect();
  }, [active, documentVisible, detail, latestHistory, acknowledgeRead]);

  function refresh() {
    if (accessError) {
      setNewEvents(0)
      setAwayFromLatest(false)
      setBlockedError(null)
      return
    }
    void Promise.all([detailQuery.refetch(), historyQuery.refetch()])
  }

  function loadEarlier() {
    if (!historyQuery.hasNextPage || historyQuery.isFetching) return
    followingLatest.current = false;
    atLatest.current = false;
    const container = viewport.current
    if (container) {
      const top = container.getBoundingClientRect().top;
      const anchor = Array.from(container.querySelectorAll<HTMLElement>("[data-event-id]"))
        .find((record) => record.getBoundingClientRect().bottom >= top);
      prependPosition.current = {
        height: container.scrollHeight,
        top: container.scrollTop,
        eventId: anchor?.dataset.eventId ?? null,
        offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
      };
    }
    void historyQuery.fetchNextPage()
  }

  function goToLatest() {
    const container = viewport.current
    if (!container) return
    followingLatest.current = true;
    atLatest.current = true;
    container.scrollTo({ top: container.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setNewEvents(0)
    setAwayFromLatest(false)
    acknowledgeRead();
  }

  function trackScroll() {
    const container = viewport.current
    if (!container) return
    const away = container.scrollHeight - container.scrollTop - container.clientHeight > 80
    if (followingLatest.current && away) return;
    followingLatest.current = false;
    atLatest.current = !away;
    setAwayFromLatest(away)
    if (!away) {
      setNewEvents(0);
      acknowledgeRead();
    }
  }

  function interruptFollowing() {
    followingLatest.current = false;
  }

  return (
    <section className="task-conversation" aria-label={t("작업 대화 기록")}>
      <ConversationHeader taskId={taskId} detail={detail} onBack={onBack}>
        {typeof acceptVersion === "number" && !acceptTask.isSuccess && (
          <button type="button" className="button button-primary button-small" disabled={acceptTask.isPending}
            onClick={() => acceptTask.mutate(acceptVersion)}>
            {acceptTask.isPending ? t("수락 중…") : t("수락")}
          </button>
        )}
      </ConversationHeader>

      {error && (detail || latestHistory) && <div className="tc-refresh-error" role="alert"><span>{t(errorMessage(error))}</span><button type="button" onClick={refresh} disabled={refreshing}>{t("다시 시도")}</button></div>}
      {acceptTask.isError && !accessError && <div className="tc-refresh-error" role="alert">
        {acceptTask.error instanceof ApiError && acceptTask.error.status === 409
          ? t("작업 상태가 변경되었습니다. 최신 상태를 확인해주세요.")
          : t(errorMessage(acceptTask.error, "요청을 수락하지 못했습니다. 잠시 후 다시 시도해주세요."))}
      </div>}

      <div className="tc-body">
        <div className="tc-viewport" ref={viewport} onScroll={trackScroll} onWheel={interruptFollowing} onTouchStart={interruptFollowing} onPointerDown={interruptFollowing} onFocusCapture={(event) => {
          if (event.target instanceof Element && event.target.closest(".tc-collapsible.is-collapsed")) {
            followingLatest.current = false;
            atLatest.current = false;
          }
        }} onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest(".tc-collapse-toggle")) {
            followingLatest.current = false;
            atLatest.current = false;
          }
        }} onKeyDown={(event) => {
          if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) interruptFollowing();
        }} tabIndex={0} aria-label={t("작업 요청과 Agent 대화 기록")}>
          {(!detail || !latestHistory) && (
            <div className="tc-query-state" role={error ? 'alert' : 'status'}>
              <span className="tc-state-icon"><Icon name={error ? 'shield' : 'book'} size={25} /></span>
              <h3>{accessError ? accessError.status === 404 ? t("작업 없음") : t("대화 접근 제한") : error ? t("대화 기록 조회 실패") : t("대화 기록 불러오는 중")}</h3>
              <p>{error ? t(errorMessage(error)) : t("작업 요청과 Agent 사이에 오간 기록을 확인하고 있어요.")}</p>
              {error && <button type="button" className="button button-secondary button-small" disabled={refreshing && !accessError} onClick={refresh}><Icon name="refresh" size={14} />{t("다시 시도")}</button>}
            </div>
          )}

          {detail && latestHistory && (
            <ConversationTimeline detail={detail} history={latestHistory} events={events}>
              {historyQuery.hasNextPage && <div className="tc-earlier"><button type="button" className="button button-secondary button-small" onClick={loadEarlier} disabled={historyQuery.isFetching}><Icon name={historyQuery.isFetchingNextPage ? 'refresh' : 'chevron'} size={14} className={historyQuery.isFetchingNextPage ? 'tc-spinning' : 'tc-earlier-chevron'} />{historyQuery.isFetchingNextPage ? t("이전 기록 불러오는 중") : t("이전 기록 더 보기")}</button><span>{t("아래에는 불러온 기록만 표시됩니다.")}</span></div>}
            </ConversationTimeline>
          )}
        </div>
        {(newEvents > 0 || awayFromLatest) && detail && latestHistory && <button type="button" className="tc-latest-button" onClick={goToLatest}><span aria-live="polite">{newEvents > 0 ? t("새 기록 {{value0}}개 · 최신으로 이동", { value0: newEvents }) : t("최신 기록으로 이동")}</span><Icon name="arrow" size={14} /></button>}
      </div>
    </section>
  )
}

export default function TaskConversationView(props: TaskConversationViewProps | TaskConversationPreviewProps) {
  if ("preview" in props) return <ConversationPreview {...props} />;
  return <ConversationContent key={`${props.userId}:${props.teamId}:${props.taskId}`} {...props} />;
}
