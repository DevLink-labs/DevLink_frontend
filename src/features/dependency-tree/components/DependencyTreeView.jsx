import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import DependencyTreeFrame from "./DependencyTreeFrame";
import DependencyTreeLines from "./DependencyTreeLines";
import { currentWorkers, displayGraph, fileKey, repositoryRows, upstream } from "../model/dependencyTreeLayout";

const nodeKinds = {
  PAGE: "페이지", COMPONENT: "컴포넌트", HOOK: "훅", HTTP_CLIENT: "API 호출",
  ENDPOINT: "엔드포인트", SERVICE: "서비스", REPOSITORY: "REPOSITORY", DB_TABLE: "DB 테이블", MODULE: "모듈",
};

function wrapNodeName(label) {
  return label.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[._])(?=\w)/).map((part, index) => (
    <Fragment key={index}>{index > 0 && <wbr />}{part}</Fragment>
  ));
}

/** 맞춤에서 작은 그래프를 키우는 상한. 카드가 지나치게 커지지 않게 막는다. */
const maxFitScale = 1.6;
/** 크기 모드. 기본은 전체 구조가 한 화면에 들어오는 전체 맞춤이며, 이때 다이어그램은 컴팩트 간격을 쓴다. */
const fitModes = [["both", "전체 맞춤"], ["width", "가로 맞춤"], ["none", "원본 크기"]];
/** 상세 패널이 오른쪽 열로 도킹되는 폭. dependencyTree.css의 미디어 쿼리와 같은 값이다. */
const dockedPanel = window.matchMedia("(min-width: 1101px)");
function useDockedPanel() {
  return useSyncExternalStore(
    (notify) => { dockedPanel.addEventListener("change", notify); return () => dockedPanel.removeEventListener("change", notify); },
    () => dockedPanel.matches,
  );
}

/**
 * @param {{ graph: object, activity?: object, frame?: object }} props
 * frame은 DependencyTreeFrame에 그대로 넘기는 제목·링크·추가 컨트롤·패널 내용이다.
 */
export default function DependencyTreeView({ graph, activity, frame = {} }) {
  const viewport = useRef(null);
  const stage = useRef(null);
  const canvas = useRef(null);
  const [selected, setSelected] = useState(null);
  const [pair, setPair] = useState(null);
  const [fit, setFit] = useState("both");
  const docked = useDockedPanel();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!activity?.receivedAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activity?.receivedAt]);

  const { frontends, backends, sourceRepo, visibleRepos } = useMemo(() => {
    const frontends = graph.repositories.filter(({ repoKind }) => repoKind === "FRONTEND");
    const backends = graph.repositories.filter(({ repoKind }) => repoKind === "BACKEND");
    const front = frontends.find(({ repoId }) => repoId === pair) ?? frontends[0];
    const back = backends.find(({ repoId }) => repoId === front?.targetRepoId)
      ?? (front ? backends[0] : backends.find(({ repoId }) => repoId === pair) ?? backends[0]);
    return { frontends, backends, sourceRepo: front ?? back, visibleRepos: [front, back].filter(Boolean) };
  }, [graph.repositories, pair]);
  const hasRepository = Boolean(sourceRepo);

  useLayoutEffect(() => {
    const frame = viewport.current;
    const surface = stage.current;
    const diagram = canvas.current;
    if (!frame || !surface || !diagram) return undefined;

    function measure() {
      const style = getComputedStyle(frame);
      const diagramStyle = getComputedStyle(diagram);
      const width = parseFloat(diagramStyle.width);
      const height = parseFloat(diagramStyle.height);
      if (!width || !height) return;
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = Math.max(1, frame.clientWidth - paddingX);
      const availableHeight = Math.max(1, frame.clientHeight - paddingY);
      const scale = fit === "none" ? 1 : Math.min(maxFitScale, availableWidth / width,
        fit === "both" ? availableHeight / height : Infinity);
      surface.style.setProperty("--tree-fit-scale", scale);
      surface.style.setProperty("--tree-fitted-width", width * scale + "px");
      surface.style.setProperty("--tree-fitted-height", height * scale + "px");
    }

    let pending;
    function resize() {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(measure);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    observer.observe(diagram);
    const page = frame.closest(".dependency-page");
    if (page) observer.observe(page);
    window.addEventListener("resize", resize);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(pending);
    };
  }, [fit, hasRepository]);

  const activeGraph = useMemo(() => {
    const ids = new Set(visibleRepos.map(({ repoId }) => repoId));
    const nodes = graph.nodes.filter(({ repoId }) => ids.has(repoId));
    const keys = new Set(nodes.map(({ id }) => id));
    return { nodes, edges: graph.edges.filter(({ sourceId, targetId }) => keys.has(sourceId) && keys.has(targetId)) };
  }, [graph, visibleRepos]);
  const nodeById = useMemo(() => new Map(activeGraph.nodes.map((node) => [node.id, node])), [activeGraph]);
  const firstMatchedEndpoint = activeGraph.edges.find(({ relationType }) => relationType === "HTTP_CALL")?.targetId;
  const chosen = nodeById.get(selected) ?? nodeById.get(firstMatchedEndpoint)
    ?? activeGraph.nodes.find(({ kind }) => kind === "PAGE") ?? activeGraph.nodes[0];
  const view = useMemo(() => displayGraph(activeGraph, chosen?.id), [activeGraph, chosen?.id]);
  const rows = useMemo(() => visibleRepos.map((repo) => ({
    repo,
    rows: repositoryRows(view.nodes.filter(({ repoId }) => repoId === repo.repoId), view.edges),
  })), [visibleRepos, view]);
  const edges = useMemo(() => {
    const parents = new Set(view.edges.filter(({ relationType }) => relationType !== "HTTP_CALL").map(({ targetId }) => targetId));
    return [...view.edges, ...rows.flatMap(({ repo, rows: layers }) => (layers[0] ?? [])
      .filter(({ id }) => !parents.has(id)).map(({ id }) => ({
        sourceId: `root:${repo.repoId}`, targetId: id, relationType: "GROUP",
      })))];
  }, [view, rows]);
  const workers = useMemo(() => currentWorkers(activity, now), [activity, now]);
  const people = (node) => [...(workers.get(fileKey(node.repoId, node.source.relativePath))?.values() ?? [])];
  const focus = chosen ? upstream(chosen.id, activeGraph.edges.filter(({ relationType }) => relationType !== "IMPORT")) : new Set();
  const calls = activeGraph.edges.filter(({ relationType, sourceId, targetId }) => relationType === "HTTP_CALL"
    && (chosen?.id === sourceId || focus.has(sourceId) && focus.has(targetId)));
  for (const { targetId } of calls) focus.add(targetId);
  const pagesFor = (id) => [...upstream(id, activeGraph.edges.filter(({ relationType }) => relationType !== "IMPORT"))]
    .filter((key) => nodeById.get(key)?.kind === "PAGE");
  const pageIds = new Set(calls.flatMap(({ sourceId }) => pagesFor(sourceId)));
  const knownPaths = new Set(activeGraph.nodes.map((node) => fileKey(node.repoId, node.source.relativePath)));
  const repoIds = new Set(visibleRepos.map(({ repoId }) => repoId));
  const unknown = [...workers.entries()].filter(([key, entries]) => !knownPaths.has(key) && repoIds.has(entries.values().next().value.repoId));

  if (!sourceRepo) {
    return <DependencyTreeFrame {...frame}><div className="dependency-empty"><p>등록된 저장소가 없습니다.</p></div></DependencyTreeFrame>;
  }
  const controls = <>
    {frame.controls}
    {(frontends.length > 1 || !frontends.length && backends.length > 1) && (
      <label>저장소 <select value={sourceRepo.repoId} onChange={(event) => { setPair(Number(event.target.value)); setSelected(null); }}>
        {(frontends.length ? frontends : backends).map((repo) => <option key={repo.repoId} value={repo.repoId}>{repo.displayName}</option>)}
      </select></label>
    )}
    {chosen && <label>노드 <select value={chosen.id} onChange={(event) => setSelected(event.target.value)}>
      {activeGraph.nodes.filter(({ kind, id }) => kind !== "MODULE" || id === chosen.id)
        .map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
    </select></label>}
    <div className="dependency-fit" role="group" aria-label="그래프 크기">
      {fitModes.map(([mode, label]) => (
        <button className="dependency-fit-button" type="button" key={mode} aria-pressed={fit === mode} onClick={() => setFit(mode)}>
          {label}
        </button>
      ))}
    </div>
  </>;
  const partial = view.nodes.length < activeGraph.nodes.filter(({ kind }) => kind !== "MODULE").length;
  const panel = <>
    {frame.panel}
    {chosen && (
      <details className="dependency-detail" open={docked} aria-live="polite">
        <summary><strong>{chosen.label}</strong> <span className="dependency-type">{nodeKinds[chosen.kind] ?? chosen.kind}</span></summary>
        <code>{chosen.source.relativePath}:{chosen.source.line}</code>
        {chosen.httpRoute && <code>{chosen.httpRoute.method} {chosen.httpRoute.pathTemplate}</code>}
        {chosen.kind === "HTTP_CLIENT" && calls.length === 0 && <p>
          {chosen.httpRoute ? "대상 BE 설정과 일치하는 엔드포인트를 확인하세요." : "코드에서 HTTP 경로를 확정할 수 없습니다."}
        </p>}
        {chosen.kind === "COMPONENT" && pagesFor(chosen.id).length > 1
          && <span>사용 페이지 {pagesFor(chosen.id).map((id) => nodeById.get(id).label).join(", ")}</span>}
        {calls.length > 0 && <>
          <span>호출 지점 {calls.length}개 · 사용 페이지 {pageIds.size}개</span>
          <ul>{calls.map(({ sourceId, targetId }) => (
            <li key={`${sourceId}:${targetId}`}>{nodeById.get(sourceId).label} ← {pagesFor(sourceId).map((id) => nodeById.get(id).label).join(", ")}</li>
          ))}</ul>
        </>}
        {people(chosen).map((person) => (
          <span key={person.userId}>{person.displayName} · {person.branchName ?? "브랜치 없음"} · {new Date(person.observedAt).toLocaleTimeString("ko-KR")} 관측</span>
        ))}
      </details>
    )}
    {unknown.length > 0 && <details className="dependency-detail">
      <summary>트리 밖 작업 파일 {unknown.length}개</summary>
      <ul>{unknown.map(([key, entries]) => {
        const entriesList = [...entries.values()];
        return <li key={key}>{entriesList[0].relativePath} · {entriesList.map(({ displayName }) => displayName).join(", ")}</li>;
      })}</ul>
    </details>}
    {(partial || graph.unmatchedCallCount > 0) && <p className="dependency-note">
      {partial && `선택 노드 주변 ${view.nodes.length}개를 표시합니다. 노드 메뉴에서 다른 경로를 선택할 수 있습니다. `}
      {graph.unmatchedCallCount > 0 && `연결되지 않은 API 호출 ${graph.unmatchedCallCount}개`}
    </p>}
  </>;
  return (
    <DependencyTreeFrame {...frame} controls={controls} panel={panel}>
      <div className="dependency-viewport" ref={viewport} role="region" aria-label="저장소 트리" tabIndex={0}>
        <div className="dependency-stage" ref={stage}>
          <div className="dependency-diagram" ref={canvas} data-single-lane={rows.length === 1 || undefined}
            data-compact={fit === "both" || undefined}>
            <DependencyTreeLines canvas={canvas} edges={edges} focus={focus} onSelect={setSelected} />
            {rows.map(({ repo, rows: layers }) => {
              const area = repo.repoKind === "FRONTEND" ? "FRONTEND" : "BACKEND";
              return (
                <section className="dependency-lane" key={repo.repoId} data-repo-lane aria-label={area}>
                  <h2 className="dependency-area-label">{area}</h2>
                  <div className="dependency-ranks">
                    <div className="dependency-row">
                      <header className="dependency-card" data-kind="ROOT" data-rich data-node-id={`root:${repo.repoId}`}>
                        <span className="dependency-type">{area} REPO</span>
                        <strong className="dependency-name">{repo.displayName}</strong>
                        <span className="dependency-meta">{repo.branchName} · {repo.analysisCommitSha?.slice(0, 8) ?? "첫 분석 대기"}</span>
                      </header>
                    </div>
                    {layers.map((layer) => (
                      <div className="dependency-row" key={layer[0].id} style={{ "--tree-row-count": layer.length }}>
                        {layer.map((node) => {
                          const editing = people(node);
                          const endpoint = node.kind === "ENDPOINT";
                          const schema = node.kind === "DB_TABLE";
                          const count = endpoint
                            ? activeGraph.edges.filter((edge) => edge.targetId === node.id && edge.relationType === "HTTP_CALL").length
                            : node.kind === "COMPONENT" ? pagesFor(node.id).length : 0;
                          const meta = endpoint ? `호출 지점 ${count}개` : count > 1 ? `사용 페이지 ${count}개` : null;
                          return (
                            <button type="button" className={"dependency-card dependency-node" + (focus.has(node.id) ? " dependency-focused" : "")}
                              data-node-id={node.id} data-kind={node.kind} data-rich={Boolean(meta || editing.length) || undefined}
                              data-http-method={endpoint ? node.httpRoute?.method : undefined}
                              key={node.id} aria-pressed={chosen?.id === node.id} onClick={() => setSelected(node.id)}>
                              <span className="dependency-type">{nodeKinds[node.kind] ?? node.kind}</span>
                              {endpoint && node.httpRoute ? <>
                                <span className="dependency-pill dependency-pill--method">{node.httpRoute.method}</span>
                                <code className="dependency-code" title={node.httpRoute.pathTemplate}>{node.httpRoute.pathTemplate}</code>
                              </> : <strong className="dependency-name">{wrapNodeName(node.label)}</strong>}
                              {meta && <span className="dependency-meta">{meta}</span>}
                              {editing.length > 0 && (
                                <span className="dependency-workers">
                                  {editing.slice(0, 2).map((person) => <span className="dependency-pill" key={person.userId}>{person.displayName}</span>)}
                                  {editing.length > 2 && <span className="dependency-pill">+{editing.length - 2}명</span>}
                                  <span className={"dependency-pill " + (schema ? "dependency-pill--schema" : "dependency-pill--working")}>
                                    {schema ? "스키마 변경" : "● 작업 중"}
                                  </span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {repo.analysisCommitSha && !layers.length && <p>표시할 의존성 노드가 없습니다.</p>}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </DependencyTreeFrame>
  );
}
