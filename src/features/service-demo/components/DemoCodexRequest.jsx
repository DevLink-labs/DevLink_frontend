import codexLogo from "@/assets/image/agent-logo/chatgpt.svg";
import { Icon } from "@/components/ui";
import { demoActors, demoProject, demoTask } from "../data/demoScenario";
import "../styles/demo-codex.css";

export default function DemoCodexRequest({ progress, onAdvance }) {
  const sent = progress > 0;

  return (
    <section className="demo-codex" aria-label="Codex CLI 작업 요청 시연">
      <header className="demo-codex-titlebar">
        <div className="demo-codex-tab">
          <img src={codexLogo} alt="" width="18" height="18" />
          <strong>Codex</strong>
        </div>
        <span>Windows Terminal 시연</span>
      </header>

      <div className="demo-codex-session">
        <div className="demo-codex-context">
          <p><span aria-hidden="true">&gt;_</span> OpenAI Codex</p>
          <dl><dt>directory:</dt><dd><code>{demoProject}</code></dd></dl>
        </div>

        <div className="demo-codex-prompt" role="group" aria-label={sent ? "보낸 메시지" : "보낼 메시지"}>
          <span aria-hidden="true">›</span>
          <p>{demoTask.prompt}</p>
        </div>

        {sent && (
          <div className="demo-codex-dispatch" role="status">
            <div className="demo-codex-tool">
              <Icon name="check" size={16} />
              <span>DevLink MCP</span>
              <code>create_task</code>
            </div>
            <p><strong>{demoActors.receiver.name}</strong>에게 요청을 보냈습니다.</p>
            <p className="demo-codex-task"><span>작업 #{demoTask.id}</span><span>수락 대기</span></p>
          </div>
        )}
      </div>

      <footer className="demo-codex-actions">
        <span>{demoActors.requester.name} · DevLink MCP 연결됨</span>
        <button type="button" className="demo-codex-send" onClick={onAdvance}>
          {sent ? "DevLink에서 요청 확인" : "요청 보내기"}<Icon name="arrow" size={16} />
        </button>
      </footer>
    </section>
  );
}
