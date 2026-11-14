import { useTranslation } from "@/lib/i18n";
import { Icon } from "@/components/ui";
import { setupToolNames } from "../lib/agentMetadata";

export default function ProjectConnectSummary({ projectName, selectedTool, teamName, showCompletion }) {
  const { t } = useTranslation();
  return (
    <>
      {showCompletion && (
        <div className="project-connect-complete" role="status">
          <span className="project-connect-symbol">
            <Icon name="check" size={27} />
          </span>
          <h3>{t("프로젝트 연결을 완료했습니다")}</h3>
          <p>{t("AI 도구에서 마지막 안내를 확인해주세요.")}</p>
        </div>
      )}
      {projectName && selectedTool && (
        <dl className="project-connect-summary">
          <div>
            <dt>{t("프로젝트")}</dt>
            <dd>{projectName}</dd>
          </div>
          <div>
            <dt>{t("AI 도구")}</dt>
            <dd>{setupToolNames[selectedTool]}</dd>
          </div>
          <div>
            <dt>{t("팀")}</dt>
            <dd>{teamName}</dd>
          </div>
        </dl>
      )}
      {selectedTool === "codex" && (
        <p>{t("Codex에서 이 프로젝트를 열고 폴더 신뢰 여부를 묻는다면 신뢰를 선택해주세요.")}</p>
      )}
      {selectedTool === "claude-code" && (
        <p>{t("Claude Code에서 이 프로젝트를 열고 DevLink MCP 사용을 묻는다면 승인해주세요.")}</p>
      )}
    </>
  );
}
