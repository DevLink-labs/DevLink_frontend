import { useEffect, useState } from "react";
import BrandLogo from "@/components/common/BrandLogo";
import { Icon } from "@/components/ui";
import DemoStages from "./DemoStages";
import { demoSteps } from "../data/demoScenario";
import "../styles/service-demo.css";

function readScene() {
  const params = new URLSearchParams(window.location.search);
  const stepIndex = Math.max(0, demoSteps.findIndex(({ id }) => id === params.get("step")));
  const mode = params.get("capture") === "1" ? "capture" : params.get("record") === "1" ? "record" : "interactive";
  const lastAction = demoSteps[stepIndex].actions.length;
  const snapshot = params.has("progress") ? Number(params.get("progress")) : lastAction;
  const progress = Number.isInteger(snapshot) && snapshot >= 0 && snapshot <= lastAction ? snapshot : lastAction;
  return { stepIndex, mode, progress: mode === "capture" ? progress : 0 };
}

function sceneHref(stepIndex, mode, progress) {
  const params = new URLSearchParams({ step: demoSteps[stepIndex].id });
  if (mode !== "interactive") params.set(mode, "1");
  if (mode === "capture" && progress !== undefined) params.set("progress", String(progress));
  return `/demo?${params}`;
}

export default function ServiceDemoView() {
  const [{ stepIndex, progress, mode }, setScene] = useState(readScene);
  const step = demoSteps[stepIndex];
  const action = step.actions[progress];
  const finalStep = stepIndex === demoSteps.length - 1;
  const capturing = mode === "capture";
  const clean = mode !== "interactive";
  const choosingSetup = step.id === "connect" && progress === 2;

  useEffect(() => {
    const restoreScene = () => setScene(readScene());
    window.addEventListener("popstate", restoreScene);
    return () => window.removeEventListener("popstate", restoreScene);
  }, []);

  useEffect(() => {
    if (!clean) return;
    function handlePresentationKeys(event) {
      const offset = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (event.key === "Escape") {
        window.history.replaceState(null, "", sceneHref(stepIndex, "interactive"));
        setScene((current) => ({ ...current, mode: "interactive" }));
        return;
      }
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (offset && demoSteps[stepIndex + offset]) {
        event.preventDefault();
        window.history.pushState(null, "", sceneHref(stepIndex + offset, mode));
        setScene(readScene());
      } else if (mode === "record" && event.key === "Enter" && !event.defaultPrevented
        && !event.repeat && !(event.target instanceof Element && event.target.closest("button, a, summary"))) {
        if (choosingSetup) return;
        event.preventDefault();
        if (action) {
          setScene((current) => ({ ...current, progress: current.progress + 1 }));
        } else {
          window.history.pushState(null, "", sceneHref(finalStep ? 0 : stepIndex + 1, mode));
          setScene(readScene());
        }
      }
    }
    window.addEventListener("keydown", handlePresentationKeys);
    return () => window.removeEventListener("keydown", handlePresentationKeys);
  }, [action, choosingSetup, clean, finalStep, mode, stepIndex]);

  function openStep(index) {
    if (index === stepIndex) return;
    window.history.pushState(null, "", sceneHref(index, mode));
    setScene(readScene());
  }

  function changeMode(nextMode) {
    window.history.replaceState(null, "", sceneHref(stepIndex, nextMode, progress));
    setScene((current) => ({ ...current, mode: nextMode }));
  }

  function reset() {
    setScene((current) => ({ ...current, progress: 0 }));
  }

  function advance() {
    if (capturing) return;
    if (action) {
      setScene((current) => ({ ...current, progress: Math.min(current.progress + 1, step.actions.length) }));
    } else if (finalStep) {
      openStep(0);
    } else {
      openStep(stepIndex + 1);
    }
  }

  return (
    <main className={`service-demo${clean ? ` is-${mode}` : ""}`}>
      <div className="demo-shell">
        <header className="demo-topbar">
          <BrandLogo />
          <div className="demo-top-actions">
            <button className="demo-control" type="button" onClick={() => changeMode("record")} title="조작 영역 숨기기 · Enter로 진행 · 방향키로 이동 · Esc로 종료">녹화 모드</button>
            <button className="demo-control" type="button" onClick={() => changeMode("capture")} title="현재 화면에서 시연 조작과 애니메이션 숨기기"><Icon name="eye" size={17} />캡처 모드</button>
          </div>
        </header>

        <div className="demo-intro demo-stage-enter" key={`intro-${step.id}`}>
          <h1>{step.title}</h1>
          <p>{step.description}</p>
        </div>

        <nav aria-label="DevLink 시연 단계">
          <ol className="demo-steps">
            {demoSteps.map((item, index) => (
              <li key={item.id}>
                <button className="demo-step" type="button" aria-current={index === stepIndex ? "step" : undefined} onClick={() => openStep(index)}>
                  <span className="demo-step-number" aria-hidden="true">{index + 1}</span>{item.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="demo-controls">
          <div className="demo-action-copy" role="status">
            {action ? <p>{action.description}</p> : <strong>{finalStep ? "시연 완료" : `${step.label} 완료`}</strong>}
          </div>
          <div className="demo-buttons">
            {progress > 0 && <button className="demo-control" type="button" onClick={reset}><Icon name="refresh" size={16} />장면 다시 보기</button>}
            {!choosingSetup && <button className="demo-control is-primary" type="button" onClick={advance}>{action?.label ?? (finalStep ? "처음으로" : "다음 단계")}<Icon name="arrow" size={17} /></button>}
          </div>
        </div>

        <DemoStages key={step.id} step={step} progress={progress} capture={capturing} onAdvance={advance} onReset={reset} onOpenStep={openStep} />
      </div>

      {clean && (
        <div className="demo-presentation-controls">
          {mode === "record" && !choosingSetup && <button className="demo-control" type="button" onClick={advance} title="Enter로 진행 · 방향키로 이동">{action?.label ?? (finalStep ? "처음으로" : "다음 단계")}<Icon name="arrow" size={17} /></button>}
          <button className="demo-control" type="button" onClick={() => changeMode("interactive")} title="Esc로 종료 · 방향키로 단계 이동"><Icon name="close" size={18} />{capturing ? "캡처" : "녹화"} 모드 종료</button>
        </div>
      )}
    </main>
  );
}
