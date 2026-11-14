import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import ProjectConnectForm from "@/features/desktop-setup/components/ProjectConnectForm";
import ProjectConnectSummary from "@/features/desktop-setup/components/ProjectConnectSummary";
import ProjectFolderPicker from "@/features/desktop-setup/components/ProjectFolderPicker";
import { createSetupAgentMetadata } from "@/features/desktop-setup/lib/agentMetadata";
import { demoProject, demoTeam } from "../data/demoScenario";

export default function DemoAgentSetup({ progress, capture, onAdvance, onClose }) {
  const [agentPart, setAgentPart] = useState("FRONTEND");
  const [rolesText, setRolesText] = useState("웹 UI, 프론트엔드");
  const [metadataError, setMetadataError] = useState("");
  const closeButton = useRef(null);

  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true });
  }, []);

  function submit(event) {
    event.preventDefault();
    try {
      createSetupAgentMetadata(agentPart, rolesText);
    } catch (error) {
      setMetadataError(error.message);
      return;
    }
    onAdvance();
  }

  return (
    <section className="demo-agent-setup" role="dialog" aria-label="Agent 추가" onKeyDown={(event) => {
      if (event.key === "Escape" && !capture) {
        event.stopPropagation();
        onClose();
      }
    }}>
      <div className="modal-heading">
        <div>
          <h2>Agent 추가</h2>
          <p className="muted">{demoTeam} 팀의 이 PC 프로젝트 설정입니다.</p>
        </div>
        <button ref={closeButton} type="button" className="icon-button" onClick={onClose} aria-label="창 닫기">
          <Icon name="close" />
        </button>
      </div>
      <div className="project-connect-content demo-setup-step" key={progress}>
        {progress === 0 && <ProjectFolderPicker onPickFolder={onAdvance} />}
        {progress === 1 && (
          <>
            <p className="project-connect-selection"><Icon name="grid" size={17} /><code>{demoProject}</code><span>Codex</span></p>
            <ProjectConnectForm
              tools={["codex"]}
              selectedTool="codex"
              agentPart={agentPart}
              rolesText={rolesText}
              metadataError={metadataError}
              onSelectTool={() => {}}
              onPartChange={(value) => {
                setAgentPart(value);
                setMetadataError("");
              }}
              onRolesChange={(value) => {
                setRolesText(value);
                setMetadataError("");
              }}
              onSubmit={submit}
            />
          </>
        )}
        {progress === 2 && (
          <>
            <ProjectConnectSummary
              projectName="northstar-web"
              selectedTool="codex"
              teamName={demoTeam}
              showCompletion
            />
            <p>Codex에서 프로젝트를 다시 열고 “DevLink의 연결 상태와 내 Agent 정보를 확인해줘.”라고 요청합니다.</p>
            <div className="modal-footer">
              <button type="button" className="button button-primary" onClick={onAdvance}>Codex 연결 확인</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
