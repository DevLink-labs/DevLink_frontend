import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import DependencyTreeFrame from "./DependencyTreeFrame";
import {
  COMMON_ID, SELF_ID, buildModel, collapsedSummary, currentWorkers, fileKey, isFileModule, keyFor, layoutRadial,
  memberFocus, memberList, rootBranches, visibleTree,
} from "../model/dependencyTreeLayout";

/**
 * React Flow(@xyflow/react) 기반 트리 화면.
 * 배치 좌표는 직접 만든 방사형 모델(layoutRadial)에서 받고, 노드·엣지 렌더링, 팬·줌, 카메라 이동(fitView)은 라이브러리가 맡는다.
 */

const nodeKinds = {
  PAGE: "페이지", COMPONENT: "컴포넌트", HOOK: "훅", HTTP_CLIENT: "API 호출", COMMON: "공통", SELF: "페이지 자체 호출",
  ENDPOINT: "엔드포인트", SERVICE: "서비스", REPOSITORY: "레포지토리", DB_TABLE: "DB 테이블", MODULE: "함수",
};
/** 미니맵에 쓰는 종류별 카드 색. dependencyTree.css의 팔레트와 같다. */
const miniMapFill = {
  ROOT: "#D2E5FC", PAGE: "#D6DEF9", COMPONENT: "#E4DAF6", HOOK: "#F8DFCF", HTTP_CLIENT: "#F5EAC4", SELF: "#F5EAC4", COMMON: "#F1F5F9",
  ENDPOINT: "#F6D6E1", SERVICE: "#D2EEDF", REPOSITORY: "#CEEAF0", DB_TABLE: "#EEE3D0", MODULE: "#F8FAFC",
};
const fitModes = [["both", "전체 맞춤"], ["none", "원본 크기"], ["focus", "선택 중심"]];
/** 카메라 이동 시간(ms). */
const cameraDuration = 550;
const maxZoom = 1.6;
const minFocusZoom = 0.3;
const metrics = {
  ring: 300, step: 250, minArc: 150, spread: 1.4, backendStep: 190, backendSpread: 2.4,
  aspect: 1.6, cardWidth: 240, cardHeight: 110, gap: 24, maxCrowdFactor: 4,
};
const ROOT_ID = "root";

function wrapNodeName(label) {
  return label.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[._])(?=\w)/).map((part, index) => (
    <Fragment key={index}>{index > 0 && <wbr />}{part}</Fragment>
  ));
}

function parentKey(key) {
  return key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : null;
}

/** 커스텀 노드. 손으로 그리던 카드 마크업을 그대로 쓰고, 보이지 않는 핸들을 카드 가운데에 두어 선이 중심에서 중심으로 이어지게 한다. */
function CardNode({ data }) {
  const { kind, root, title, route, meta, editing, schema, flags, onActivate } = data;
  return (
    <>
      <Handle type="target" position={Position.Top} className="dependency-handle" isConnectable={false} />
      {/* 마우스 클릭은 React Flow의 onNodeClick이 받아 onActivate를 부른다(아래 FlowCanvas). 여기 onKeyDown은 키보드(Enter·Space) 전용이다. */}
      <button type="button" className={"dependency-card " + (root ? "dependency-root" : "dependency-node")} data-kind={kind}
        data-rich={flags.rich || undefined} data-open={flags.open || undefined} data-active={flags.active || undefined}
        data-dim={flags.dim || undefined} data-working={flags.working || undefined}
        aria-pressed={flags.pressed} aria-expanded={flags.expanded} title={root ? "처음 화면으로" : undefined}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onActivate(); } }}>
        <span className="dependency-type">{data.typeLabel}</span>
        {route ? <>
          <span className="dependency-pill dependency-pill--method">{route.method}</span>
          <code className="dependency-code" title={route.pathTemplate}>{route.pathTemplate}</code>
        </> : <strong className="dependency-name">{wrapNodeName(title)}</strong>}
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
      <Handle type="source" position={Position.Bottom} className="dependency-handle" isConnectable={false} />
    </>
  );
}

const nodeTypes = { card: CardNode };

/** ReactFlow 캔버스와 카메라. Provider 안에서만 useReactFlow를 쓸 수 있어 따로 뗀다. */
function FlowCanvas({ nodes, edges, fit, focusIds, cameraTick }) {
  const { fitView, zoomTo } = useReactFlow();
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    if (fit === "focus" && focusIds.length) {
      fitView({ nodes: focusIds.map((id) => ({ id })), duration: cameraDuration, padding: 0.15, minZoom: minFocusZoom, maxZoom });
    } else if (fit === "none") {
      zoomTo(1, { duration: cameraDuration });
    } else {
      fitView({ duration: cameraDuration, padding: 0.08, maxZoom });
    }
  }, [initialized, fit, focusIds, cameraTick, fitView, zoomTo]);
  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} nodeOrigin={[0.5, 0.5]}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} nodesFocusable={false} edgesFocusable={false}
      // 선택·드래그를 끄면 React Flow가 노드에 pointer-events: none을 주므로, 클릭 핸들러를 여기 등록해 포인터 이벤트를 살린다.
      onNodeClick={(event, node) => node.data?.onActivate?.()}
      minZoom={0.1} maxZoom={maxZoom} fitView fitViewOptions={{ padding: 0.08, maxZoom }}
      zoomOnDoubleClick={false}>
      <Background gap={32} size={1} />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap pannable zoomable position="bottom-right" nodeColor={(node) => miniMapFill[node.data?.kind] ?? "#E2E8F0"} nodeStrokeWidth={2} />
    </ReactFlow>
  );
}

/**
 * @param {{ graph: object, activity?: object, frame?: object }} props
 * frame은 DependencyTreeFrame에 그대로 넘기는 제목·링크·추가 컨트롤·패널 내용이다.
 */
export default function DependencyFlowView({ graph, activity, frame = {} }) {
  const [selected, setSelected] = useState(null);
  const [openPath, setOpenPath] = useState(null);
  const [pair, setPair] = useState(null);
  const [member, setMember] = useState(null);
  const [fit, setFit] = useState("both");
  const [focusKey, setFocusKey] = useState(null);
  const [cameraTick, setCameraTick] = useState(0);
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
  const layout = useMemo(() => layoutRadial(tree, metrics), [tree]);

  const onOpenPath = (key) => Boolean(openPath && (openPath === key || openPath.startsWith(key + "/")));
  const inFocus = (entry) => {
    if (!focus) return true;
    const touched = (id) => focus.working.has(id) || focus.impact.has(id);
    if (entry.id === COMMON_ID || entry.virtual) return entry.childIds.some((id) => touched(id) || focus.touches(id));
    return touched(entry.id);
  };
  const chosen = model.nodeById.get(selected) ?? null;
  const people = (node) => [...(workers.get(fileKey(node.repoId, node.source.relativePath))?.values() ?? [])];
  const unknown = focus
    ? focus.outside.map((person) => [fileKey(person.repoId, person.relativePath), new Map([[person.userId, person]])])
    : [...workers.entries()].filter(([key, entries]) => !model.byFile.has(key) && repoIds.has(entries.values().next().value.repoId));

  function resetView() {
    setOpenPath(null);
    setSelected(null);
    setFocusKey(null);
    setFit("both");
    setCameraTick((tick) => tick + 1);
  }
  function focusOn(key) {
    setFocusKey(key);
    setFit("focus");
    setCameraTick((tick) => tick + 1);
  }
  function activate(entry) {
    focusOn(entry.key);
    setSelected(entry.node ? entry.id : null);
    if (entry.collapsible) setOpenPath(onOpenPath(entry.key) ? parentKey(entry.key) : entry.key);
  }
  function locate(id) {
    setSelected(id);
    const key = keyFor(model, branches, id);
    if (key) {
      setOpenPath(key);
      focusOn(key);
    }
  }

  /** 선택 중심 카메라에 담을 노드: 누른 카드, 부모, 열린 자손 전체. */
  const focusIds = useMemo(() => {
    if (!focusKey) return [];
    const target = layout.entries.find((entry) => entry.key === focusKey);
    if (!target) return [];
    const ids = layout.entries.filter((entry) => entry.key === focusKey || entry.key.startsWith(focusKey + "/") || entry.key === target.parentKey)
      .map(({ key }) => key);
    if (!target.parentKey) ids.push(ROOT_ID);
    return ids;
  }, [layout, focusKey]);

  /** React Flow 노드·엣지. 좌표는 방사형 모델의 중심(0,0) 기준 그대로 쓰고 nodeOrigin을 가운데로 둔다. */
  const flowNodes = useMemo(() => {
    if (!sourceRepo) return [];
    const area = sourceRepo.repoKind === "FRONTEND" ? "FRONTEND" : "BACKEND";
    const rootNode = {
      id: ROOT_ID, type: "card", position: { x: 0, y: 0 }, draggable: false,
      data: {
        kind: "ROOT", root: true, typeLabel: `${area} REPO`, title: sourceRepo.displayName, route: null, editing: [], schema: false,
        meta: `${sourceRepo.branchName} · ${sourceRepo.analysisCommitSha?.slice(0, 8) ?? "첫 분석 대기"}`,
        flags: { rich: true }, onActivate: resetView,
      },
    };
    const cards = layout.entries.map((entry) => {
      const node = entry.node;
      const kind = node ? node.kind : entry.virtual === SELF_ID ? "SELF" : "COMMON";
      const viaNodes = entry.via.map((id) => model.nodeById.get(id))
        .filter((step) => step && !(node && node.label.startsWith(step.label + " · ")));
      const editing = node ? [...new Map([...people(node), ...viaNodes.flatMap(people)].map((person) => [person.userId, person])).values()] : [];
      const shared = node?.kind === "COMPONENT" ? model.pagesFor(node.id).length : 0;
      const meta = [
        viaNodes.length ? `${viaNodes.map(({ label }) => label).join(" → ")} 경유` : null,
        entry.collapsible && !entry.open ? collapsedSummary(model, entry) : null,
        shared > 1 ? `사용 페이지 ${shared}` : null,
      ].filter(Boolean).join(" · ") || null;
      const route = node?.kind === "ENDPOINT" && node.httpRoute ? node.httpRoute : null;
      return {
        id: entry.key, type: "card", position: { x: entry.x, y: entry.y }, draggable: false,
        data: {
          kind, root: false, typeLabel: nodeKinds[kind] ?? kind, route, meta, editing, schema: node?.kind === "DB_TABLE",
          title: node ? node.label : kind === "SELF" ? "직접 호출" : "공통",
          flags: {
            rich: Boolean(meta || editing.length || route), open: entry.collapsible && entry.open, active: onOpenPath(entry.key),
            dim: Boolean(focus && !inFocus(entry)), working: Boolean(focus?.working.has(entry.id)),
            pressed: node ? selected === entry.id : undefined, expanded: entry.collapsible ? entry.open : undefined,
          },
          onActivate: () => activate(entry),
        },
      };
    });
    return [rootNode, ...cards];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, sourceRepo, model, workers, focus, selected, openPath]);

  const flowEdges = useMemo(() => layout.entries.map((entry) => {
    const http = entry.node?.kind === "ENDPOINT" && entry.depth > 1;
    const highlight = onOpenPath(entry.key) || Boolean(focus && inFocus(entry));
    const dim = Boolean(focus && !inFocus(entry));
    return {
      id: entry.key, source: entry.parentKey ?? ROOT_ID, target: entry.key, type: "straight",
      style: {
        stroke: highlight ? "var(--tree-focus)" : http ? "var(--tree-http)" : "var(--tree-edge)",
        strokeWidth: http ? "var(--tree-http-width)" : "var(--tree-edge-width)",
        strokeDasharray: http ? "10 8" : undefined,
        opacity: dim ? 0.2 : 1,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [layout, focus, openPath]);

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
        <button className="dependency-fit-button" type="button" key={mode} aria-pressed={fit === mode}
          onClick={() => { setFit(mode); setCameraTick((tick) => tick + 1); }}>
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
  const chosenVia = (layout.entries.find((entry) => entry.id === selected)?.via ?? []).map((id) => model.nodeById.get(id)).filter(Boolean);
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

  return (
    <DependencyTreeFrame {...frame} controls={controls} toolbar={toolbar} panel={panel}>
      <div className="dependency-flow" role="region" aria-label="저장소 트리">
        <ReactFlowProvider>
          <FlowCanvas nodes={flowNodes} edges={flowEdges} fit={fit} focusIds={focusIds} cameraTick={cameraTick} />
        </ReactFlowProvider>
        {sourceRepo.analysisCommitSha && !tree.length && <p className="dependency-empty-note">표시할 의존성 노드가 없습니다.</p>}
      </div>
    </DependencyTreeFrame>
  );
}
