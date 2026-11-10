import { useCallback, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import type { Team } from "@/features/teams/types";
import type { PreviewMember } from "../data/previewData";
import { Icon } from "@/components/ui";
import PageTitle from "@/components/common/PageTitle";
import BrandLogo from "@/components/common/BrandLogo";
import { copyText } from "@/utils";
import ImmersiveTeamScene from "./ImmersiveTeamScene";
import FocusedMemberDetails from "./FocusedMemberDetails";
import TeamWorkspaceDashboard from "./TeamWorkspaceDashboard";
import { immersivePreviewTeams } from "../data/immersivePreviewData";
import "../styles/ImmersiveTeamPreview.css";
import "../styles/ImmersiveExperience.css";
import "../styles/RefinedTeamPreview.css";

function MotionIcon({ paused }: { paused: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paused ? (
        <path d="m9 5 11 7-11 7V5Z" />
      ) : (
        <>
          <path d="M8 5v14M16 5v14" />
        </>
      )}
    </svg>
  );
}

function TopViewIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M4 9h16M9 4v16" />
      <circle cx="14.5" cy="14.5" r="2" />
    </svg>
  );
}

function SceneLoadingIndicator() {
  return <span className="itp-loading-spinner" aria-hidden="true" />;
}

function SceneLoading({ message }: { message: string }) {
  return (
    <div className="itp-scene-message itp-scene-loading" role="status">
      <SceneLoadingIndicator />
      <span className="itp-loader-caption">
        <strong>{message}</strong>
      </span>
    </div>
  );
}

function TeamPicker({
  teamName,
  teams,
  selectedTeamId,
  onSelectTeam,
}: {
  teamName: string;
  teams: { id: string; name: string }[];
  selectedTeamId: string;
  onSelectTeam: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const picker = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const selectedTeam = list.current?.querySelector<HTMLButtonElement>("[aria-current='true']");
    (selectedTeam ?? list.current?.querySelector("button"))?.focus();

    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !picker.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, [open]);

  function closePicker() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePicker();
      return;
    }

    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (!open) {
      if (step && teams.length > 0) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (!step && event.key !== "Home" && event.key !== "End") return;

    const options = Array.from(list.current?.querySelectorAll("button") ?? []);
    if (options.length === 0) return;
    event.preventDefault();
    const current = options.indexOf(event.target as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : current < 0
            ? step > 0
              ? 0
              : options.length - 1
            : (current + step + options.length) % options.length;
    options[next]?.focus();
  }

  return (
    <div
      className="itp-team-picker"
      ref={picker}
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span className="itp-team-picker-label">현재 팀</span>
      <h1>
        {teams.length === 0 ? (
          teamName
        ) : (
          <button
            className="itp-team-picker-trigger"
            type="button"
            ref={trigger}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-label={`팀 선택, 현재 팀 ${teamName}`}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="itp-team-picker-name">{teamName}</span>
            <span className="itp-team-picker-chevron">
              <Icon name="chevron" size={16} />
            </span>
          </button>
        )}
      </h1>
      {open && (
        <div className="itp-team-picker-panel">
          <div className="itp-team-picker-heading">
            <span>참여 중인 팀</span>
            <span>{teams.length}</span>
          </div>
          <ul className="itp-team-picker-list" id={listId} ref={list} aria-label="참여 중인 팀">
            {teams.map((team) => (
              <li key={team.id}>
                <button
                  type="button"
                  className="itp-team-picker-option"
                  aria-current={team.id === selectedTeamId ? true : undefined}
                  onClick={() => {
                    closePicker();
                    onSelectTeam(team.id);
                  }}
                >
                  <span className="itp-team-picker-initial" aria-hidden="true">
                    {Array.from(team.name.trim())[0] ?? "?"}
                  </span>
                  <span className="itp-team-picker-option-name">{team.name}</span>
                  {team.id === selectedTeamId && (
                    <span className="itp-team-picker-current">
                      <Icon name="check" size={15} />
                      <span className="itp-sr-only">현재 팀</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MemberIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
    </svg>
  );
}

const memberColors: Record<string, string> = {
  sage: "#858585",
  blue: "#6b6b6b",
  peach: "#a5a5a5",
  lavender: "#909090",
  sand: "#bdbdbd",
  mint: "#999999",
};
const loadingMembers: PreviewMember[] = [];
const SCENE_RETURN_DISTANCE_MULTIPLIER = 1.18;
const SCENE_RETURN_DURATION_MS = 900;

function easeSceneReturn(progress: number) {
  if (progress <= 0 || progress >= 1) return progress;
  let lower = 0;
  let upper = 1;
  // 기본 스크롤의 가속·감속 곡선에 맞춘 베지어 역산
  for (let iteration = 0; iteration < 16; iteration++) {
    const parameter = (lower + upper) / 2;
    const remaining = 1 - parameter;
    const position = 1.2 * remaining * remaining * parameter + parameter ** 3;
    if (position < progress) lower = parameter;
    else upper = parameter;
  }
  const parameter = (lower + upper) / 2;
  return parameter * parameter * (3 - 2 * parameter);
}

interface LiveWorkspace {
  teams: Team[];
  selectedTeam: Team | null;
  members: PreviewMember[];
  agentCount: number;
  sceneStatus: "loading" | "error" | "empty" | "ready";
  onSelectTeam: (teamId: number) => void;
  onRetry: () => void;
  onInvite?: () => void;
  renderDashboard: (showScene: () => void) => ReactNode;
  // 값이 바뀔 때마다 대시보드로 이동
  dashboardRequest?: number;
}

export default function ImmersiveTeamPreview({ workspace }: { workspace?: LiveWorkspace }) {
  const [teamId, setTeamId] = useState(immersivePreviewTeams[0].id);
  const [selection, setSelection] = useState<{
    teamId: string;
    memberId: string;
    focused: boolean;
  } | null>(null);
  const [paused, setPaused] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [topView, setTopView] = useState(false);
  const [availability, setAvailability] = useState<"loading" | "ready" | "unavailable">("loading");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [activeView, setActiveView] = useState<"scene" | "dashboard">("scene");
  const [transitioning, setTransitioning] = useState(false);
  const [sceneReturning, setSceneReturning] = useState(false);
  const experienceRoot = useRef<HTMLDivElement>(null);
  const journey = useRef<HTMLElement>(null);
  const dashboardSection = useRef<HTMLElement>(null);
  const transitionScrollClock = useRef<HTMLDivElement>(null);
  const transitionScrollTrack = useRef<HTMLDivElement>(null);
  const dashboardScrollTop = useRef(0);
  const transitionFrame = useRef(0);
  const stopTransition = useRef<(() => void) | null>(null);
  const transitionRunning = useRef(false);
  const transitionState = useRef({
    progress: 0,
    sceneProgress: 0,
    sceneDistance: 1,
    requestRender: () => {},
  });
  const navigationComplete = useRef<(() => void) | null>(null);
  const inviteDialog = useRef<HTMLDialogElement>(null);
  const copyAttempt = useRef(0);
  const team = immersivePreviewTeams.find((item) => item.id === teamId) ?? immersivePreviewTeams[0];
  const activeTeamId = workspace ? String(workspace.selectedTeam?.teamId ?? "") : team.id;
  const sceneStatus = workspace?.sceneStatus ?? "ready";
  const showTeam = sceneStatus === "ready";
  const loadingTeam = sceneStatus === "loading";
  const mountScene = loadingTeam || showTeam;
  const loadingMessage = loadingTeam
    ? "팀 정보를 불러오는 중이에요"
    : showTeam && availability === "loading"
      ? "3D 공간을 준비하는 중이에요"
      : null;
  const showTeamControls = showTeam && availability !== "loading";
  const teamName = workspace ? (workspace.selectedTeam?.name ?? "DevLink 워크스페이스") : team.name;
  const members = workspace ? workspace.members : team.members;
  const teamOptions = workspace
    ? workspace.teams.map((item) => ({ id: String(item.teamId), name: item.name }))
    : immersivePreviewTeams;
  const activeSelection = selection?.teamId === activeTeamId ? selection : null;
  const selectedMember = members.find((item) => item.id === activeSelection?.memberId);
  const member = selectedMember ?? members[0];
  const focusedMemberId =
    showTeam && activeSelection?.focused && selectedMember ? selectedMember.id : null;
  const agentCount =
    workspace?.agentCount ?? members.reduce((count, item) => count + item.agents.length, 0);
  const color = memberColors[member?.color] ?? memberColors.sage;
  const sceneActive = activeView === "scene";
  const sceneVisible = sceneActive || transitioning;

  const onRenderRequestChange = useCallback((requestRender: () => void) => {
    transitionState.current.requestRender = requestRender;
  }, []);

  const onAvailabilityChange = useCallback((available: boolean) => {
    setAvailability(available ? "ready" : "unavailable");
  }, []);

  const selectMember = useCallback(
    (id: string) => {
      setTopView(false);
      setSelection({ teamId: activeTeamId, memberId: id, focused: true });
    },
    [activeTeamId],
  );

  const selectDashboardMember = useCallback(
    (id: string) => {
      setSelection({ teamId: activeTeamId, memberId: id, focused: false });
    },
    [activeTeamId],
  );

  const returnToOverview = useCallback(() => {
    setSelection((current) => (current?.focused ? { ...current, focused: false } : current));
  }, []);

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (transitioning) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      if (dashboardSection.current) dashboardSection.current.scrollTop = dashboardScrollTop.current;
      return;
    }
    const section = activeView === "scene" ? journey.current : dashboardSection.current;
    if (dashboardSection.current) dashboardSection.current.scrollTop = 0;
    window.scrollTo({
      top: activeView === "scene" ? 0 : dashboardScrollTop.current,
      left: 0,
      behavior: "instant",
    });
    if (sceneReturning) return;
    section?.focus({ preventScroll: true });
    const afterNavigation = navigationComplete.current;
    navigationComplete.current = null;
    afterNavigation?.();
  }, [activeView, transitioning, sceneReturning]);

  useEffect(() => {
    if (!transitioning && !sceneReturning) return;
    const preventScroll = (event: WheelEvent | TouchEvent) => {
      if (event.type !== "wheel" || !event.ctrlKey) event.preventDefault();
    };
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    };
  }, [transitioning, sceneReturning]);

  useEffect(
    () => () => {
      stopTransition.current?.();
      transitionRunning.current = false;
      navigationComplete.current = null;
    },
    [],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (event: MediaQueryListEvent) => setPaused(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const dashboardRequest = workspace?.dashboardRequest ?? 0;
  const dashboardPending = useRef(false);
  // 3D 화면에서는 대시보드로 전환한 뒤 대시보드 위치로 이동
  const openRequestedDashboard = useEffectEvent(() => {
    // 화면 전환 중이면 전환이 끝난 뒤 처리
    if (transitionRunning.current) {
      dashboardPending.current = true;
      return;
    }
    navigateTo("dashboard", () => {
      const section = dashboardSection.current;
      if (!section) return;
      section.focus({ preventScroll: true });
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: window.scrollY + section.getBoundingClientRect().top, behavior: reduced ? "auto" : "smooth" });
    });
  });
  useEffect(() => {
    if (dashboardRequest) openRequestedDashboard();
  }, [dashboardRequest]);
  useEffect(() => {
    if (transitioning || sceneReturning || !dashboardPending.current) return;
    dashboardPending.current = false;
    openRequestedDashboard();
  }, [transitioning, sceneReturning]);

  useEffect(() => {
    const dialog = inviteDialog.current;
    if (inviteOpen && !dialog?.open) dialog?.showModal();
    else if (!inviteOpen && dialog?.open) dialog.close();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [inviteOpen]);

  useEffect(
    () => () => {
      copyAttempt.current++;
    },
    [],
  );

  useEffect(() => {
    if (!sceneActive || transitioning || sceneReturning || !focusedMemberId || inviteOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (!transitionRunning.current && event.key === "Escape") returnToOverview();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [sceneActive, transitioning, sceneReturning, focusedMemberId, inviteOpen, returnToOverview]);

  function navigateTo(view: "scene" | "dashboard", afterNavigation?: () => void) {
    if (transitionRunning.current) return;
    if (view === activeView) {
      afterNavigation?.();
      return;
    }
    const clock = transitionScrollClock.current;
    const track = transitionScrollTrack.current;
    if (!clock || !track) return;
    if (activeView === "dashboard") dashboardScrollTop.current = window.scrollY;
    navigationComplete.current = afterNavigation ?? null;
    const startProgress = transitionState.current.progress;
    const startSceneProgress = transitionState.current.sceneProgress;
    const endProgress = view === "dashboard" ? 1 : 0;
    let finished = false;
    let panelFinished = false;
    let onScrollEnd: (() => void) | null = null;

    function revealAt(progress: number) {
      const normalized = Math.max(0, Math.min((progress - 0.04) / 0.92, 1));
      return normalized * normalized * (3 - 2 * normalized);
    }

    function publishTransition(progress: number, sceneProgress: number) {
      transitionState.current.progress = progress;
      transitionState.current.sceneProgress = sceneProgress;
      experienceRoot.current?.style.setProperty("--itp-view-progress", String(progress));
      experienceRoot.current?.style.setProperty("--itp-view-reveal", String(revealAt(progress)));
      experienceRoot.current?.style.setProperty("--itp-scene-progress", String(sceneProgress));
      experienceRoot.current?.style.setProperty(
        "--itp-scene-distance",
        String(transitionState.current.sceneDistance),
      );
      transitionState.current.requestRender();
    }

    function stopNativeScroll() {
      if (onScrollEnd) clock!.removeEventListener("scrollend", onScrollEnd);
      onScrollEnd = null;
      clock!.scrollTo({ top: clock!.scrollTop, behavior: "instant" });
    }

    function stop() {
      window.cancelAnimationFrame(transitionFrame.current);
      transitionFrame.current = 0;
      stopNativeScroll();
      stopTransition.current = null;
      finished = true;
    }

    function finish() {
      if (finished) return;
      stop();
      transitionState.current.sceneDistance = 1;
      publishTransition(endProgress, endProgress);
      transitionRunning.current = false;
      setActiveView(view);
      setTransitioning(false);
      setSceneReturning(false);
    }

    function completePanel() {
      if (finished || panelFinished) return;
      panelFinished = true;
      stopNativeScroll();
      if (view === "dashboard") {
        finish();
        return;
      }
      publishTransition(endProgress, transitionState.current.sceneProgress);
      setActiveView(view);
      setTransitioning(false);
    }

    stopTransition.current = stop;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    transitionRunning.current = true;
    transitionState.current.sceneDistance = view === "scene" ? SCENE_RETURN_DISTANCE_MULTIPLIER : 1;
    publishTransition(startProgress, startSceneProgress);
    setSceneReturning(view === "scene");
    setTransitioning(true);
    transitionFrame.current = window.requestAnimationFrame(() => {
      const viewportHeight = Math.max(journey.current?.clientHeight || window.innerHeight, 1);
      track.style.height = `${viewportHeight + clock.clientHeight}px`;
      const distance = clock.scrollHeight - clock.clientHeight;
      if (distance <= 0) {
        finish();
        return;
      }
      const targetTop = endProgress * distance;
      const startTop = startProgress * distance;
      clock.scrollTo({ top: startTop, behavior: "instant" });
      transitionFrame.current = window.requestAnimationFrame((startedAt) => {
        let nativeMoved = false;

        function paintTransition(now: number) {
          if (finished) return;
          if (Math.abs(clock!.scrollTop - startTop) > 0.5) nativeMoved = true;
          const progress = panelFinished
            ? endProgress
            : Math.max(0, Math.min(clock!.scrollTop / distance, 1));
          const sceneTime = Math.max(0, Math.min((now - startedAt) / SCENE_RETURN_DURATION_MS, 1));
          const sceneProgress =
            view === "scene"
              ? startSceneProgress * (1 - easeSceneReturn(sceneTime))
              : revealAt(progress);
          publishTransition(progress, sceneProgress);
          if (!panelFinished && Math.abs(clock!.scrollTop - targetTop) <= 0.5) completePanel();
          if (finished) return;
          if (panelFinished && sceneTime >= 1) finish();
          else transitionFrame.current = window.requestAnimationFrame(paintTransition);
        }

        onScrollEnd = () => {
          if (Math.abs(clock.scrollTop - startTop) > 0.5) nativeMoved = true;
          if (nativeMoved || Math.abs(clock.scrollTop - targetTop) <= 0.5) completePanel();
        };
        clock.addEventListener("scrollend", onScrollEnd);
        // 휠 입력과 분리한 기본 스크롤로 전환 속도 재현
        clock.scrollTo({ top: targetTop, behavior: "smooth" });
        paintTransition(startedAt);
      });
    });
  }

  function showDashboard() {
    navigateTo("dashboard");
  }

  function showScene() {
    if (transitionRunning.current) return;
    returnToOverview();
    navigateTo("scene");
  }

  function toggleTopView() {
    returnToOverview();
    setTopView((current) => !current);
  }

  function focusMemberFromDashboard(id: string) {
    if (transitionRunning.current) return;
    selectMember(id);
    navigateTo("scene");
  }

  function openInvite() {
    if (workspace) {
      navigateTo("dashboard", workspace.onInvite);
      return;
    }
    setCopyStatus("idle");
    setInviteOpen(true);
  }

  function changeTeam(id: string) {
    if (id === activeTeamId) return;
    if (workspace) {
      setSelection(null);
      workspace.onSelectTeam(Number(id));
      return;
    }
    const nextTeam = immersivePreviewTeams.find((item) => item.id === id);
    if (!nextTeam) return;
    setTeamId(id);
    setSelection(null);
    closeInvite();
  }

  function closeInvite() {
    copyAttempt.current++;
    setInviteOpen(false);
    setCopyStatus("idle");
  }

  async function copyInvite() {
    const attempt = ++copyAttempt.current;
    try {
      await copyText(team.inviteCode);
      if (copyAttempt.current === attempt) setCopyStatus("copied");
    } catch {
      if (copyAttempt.current === attempt) setCopyStatus("error");
    }
  }

  return (
    <div
      className="itp-experience"
      ref={experienceRoot}
      data-view={activeView}
      data-transitioning={transitioning ? "true" : "false"}
      data-scene-returning={sceneReturning ? "true" : "false"}
    >
      {!workspace && <PageTitle title="3D 팀 스페이스" />}
      <div
        className="itp-transition-scroll-clock"
        ref={transitionScrollClock}
        aria-hidden="true"
        tabIndex={-1}
      >
        <div ref={transitionScrollTrack} />
      </div>
      <section
        className="itp-journey"
        ref={journey}
        aria-label="3D 팀 스페이스"
        tabIndex={-1}
        hidden={!sceneVisible}
        inert={transitioning || sceneReturning || !sceneActive}
      >
        <div className="itp-stage-sticky">
          <div
            className={`immersive-team-preview ${paused ? "is-paused" : ""} ${focusedMemberId ? "is-focused" : ""} ${loadingMessage ? "is-loading" : ""}`}
          >
            <div className="itp-scene">
              {mountScene && (
                <ImmersiveTeamScene
                  teamName={teamName}
                  members={loadingTeam ? loadingMembers : members}
                  loading={loadingTeam}
                  selectedMemberId={member?.id ?? ""}
                  focusedMemberId={focusedMemberId}
                  active={sceneVisible}
                  transitionState={transitionState}
                  onRenderRequestChange={onRenderRequestChange}
                  onSelectMember={selectMember}
                  paused={paused}
                  topView={topView}
                  onAvailabilityChange={onAvailabilityChange}
                />
              )}
              {sceneStatus === "empty" && (
                <div className="itp-scene-message" role="status">
                  <strong>아직 참여한 팀이 없어요</strong>
                  <span>대시보드에서 팀을 만들거나 초대 코드로 참여할 수 있어요.</span>
                </div>
              )}
              {sceneStatus === "error" && (
                <div className="itp-scene-message">
                  <strong role="alert">팀 정보를 불러오지 못했어요</strong>
                  <button type="button" className="itp-dashboard-jump" onClick={workspace?.onRetry}>
                    다시 불러오기
                  </button>
                </div>
              )}
              {showTeam && availability === "unavailable" && (
                <div className="itp-fallback">
                  <div className="itp-fallback-core">
                    <span className="itp-fallback-hub-model" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="itp-fallback-team-name">{teamName}</span>
                  </div>
                  <div className="itp-fallback-members">
                    {members.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        className={member?.id === item.id ? "is-active" : ""}
                        onClick={() => selectMember(item.id)}
                        aria-label={`${item.name} 선택`}
                        aria-pressed={member?.id === item.id}
                        style={
                          {
                            "--itp-index": index,
                            "--itp-count": members.length,
                            "--itp-member-color": memberColors[item.color],
                          } as CSSProperties
                        }
                      >
                        <span className="itp-fallback-node" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="itp-fallback-companions" aria-hidden="true">
                          {item.agents.map((agent) => (
                            <span
                              key={agent.id}
                              className={`itp-fallback-companion ${agent.online ? "is-online" : ""}`}
                            >
                              <i />
                              <i />
                              <b />
                            </span>
                          ))}
                        </span>
                        <strong>{item.name}</strong>
                      </button>
                    ))}
                  </div>
                  <span className="itp-fallback-note">이 환경에서는 기본 그래픽으로 표시해요</span>
                </div>
              )}
            </div>
            {loadingMessage && mountScene && availability !== "unavailable" && (
              <div className="itp-scene-handoff-status" role="status">
                <SceneLoadingIndicator />
                <strong>{loadingMessage}</strong>
              </div>
            )}
            {loadingMessage && availability === "unavailable" && (
              <SceneLoading message={loadingMessage} />
            )}
            <div className="itp-ambient" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="itp-ui">
              <header className="itp-header">
                <a href="/" className="itp-brand" aria-label="DevLink 워크스페이스">
                  <BrandLogo />
                </a>
                <div className="itp-header-actions">
                  {focusedMemberId && (
                    <button
                      type="button"
                      className="itp-overview-button"
                      onClick={returnToOverview}
                    >
                      <Icon name="arrow" size={17} />
                      전체 팀 보기
                    </button>
                  )}
                </div>
              </header>
              {showTeamControls && (
                <div className={`itp-main${availability === "ready" ? " itp-team-reveal" : ""}`}>
                  <section className="itp-hero" key={activeTeamId}>
                    <TeamPicker
                      teamName={teamName}
                      teams={teamOptions}
                      selectedTeamId={activeTeamId}
                      onSelectTeam={(id) => {
                        if (id === activeTeamId) return;
                        journey.current?.focus({ preventScroll: true });
                        changeTeam(id);
                      }}
                    />
                    <div
                      className="itp-stats"
                      aria-label={`팀원 ${members.length}명, 에이전트 ${agentCount}개`}
                    >
                      <div>
                        <strong>{members.length}</strong>
                        <span>팀원</span>
                      </div>
                      <span className="itp-stat-line" />
                      <div>
                        <strong>{agentCount}</strong>
                        <span>에이전트</span>
                      </div>
                    </div>
                  </section>
                  {focusedMemberId && member && (
                    <FocusedMemberDetails
                      key={`${activeTeamId}-${member.id}`}
                      member={member}
                      color={color}
                      onClose={returnToOverview}
                      onOpenDashboard={showDashboard}
                    />
                  )}
                  <p className="itp-sr-only">
                    팀원을 선택하면 카메라가 이동합니다. 전체 팀 보기 버튼이나 Escape 키로 돌아올 수
                    있습니다. 스크롤로 3D 화면을 확대하거나 축소하고, 대시보드로 가기 버튼으로
                    화면을 전환할 수 있습니다.
                  </p>
                  {members.length > 0 && (
                    <div className="itp-dock itp-member-list" role="group" aria-label="팀원 선택">
                      <div className="itp-member-list-heading">
                        <span>팀원</span>
                        <span>{members.length}</span>
                      </div>
                      {members.map((item) => (
                        <button
                          type="button"
                          className={`itp-member ${member?.id === item.id ? "is-active" : ""}`}
                          key={item.id}
                          style={
                            { "--itp-member-color": memberColors[item.color] } as CSSProperties
                          }
                          aria-pressed={member?.id === item.id}
                          aria-label={`${item.name} 선택`}
                          onClick={() => selectMember(item.id)}
                        >
                          <span className="itp-member-avatar" aria-hidden="true">
                            <MemberIcon />
                          </span>
                          <span className="itp-member-name">{item.name}</span>
                          <span className="itp-member-dot" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showTeamControls && (
                <div className={`itp-bottom${availability === "ready" ? " itp-team-reveal" : ""}`}>
                  {availability === "ready" && (
                    <div className="itp-orbit-controls" role="group" aria-label="3D 화면 조작">
                      <button
                        type="button"
                        className="itp-icon-button"
                        onClick={toggleTopView}
                        aria-label={topView ? "기본 각도로 돌아가기" : "위에서 보기"}
                        title={topView ? "기본 각도로 돌아가기" : "위에서 보기"}
                        aria-pressed={topView}
                      >
                        <TopViewIcon />
                      </button>
                      <button
                        type="button"
                        className="itp-icon-button"
                        onClick={() => setPaused(!paused)}
                        aria-label={paused ? "애니메이션 재생" : "애니메이션 일시정지"}
                        title={paused ? "애니메이션 재생" : "애니메이션 일시정지"}
                        aria-pressed={paused}
                      >
                        <MotionIcon paused={paused} />
                      </button>
                    </div>
                  )}
                  {(!workspace || workspace.onInvite) && (
                    <button
                      type="button"
                      className="itp-invite-trigger"
                      onClick={openInvite}
                      aria-label="팀원 초대"
                      title="팀원 초대"
                    >
                      <Icon name="plus" size={23} />
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                className="space-navigation-button itp-scroll-prompt"
                data-direction="down"
                onClick={showDashboard}
              >
                <span>대시보드로 가기</span>
                <Icon name="chevrons" size={20} className="space-navigation-arrows" />
              </button>
            </div>
          </div>
        </div>
      </section>
      <section
        className="itp-dashboard-section"
        id="team-dashboard"
        ref={dashboardSection}
        aria-label="팀 대시보드"
        tabIndex={-1}
        hidden={sceneActive && !transitioning}
        inert={transitioning || sceneActive}
      >
        <div className="itp-dashboard-frame">
          {workspace
            ? workspace.renderDashboard(showScene)
            : member && (
                <TeamWorkspaceDashboard
                  key={team.id}
                  team={team}
                  teams={immersivePreviewTeams}
                  selectedMemberId={member.id}
                  onSelectTeam={changeTeam}
                  onSelectMember={selectDashboardMember}
                  onFocusMember={focusMemberFromDashboard}
                  onInvite={openInvite}
                  onReturnToScene={showScene}
                />
              )}
        </div>
      </section>
      {!workspace && (
        <dialog
          ref={inviteDialog}
          className="itp-invite-dialog"
          aria-labelledby="itp-invite-title"
          onCancel={(event) => {
            event.preventDefault();
            closeInvite();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeInvite();
          }}
        >
          <div className="itp-invite-heading">
            <h2 id="itp-invite-title">{team.name}</h2>
            <button
              type="button"
              className="itp-icon-button"
              onClick={closeInvite}
              aria-label="초대 카드 닫기"
            >
              <Icon name="close" size={19} />
            </button>
          </div>
          <label htmlFor="itp-invite-code">초대 코드</label>
          <input
            id="itp-invite-code"
            value={team.inviteCode}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="itp-copy"
            onClick={() => {
              void copyInvite();
            }}
          >
            <Icon name={copyStatus === "copied" ? "check" : "copy"} size={16} />
            {copyStatus === "copied" ? "복사 완료" : "초대 코드 복사"}
          </button>
          <p className="itp-invite-note" role="status">
            {copyStatus === "error" ? "코드를 선택해 직접 복사해주세요." : "미리보기용 초대 코드"}
          </p>
        </dialog>
      )}
    </div>
  );
}
