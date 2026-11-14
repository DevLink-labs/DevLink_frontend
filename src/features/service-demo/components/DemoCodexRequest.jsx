import { useTranslation } from "@/lib/i18n";
import codexLogo from "@/assets/image/agent-logo/chatgpt.svg";
import { Icon } from "@/components/ui";
import { demoActors, demoProject, demoTask } from "../data/demoScenario";
import "../styles/demo-codex.css";

export default function DemoCodexRequest({ progress, onAdvance }) {
  const { t } = useTranslation();
  const sent = progress > 0;

  return (
    <section className="demo-codex" aria-label={t("Codex CLI 작업 요청 시연")}>
      <header className="demo-codex-titlebar">
        <div className="demo-codex-tab">
          <img src={codexLogo} alt="" width="18" height="18" />
          <strong>Codex</strong>
        </div>
        <span>{t("Windows Terminal 시연")}</span>
      </header>

      <div className="demo-codex-session">
        <div className="demo-codex-context">
          <p><span aria-hidden="true">&gt;_</span> OpenAI Codex</p>
          <dl><dt>directory:</dt><dd><code>{demoProject}</code></dd></dl>
        </div>

        <div className="demo-codex-prompt" role="group" aria-label={sent ? t("보낸 메시지") : t("보낼 메시지")}>
          <span aria-hidden="true">›</span>
          <p>{t(demoTask.prompt)}</p>
        </div>

        {sent && (
          <div className="demo-codex-dispatch" role="status">
            <div className="demo-codex-tool">
              <Icon name="check" size={16} />
              <span>DevLink MCP</span>
              <code>create_task</code>
            </div>
            <p>{t("{{agent}}에게 요청을 보냈습니다.", { agent: t(demoActors.receiver.name) })}</p>
            <p className="demo-codex-task"><span>{t("작업 #{{id}}", { id: demoTask.id })}</span><span>{t("수락 대기")}</span></p>
          </div>
        )}
      </div>

      <footer className="demo-codex-actions">
        <span>{t("{{agent}} · DevLink MCP 연결됨", { agent: t(demoActors.requester.name) })}</span>
        <button type="button" className="demo-codex-send" onClick={onAdvance}>
          {sent ? t("DevLink에서 요청 확인") : t("요청 보내기")}<Icon name="arrow" size={16} />
        </button>
      </footer>
    </section>
  );
}
