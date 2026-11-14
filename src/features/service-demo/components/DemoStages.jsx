import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import { Icon } from "@/components/ui";
import AgentListView from "@/features/agents/components/AgentListView";
import { SessionContext } from "@/features/auth/hooks/useSession";
import DashboardLayout from "@/layouts/DashboardLayout";
import DemoAgentSetup from "./DemoAgentSetup";
import DemoCodexRequest from "./DemoCodexRequest";
import DemoTaskConversation from "./DemoTaskConversation";
import { demoActors, demoTask, demoTaskStatus, demoTeam } from "../data/demoScenario";

const demoDate = "2026-11-06T08:53:33.000Z";
const team = { teamId: 1, name: demoTeam, myRole: "OWNER", createdAt: demoDate };
const user = { userId: 1, email: "jia@example.com", name: "한지아", nickname: null, createdAt: demoDate };
const noop = () => {};
const session = {
  user,
  booting: false,
  connection: "online",
  loggingOut: false,
  onAuthenticated: async () => {},
  logout: noop,
  retryConnection: noop,
  onError: noop,
};

const receiver = {
  agentId: 2,
  teamId: team.teamId,
  ownerUserId: 2,
  name: demoActors.receiver.name,
  projectName: "northstar-api",
  toolType: "CLAUDE_CODE",
  roleDescription: "게시글 API 및 데이터베이스",
  status: "ONLINE",
  lastSeenAt: demoDate,
};

const requester = {
  agentId: 1,
  teamId: team.teamId,
  ownerUserId: user.userId,
  name: demoActors.requester.name,
  projectName: "northstar-web",
  toolType: "CODEX",
  roleDescription: "게시글 목록 및 화면 개발",
};

function ownerName(agent) {
  return agent.ownerUserId === user.userId ? user.name : "정도윤";
}

export default function DemoStages({ step, progress, capture, onAdvance, onReset, onOpenStep }) {
  const { t } = useTranslation();
  const [setupDismissed, setSetupDismissed] = useState(false);
  const connect = step.id === "connect";
  const codex = step.id === "request" && progress < step.actions.length;
  const registered = progress >= 3;
  const connected = progress >= step.actions.length;
  const setupOpen = connect && progress > 0 && !connected && (!registered || !setupDismissed);
  const agents = (registered
    ? [{ ...requester, status: connected ? "ONLINE" : "OFFLINE", lastSeenAt: connected ? demoDate : null }, receiver]
    : [receiver]).map((agent) => ({ ...agent, name: t(agent.name), roleDescription: t(agent.roleDescription) }));
  const task = {
    taskId: demoTask.id,
    taskSummary: t(demoTask.title),
    status: demoTaskStatus(step.id, progress),
  };

  function openSetup() {
    setSetupDismissed(false);
    if (progress === 0) onAdvance();
  }

  function closeSetup() {
    if (capture) return;
    if (!registered) onReset();
    else setSetupDismissed(true);
  }

  function advanceSetup() {
    setSetupDismissed(false);
    onAdvance();
  }

  function changeView(view) {
    if (view === "agents") onOpenStep(0);
    if (view === "conversation" && connect) onOpenStep(2);
  }

  return (
    <section className="demo-stage" aria-label={t(step.label)}>
      {codex ? (
        <div className="demo-codex-frame demo-stage-enter">
          <DemoCodexRequest progress={progress} onAdvance={onAdvance} />
        </div>
      ) : (
        <div className="demo-workspace-frame demo-stage-enter">
          <div className="demo-workspace" inert={setupOpen || undefined}>
            <SessionContext.Provider value={session}>
              <DashboardLayout
                demo
                view={connect ? "agents" : "conversation"}
                onViewChange={changeView}
                teams={[team]}
                selectedTeamId={team.teamId}
                teamsLoading={false}
                workspaceLoading={false}
                onSelectTeam={noop}
                onRefresh={noop}
                onReturnToScene={noop}
                taskList={connect ? [] : [task]}
                selectedTaskId={connect ? null : task.taskId}
                onSelectTask={noop}
              >
                {connect ? (
                  <AgentListView
                    team={team}
                    agents={agents}
                    currentUserId={user.userId}
                    loading={false}
                    pcReady
                    connectingAgentId={null}
                    ownerName={ownerName}
                    headingActions={(
                      <button className="button button-primary" type="button" onClick={openSetup} aria-disabled={connected || undefined}>
                        <Icon name="plus" size={18} />{t(" Agent 추가")}</button>
                    )}
                    onConnect={onAdvance}
                  />
                ) : (
                  <DemoTaskConversation
                    stepId={step.id}
                    progress={progress}
                    capture={capture}
                    onAccept={step.id === "conversation" ? onAdvance : undefined}
                  />
                )}
              </DashboardLayout>
            </SessionContext.Provider>
          </div>
          {setupOpen && (
            <div className="demo-setup-overlay">
              <DemoAgentSetup progress={progress - 1} capture={capture} onAdvance={advanceSetup} onClose={closeSetup} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
