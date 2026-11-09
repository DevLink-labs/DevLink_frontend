import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import DependencyTreeFrame from "./DependencyTreeFrame";
import DependencyTreeLines from "./DependencyTreeLines";
import {
  COMMON_ID, SELF_ID, buildModel, collapsedSummary, currentWorkers, fileKey, isFileModule, keyFor, layoutRadial,
  memberFocus, memberList, rootBranches, visibleTree,
} from "../model/dependencyTreeLayout";

const nodeKinds = {
  PAGE: "페이지", COMPONENT: "컴포넌트", HOOK: "훅", HTTP_CLIENT: "API 호출", COMMON: "공통", SELF: "페이지 자체 호출",
  ENDPOINT: "엔드포인트", SERVICE: "서비스", REPOSITORY: "레포지토리", DB_TABLE: "DB 테이블", MODULE: "함수",
};
const groupKinds = { SERVICE: "서비스", REPOSITORY: "레포지토리", DB_TABLE: "DB 테이블" };
/** 묶음 카드에 바로 보여줄 항목 수. 나머지는 "외 N개"로 줄인다. */
const groupLimit = 8;

function wrapNodeName(label) {
  return label.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[._])(?=\w)/).map((part, index) => (
    <Fragment key={index}>{index > 0 && <wbr />}{part}</Fragment>
  ));
}

/** 맞춤에서 작은 그래프를 키우는 상한. 카드가 지나치게 커지지 않게 막는다. */
const maxFitScale = 1.6;
const fitModes = [["both", "전체 맞춤"], ["width", "가로 맞춤"], ["none", "원본 크기"]];
/** 방사형 간격. ring은 중심에서 1단까지, step은 단 사이, minArc는 같은 단 이웃 카드 사이 최소 호 길이(px). */
const metrics = { ring: 300, step: 250, minArc: 150, spread: 1.4 };
/** 카드 크기 추정치. 캔버스 크기와 여백 계산에만 쓴다. */
const cardSize = { width: 260, height: 140, pad: 40 };

function parentKey(key) {
  return key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : null;
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
  const [openPath, setOpenPath] = useState(null);
  const [pair, setPair] = useState(null);
  const [member, setMember] = useState(null);
  const [fit, setFit] = useState("both");
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
  const model = useMemo(() => buildModel(activeGraph), [activeGraph]);
  const branches = useMemo(() => sourceRepo ? rootBranches(model, sourceRepo) : [], [model, sourceRepo]);
  const repoIds = useMemo(() => new Set(visibleRepos.map(({ repoId }) => repoId)), [visibleRepos]);
  const workers = useMemo(() => currentWorkers(activity, now), [activity, now]);
  const members = useMemo(() => memberList(workers, repoIds), [workers, repoIds]);
  const focus = useMemo(() => member !== null && members.some(({ userId }) => userId === member)
    ? memberFocus(model, workers, member, repoIds) : null, [model, workers, member, members, repoIds]);
  const tree = useMemo(() => visibleTree(model, branches, openPath, focus ? focus.touches : null), [model, branches, openPath, focus]);
  /** 배치와 캔버스 크기, 선의 좌표를 한 번에 계산한다. 카드 좌표는 캔버스 왼쪽 위 기준으로 옮겨 둔다. */
  const scene = useMemo(() => {
    const { entries, bounds } = layoutRadial(tree, metrics);
    const originX = -bounds.minX + cardSize.width / 2 + cardSize.pad;
    const originY = -bounds.minY + cardSize.height / 2 + cardSize.pad;
    const placed = entries.map((entry) => ({ ...entry, x: originX + entry.x, y: originY + entry.y }));
    const byKey = new Map(placed.map((entry) => [entry.key, entry]));
    const links = placed.map((entry) => {
      const from = entry.parentKey ? byKey.get(entry.parentKey) : { x: originX, y: originY };
      return { key: entry.key, x1: from.x, y1: from.y, x2: entry.x, y2: entry.y, http: entry.node?.kind === "ENDPOINT" && entry.depth > 1 };
    });
    return {
      entries: placed, links, originX, originY,
      width: bounds.maxX - bounds.minX + cardSize.width + cardSize.pad * 2,
      height: bounds.maxY - bounds.minY + cardSize.height + cardSize.pad * 2,
    };
  }, [tree]);
  const { originX, originY, width, height } = scene;
  const onOpenPath = (key) => Boolean(openPath && (openPath === key || openPath.startsWith(key + "/")));
  const inFocus = (entry) => {
    if (!focus) return true;
    const touched = (id) => focus.working.has(id) || focus.impact.has(id);
    if (entry.group) return entry.items.some(({ id }) => touched(id));
    if (entry.id === COMMON_ID || entry.virtual) return entry.childIds.some((id) => touched(id) || focus.touches(id));
    return touched(entry.id);
  };
  const entryByKey = new Map(scene.entries.map((entry) => [entry.key, entry]));
  const links = scene.links.map((link) => {
    const entry = entryByKey.get(link.key);
    return { ...link, highlight: onOpenPath(link.key) || Boolean(focus && inFocus(entry)), dim: Boolean(focus && !inFocus(entry)) };
  });

  const chosen = model.nodeById.get(selected) ?? null;
  const people = (node) => [...(workers.get(fileKey(node.repoId, node.source.relativePath))?.values() ?? [])];
  const unknown = focus
    ? focus.outside.map((person) => [fileKey(person.repoId, person.relativePath), new Map([[person.userId, person]])])
    : [...workers.entries()].filter(([key, entries]) => !model.byFile.has(key) && repoIds.has(entries.values().next().value.repoId));

  function activate(entry) {
    if (entry.group) return;
    setSelected(entry.node ? entry.id : null);
    if (entry.collapsible) setOpenPath(onOpenPath(entry.key) ? parentKey(entry.key) : entry.key);
  }
  function locate(id) {
    setSelected(id);
    const key = keyFor(model, branches, id);
    if (key) setOpenPath(key);
  }

  if (!sourceRepo) {
    return <DependencyTreeFrame {...frame}><div className="dependency-empty"><p>등록된 저장소가 없습니다.</p></div></DependencyTreeFrame>;
  }

  const controls = <>
    {frame.controls}
    {(frontends.length > 1 || !frontends.length && backends.length > 1) && (
      <label>저장소 <select value={sourceRepo.repoId} onChange={(event) => { setPair(Number(event.target.value)); setSelected(null); setOpenPath(null); }}>
        {(frontends.length ? frontends : backends).map((repo) => <option key={repo.repoId} value={repo.repoId}>{repo.displayName}</option>)}
      </select></label>
    )}
    <label>노드 <select value={chosen?.id ?? ""} onChange={(event) => event.target.value && locate(event.target.value)}>
      <option value="">찾기</option>
      {activeGraph.nodes.filter((node) => node.kind !== "MODULE" && !isFileModule(node))
        .map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
    </select></label>
    <div className="dependency-fit" role="group" aria-label="그래프 크기">
      {fitModes.map(([mode, label]) => (
        <button className="dependency-fit-button" type="button" key={mode} aria-pressed={fit === mode} onClick={() => setFit(mode)}>
          {label}
        </button>
      ))}
    </div>
  </>;

  const summary = focus?.summary;
  const toolbar = (
    <div className="dependency-members" role="group" aria-label="팀원 선택">
      <span className="dependency-members-label">팀원</span>
      <button type="button" className="dependency-chip" aria-pressed={member === null} onClick={() => setMember(null)}>전체</button>
      {members.map((person) => (
        <button type="button" className="dependency-chip" key={person.userId} aria-pressed={member === person.userId}
          onClick={() => setMember(member === person.userId ? null : person.userId)}>
          {person.displayName} · {person.files}
        </button>
      ))}
      {!members.length && <span className="dependency-members-summary">지금 작업 중인 팀원이 없습니다.</span>}
      {focus && <span className="dependency-members-summary" aria-live="polite">
        작업 중 노드 {focus.working.size} · 영향 페이지 {summary.pages} · API {summary.apis} · 엔드포인트 {summary.endpoints} · 테이블 {summary.tables}
        {focus.outside.length > 0 && ` · 트리 밖 ${focus.outside.length} (집계 제외)`}
      </span>}
    </div>
  );

  const endpointOf = chosen?.kind === "HTTP_CLIENT" ? model.nodeById.get(model.callTarget.get(chosen.id)) : null;
  const chosenVia = (scene.entries.find((entry) => entry.id === selected)?.via ?? []).map((id) => model.nodeById.get(id)).filter(Boolean);
  const callSites = (endpointId) => (model.callSources.get(endpointId) ?? []).map((id) => model.nodeById.get(id)).filter(Boolean);
  const pagesOf = (ids) => new Set(ids.flatMap((id) => model.pagesFor(id)));
  const panel = <>
    {frame.panel}
    {chosen && (
      <details className="dependency-detail" aria-live="polite">
        <summary><strong>{chosen.label}</strong> <span className="dependency-type">{nodeKinds[chosen.kind] ?? chosen.kind}</span></summary>
        <code>{chosen.source.relativePath}:{chosen.source.line}</code>
        {chosen.httpRoute && <code>{chosen.httpRoute.method} {chosen.httpRoute.pathTemplate}</code>}
        {chosen.kind === "HTTP_CLIENT" && (endpointOf
          ? <span>엔드포인트 {endpointOf.httpRoute.method} {endpointOf.httpRoute.pathTemplate} · {endpointOf.source.relativePath}:{endpointOf.source.line}</span>
          : <p>{chosen.httpRoute ? "대상 BE 설정과 일치하는 엔드포인트를 확인하세요." : "코드에서 HTTP 경로를 확정할 수 없습니다."}</p>)}
        {chosen.kind === "ENDPOINT" && (() => {
          const sites = callSites(chosen.id);
          return sites.length
            ? <>
              <span>호출 지점 {sites.length}개 · 사용 페이지 {pagesOf(sites.map(({ id }) => id)).size}개</span>
              <ul>{sites.map((site) => (
                <li key={site.id}>{site.label} ← {model.pagesFor(site.id).map((id) => model.nodeById.get(id).label).join(", ") || "공통"}</li>
              ))}</ul>
            </>
            : <span>FE 호출 지점이 없습니다.</span>;
        })()}
        {chosen.kind === "COMPONENT" && model.pagesFor(chosen.id).length > 1
          && <span>사용 페이지 {model.pagesFor(chosen.id).map((id) => model.nodeById.get(id).label).join(", ")}</span>}
        {chosenVia.length > 0 && <>
          <span>경유 {chosenVia.map(({ label }) => label).join(" → ")}</span>
          <ul>{chosenVia.map((step) => (
            <li key={step.id}>{step.label} · {step.source.relativePath}:{step.source.line}
              {people(step).length > 0 && ` · ${people(step).map(({ displayName }) => displayName).join(", ")} 작업 중`}</li>
          ))}</ul>
        </>}
        {people(chosen).map((person) => (
          <span key={person.userId}>{person.displayName} · {person.branchName ?? "브랜치 없음"} · {new Date(person.observedAt).toLocaleTimeString("ko-KR")} 관측</span>
        ))}
      </details>
    )}
    {unknown.length > 0 && <details className="dependency-detail">
      <summary>트리 밖 작업 파일 {unknown.length}개{focus ? " · 집계 제외" : ""}</summary>
      <ul>{unknown.map(([key, entries]) => {
        const entriesList = [...entries.values()];
        return <li key={key}>{entriesList[0].relativePath} · {entriesList.map(({ displayName }) => displayName).join(", ")}</li>;
      })}</ul>
    </details>}
    {graph.unmatchedCallCount > 0 && <p className="dependency-note">연결되지 않은 API 호출 {graph.unmatchedCallCount}개</p>}
  </>;

  function renderGroup(entry) {
    const { x, y } = entry;
    const shown = entry.items.slice(0, groupLimit);
    return (
      <div className="dependency-card dependency-group" key={entry.key} data-kind={entry.group} data-rich
        data-dim={focus && !inFocus(entry) || undefined} style={{ left: x, top: y }}>
        <span className="dependency-type">{groupKinds[entry.group]} {entry.items.length}</span>
        <ul className="dependency-group-list">
          {shown.map((item) => {
            const editing = people(item);
            return (
              <li key={item.id}>
                <button type="button" className="dependency-item" aria-pressed={selected === item.id}
                  data-dim={focus && !(focus.working.has(item.id) || focus.impact.has(item.id)) || undefined}
                  data-working={focus?.working.has(item.id) || undefined} onClick={() => setSelected(item.id)}>
                  <span>{wrapNodeName(item.label)}</span>
                  {editing.length > 0 && <span className={"dependency-pill " + (item.kind === "DB_TABLE" ? "dependency-pill--schema" : "dependency-pill--working")}>
                    {editing.map(({ displayName }) => displayName).join(", ")}
                  </span>}
                </button>
              </li>
            );
          })}
          {entry.items.length > shown.length && <li className="dependency-meta">외 {entry.items.length - shown.length}개</li>}
        </ul>
      </div>
    );
  }

  function renderNode(entry) {
    const { x, y } = entry;
    const node = entry.node;
    const kind = node ? node.kind : entry.virtual === SELF_ID ? "SELF" : "COMMON";
    // 접힌 훅·함수의 작업자는 이 카드에 함께 표시한다.
    // API 정의 함수(label이 호출 지점 라벨의 앞부분)는 같은 이름이 반복되므로 경유 표시에서 뺀다.
    const viaNodes = entry.via.map((id) => model.nodeById.get(id))
      .filter((step) => step && !(node && node.label.startsWith(step.label + " · ")));
    const editing = node ? [...new Map([...people(node), ...viaNodes.flatMap(people)].map((person) => [person.userId, person])).values()] : [];
    const shared = node?.kind === "COMPONENT" ? model.pagesFor(node.id).length : 0;
    const meta = [
      viaNodes.length ? `${viaNodes.map(({ label }) => label).join(" → ")} 경유` : null,
      entry.collapsible && !entry.open ? collapsedSummary(model, entry) : null,
      shared > 1 ? `사용 페이지 ${shared}` : null,
    ].filter(Boolean).join(" · ") || null;
    const endpoint = node?.kind === "ENDPOINT" && node.httpRoute;
    const schema = node?.kind === "DB_TABLE";
    return (
      <button type="button" className="dependency-card dependency-node" key={entry.key} data-node-id={entry.id} data-kind={kind}
        data-rich={Boolean(meta || editing.length || endpoint) || undefined}
        data-open={entry.collapsible && entry.open || undefined} data-active={onOpenPath(entry.key) || undefined}
        data-dim={focus && !inFocus(entry) || undefined} data-working={focus?.working.has(entry.id) || undefined}
        aria-pressed={node ? selected === entry.id : undefined} aria-expanded={entry.collapsible ? entry.open : undefined}
        style={{ left: x, top: y }} onClick={() => activate(entry)}>
        <span className="dependency-type">{nodeKinds[kind] ?? kind}</span>
        {endpoint ? <>
          <span className="dependency-pill dependency-pill--method">{node.httpRoute.method}</span>
          <code className="dependency-code" title={node.httpRoute.pathTemplate}>{node.httpRoute.pathTemplate}</code>
        </> : <strong className="dependency-name">{node ? wrapNodeName(node.label) : kind === "SELF" ? "직접 호출" : "공통"}</strong>}
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
  }

  const area = sourceRepo.repoKind === "FRONTEND" ? "FRONTEND" : "BACKEND";
  return (
    <DependencyTreeFrame {...frame} controls={controls} toolbar={toolbar} panel={panel}>
      <div className="dependency-viewport" ref={viewport} role="region" aria-label="저장소 트리" tabIndex={0}>
        <div className="dependency-stage" ref={stage}>
          <div className="dependency-radial" ref={canvas} style={{ width, height }}>
            <DependencyTreeLines links={links} width={width} height={height} />
            <header className="dependency-card dependency-root" data-kind="ROOT" data-rich data-node-id={`root:${sourceRepo.repoId}`}
              style={{ left: originX, top: originY }}>
              <span className="dependency-type">{area} REPO</span>
              <strong className="dependency-name">{sourceRepo.displayName}</strong>
              <span className="dependency-meta">{sourceRepo.branchName} · {sourceRepo.analysisCommitSha?.slice(0, 8) ?? "첫 분석 대기"}</span>
            </header>
            {scene.entries.map((entry) => entry.group ? renderGroup(entry) : renderNode(entry))}
            {sourceRepo.analysisCommitSha && !tree.length && <p className="dependency-empty-note">표시할 의존성 노드가 없습니다.</p>}
          </div>
        </div>
      </div>
    </DependencyTreeFrame>
  );
}
