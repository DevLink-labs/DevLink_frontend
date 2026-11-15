import { useTranslation } from "@/lib/i18n";
import { Icon } from "@/components/ui";

export default function ProjectFolderPicker({ busy = false, onPickFolder }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="project-connect-folder">
        <span className="project-connect-symbol">
          <Icon name="grid" size={26} />
        </span>
        <h3>{t("PC에서 작업할 폴더를 선택하세요")}</h3>
        <p>{t("폴더와 AI 도구를 선택하면 Agent 등록과 연결 설정을 함께 진행해요.")}</p>
      </div>
      <div className="modal-footer">
        <button
          className="button button-primary"
          type="button"
          disabled={busy}
          onClick={onPickFolder}
        >
          {busy ? t("폴더 선택 및 도구 확인 중…") : t("폴더 선택")}
        </button>
      </div>
    </>
  );
}
