import { useTranslation } from "@/lib/i18n";
import { useId } from "react";
import { Icon } from "@/components/ui";
import { agentParts, setupToolNames } from "../lib/agentMetadata";

/**
 * @param {{
 *   tools: import("../api/desktopApi").SetupTool[];
 *   selectedTool: import("../api/desktopApi").SetupTool | null;
 *   agentPart: string;
 *   rolesText: string;
 *   metadataError?: string;
 *   busy?: boolean;
 *   toolLocked?: boolean;
 *   onSelectTool: (tool: import("../api/desktopApi").SetupTool) => void;
 *   onPartChange: (part: string) => void;
 *   onRolesChange: (roles: string) => void;
 *   onSubmit: (event: import("react").FormEvent<HTMLFormElement>) => void;
 *   onManualSetup?: () => void;
 * }} props
 */
export default function ProjectConnectForm({
  tools,
  selectedTool,
  agentPart,
  rolesText,
  metadataError = "",
  busy = false,
  toolLocked = false,
  onSelectTool,
  onPartChange,
  onRolesChange,
  onSubmit,
  onManualSetup,
}) {
  const { t } = useTranslation();
  const fieldId = useId();

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <fieldset
        className="project-connect-tool-selection"
        disabled={busy || toolLocked}
      >
        <legend>{t("프로젝트에 연결할 AI 도구")}</legend>
        <div className="project-connect-tools">
          {tools.map((tool) => (
            <button
              key={tool}
              className={`project-connect-tool${selectedTool === tool ? " is-selected" : ""}`}
              type="button"
              aria-pressed={selectedTool === tool}
              onClick={() => onSelectTool(tool)}
            >
              <Icon name="agent" size={23} />
              <strong>{setupToolNames[tool]}</strong>
              <span>{t("이 PC에서 사용 가능")}</span>
              <Icon name="arrow" size={17} />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${fieldId}-part`}>{t("담당 파트")}</label>
        <select
          id={`${fieldId}-part`}
          value={agentPart}
          onChange={(event) => onPartChange(event.target.value)}
        >
          <option value="">{t("선택 안 함")}</option>
          {agentParts.map((part) => (
            <option key={part.value} value={part.value}>
              {t(part.label)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${fieldId}-roles`}>{t("역할 태그")}</label>
        <input
          id={`${fieldId}-roles`}
          value={rolesText}
          placeholder={t("예: API 개발, 인증, 테스트")}
          aria-describedby={`${fieldId}-roles-hint${metadataError ? ` ${fieldId}-metadata-error` : ""}`}
          aria-invalid={Boolean(metadataError)}
          onChange={(event) => onRolesChange(event.target.value)}
        />
        <span className="field-hint" id={`${fieldId}-roles-hint`}>{t("쉼표로 구분해 최대 10개, 각 64자까지 입력할 수 있어요.")}</span>
      </div>
      <p className="field-hint">{t("비워 둔 항목은 기존 담당 정보를 유지해요. 이미 연결된 Agent의 담당 정보는 여기서 바꿀 수 없어요. 새 Agent는 미입력 시 기타·태그 없음으로 등록돼요.")}</p>
      {metadataError && (
        <p
          id={`${fieldId}-metadata-error`}
          className="inline-error"
          role="alert"
        >
          {metadataError}
        </p>
      )}
      <div className="modal-footer">
        {onManualSetup && (
          <button
            className="button button-secondary"
            type="button"
            disabled={busy || !selectedTool}
            onClick={onManualSetup}
          >{t("직접 설정하기")}</button>
        )}
        <button
          className="button button-primary"
          type="submit"
          disabled={busy || !selectedTool}
        >{t("연결하기")}</button>
      </div>
      {onManualSetup && (
        <p className="field-hint">{t("직접 설정은 Agent와 이 PC의 연결을 준비한 뒤, AI 도구 설정을 직접 적용하는 방식입니다.")}</p>
      )}
    </form>
  );
}
