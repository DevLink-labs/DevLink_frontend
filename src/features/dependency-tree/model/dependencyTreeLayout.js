/**
 * 방사형 의존성 트리 모델.
 * 저장소를 중심에 두고 페이지(BE만 있으면 엔드포인트)를 사방으로 배치한 뒤, 클릭한 가지만 펼친다.
 * 서버 응답(TeamGraph)만 읽고 서버·브로커 형식은 바꾸지 않는다.
 */

/** 클릭으로 여닫는 종류. 나머지(훅·함수·BE 경로)는 부모가 열리면 함께 펼쳐진다. */
export const COLLAPSIBLE = new Set(["PAGE", "COMPONENT", "ENDPOINT", "HTTP_CLIENT"]);
const KIND_ORDER = { PAGE: 0, COMPONENT: 1, HOOK: 2, MODULE: 3, HTTP_CLIENT: 4, ENDPOINT: 5, SERVICE: 6, REPOSITORY: 7, DB_TABLE: 8 };
const BE_GROUPS = ["SERVICE", "REPOSITORY", "DB_TABLE"];
export const COMMON_ID = "common";

const TAU = Math.PI * 2;

function push(map, key, value) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function byLabel(a, b) {
  return a.label.localeCompare(b.label);
}

/** 파일 단위 모듈 노드(라벨이 경로)는 IMPORT 간선만 가지므로 트리에서 제외한다. */
export function isFileModule(node) {
  return node.kind === "MODULE" && node.label.includes("/");
}

/**
 * 그래프를 탐색용 인접 구조로 바꾼다.
 * next: 흐름 간선(RENDERS·CALLS·USES_TABLE)과 HTTP_CALL의 하류. prev: 흐름 간선의 상류. callSources: 엔드포인트 ← 호출 지점.
 */
export function buildModel(graph) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const next = new Map();
  const prev = new Map();
  const callTarget = new Map();
  const callSources = new Map();
  const byFile = new Map();
  for (const node of graph.nodes) {
    if (!isFileModule(node)) push(byFile, fileKey(node.repoId, node.source.relativePath), node.id);
  }
  for (const edge of graph.edges) {
    if (edge.relationType === "IMPORT") continue;
    if (edge.relationType === "HTTP_CALL") {
      callTarget.set(edge.sourceId, edge.targetId);
      push(callSources, edge.targetId, edge.sourceId);
    } else {
      push(prev, edge.targetId, edge.sourceId);
    }
    push(next, edge.sourceId, edge.targetId);
  }
  for (const list of next.values()) {
    list.sort((a, b) => (KIND_ORDER[nodeById.get(a).kind] ?? 9) - (KIND_ORDER[nodeById.get(b).kind] ?? 9)
      || byLabel(nodeById.get(a), nodeById.get(b)));
  }
  const reachMemo = new Map();
  /** 하류 전체(HTTP 호출 건너뜀 포함). 자기 자신은 제외한다. */
  function reach(id) {
    if (reachMemo.has(id)) return reachMemo.get(id);
    const found = new Set();
    const pending = [...(next.get(id) ?? [])];
    while (pending.length) {
      const current = pending.pop();
      if (found.has(current)) continue;
      found.add(current);
      pending.push(...(next.get(current) ?? []));
    }
    reachMemo.set(id, found);
    return found;
  }
  /** 상류 전체(호출 지점 ← 엔드포인트 포함). 자기 자신은 제외한다. */
  function ancestors(id) {
    const found = new Set();
    const pending = [...(prev.get(id) ?? []), ...(callSources.get(id) ?? [])];
    while (pending.length) {
      const current = pending.pop();
      if (found.has(current)) continue;
      found.add(current);
      pending.push(...(prev.get(current) ?? []), ...(callSources.get(current) ?? []));
    }
    return found;
  }
  const pagesMemo = new Map();
  function pagesFor(id) {
    if (!pagesMemo.has(id)) {
      pagesMemo.set(id, [...ancestors(id)].filter((key) => nodeById.get(key)?.kind === "PAGE").sort());
    }
    return pagesMemo.get(id);
  }
  return { nodeById, next, prev, callTarget, callSources, byFile, reach, ancestors, pagesFor };
}

/** 트리에서 접어 두는 중간 종류. 훅과 일반 함수는 카드로 그리지 않고, 거쳐 간 이름만 API 카드 부제로 남긴다. */
const FOLDED = new Set(["HOOK", "MODULE"]);

/**
 * 훅·일반 함수를 건너뛰고 컴포넌트와 API 호출만 자식으로 돌려준다.
 * via에는 건너뛴 노드 ID를 순서대로 담는다. 같은 자식에 여러 경로가 있으면 먼저 찾은 경로를 쓴다.
 */
export function foldedChildren(model, id, ancestors) {
  const result = [];
  const seen = new Set();
  function walk(current, via) {
    for (const child of model.next.get(current) ?? []) {
      if (child === id || ancestors.has(child) || via.includes(child)) continue;
      const node = model.nodeById.get(child);
      if (!node) continue;
      if (FOLDED.has(node.kind)) {
        walk(child, [...via, child]);
        continue;
      }
      if (seen.has(child)) continue;
      seen.add(child);
      result.push({ id: child, via });
    }
  }
  walk(id, []);
  return result;
}

/**
 * 중심 저장소의 1단 가지. FE는 페이지, BE는 엔드포인트.
 * 어느 페이지에서도 닿지 않는 API 호출(라우터·Provider 등)은 "공통" 가지 하나에 모은다.
 */
export function rootBranches(model, repo) {
  const nodes = [...model.nodeById.values()].filter((node) => node.repoId === repo.repoId && !isFileModule(node));
  const rootKind = repo.repoKind === "FRONTEND" ? "PAGE" : "ENDPOINT";
  const branches = nodes.filter((node) => node.kind === rootKind).sort(byLabel)
    .map((node) => ({ key: "b:" + node.id, id: node.id, node, childIds: null }));
  if (rootKind !== "PAGE") return branches;
  const covered = new Set(branches.flatMap(({ id }) => [id, ...model.reach(id)]));
  const common = nodes.filter((node) => !covered.has(node.id) && node.kind !== "PAGE"
    && !(model.prev.get(node.id)?.length)
    && (node.kind === "HTTP_CLIENT" || [...model.reach(node.id)].some((key) => model.nodeById.get(key)?.kind === "HTTP_CLIENT")));
  if (common.length) {
    // 진입점이 훅·함수면 그 아래 컴포넌트·API 호출까지 접어서 공통 가지의 자식으로 삼는다.
    const links = [];
    const seen = new Set();
    for (const root of common.sort(byLabel)) {
      const folded = FOLDED.has(root.kind)
        ? foldedChildren(model, root.id, new Set()).map(({ id, via }) => ({ id, via: [root.id, ...via] }))
        : [{ id: root.id, via: [] }];
      for (const link of folded) {
        if (seen.has(link.id)) continue;
        seen.add(link.id);
        links.push(link);
      }
    }
    branches.push({ key: "b:" + COMMON_ID, id: COMMON_ID, node: null, childLinks: links, childIds: links.map(({ id }) => id) });
  }
  return branches;
}

/** 엔드포인트 아래의 BE 경로를 종류별 묶음 카드(서비스 → 레포지토리 → DB 테이블)로 만든다. */
function backendChain(model, endpointId, key, depth) {
  const downstream = [...model.reach(endpointId)].map((id) => model.nodeById.get(id)).filter(Boolean);
  let children = [];
  for (const kind of [...BE_GROUPS].reverse()) {
    const items = downstream.filter((node) => node.kind === kind).sort(byLabel);
    if (!items.length) continue;
    const groupKey = key + "/" + kind;
    children = [{ key: groupKey, id: groupKey, group: kind, items, depth: 0, collapsible: false, open: true, childIds: [], children }];
  }
  let level = depth;
  for (let entry = children[0]; entry; entry = entry.children[0]) entry.depth = level++;
  return children;
}

/**
 * 지금 보이는 트리. openPath(열린 가지의 키)와 autoOpen(팀원 모드에서 자동으로 여는 조건)에 따라 가지를 펼친다.
 * 공유 컴포넌트는 가지마다 복제되므로 키는 부모 키에 노드 ID를 이어 붙인 경로다.
 */
export function visibleTree(model, branches, openPath, autoOpen) {
  const onPath = (key) => Boolean(openPath && (openPath === key || openPath.startsWith(key + "/")));
  const isOpen = (key, id) => onPath(key) || Boolean(autoOpen && autoOpen(id));
  function build(id, key, depth, ancestors, via = []) {
    const node = model.nodeById.get(id);
    const collapsible = COLLAPSIBLE.has(node.kind) && (node.kind !== "ENDPOINT" || depth === 1);
    const open = !collapsible || isOpen(key, id);
    const childLinks = node.kind === "ENDPOINT" ? [] : foldedChildren(model, id, ancestors);
    const entry = { key, id, node, depth, collapsible, open, via, childIds: childLinks.map((link) => link.id), children: [] };
    if (!open) return entry;
    if (node.kind === "ENDPOINT") entry.children = backendChain(model, id, key, depth + 1);
    else {
      const seen = new Set(ancestors).add(id);
      for (const skipped of childLinks.flatMap((link) => link.via)) seen.add(skipped);
      entry.children = childLinks.map((link) => build(link.id, key + "/" + link.id, depth + 1, seen, link.via));
    }
    return entry;
  }
  return branches.map((branch) => {
    if (branch.node) return build(branch.id, branch.key, 1, new Set());
    const open = isOpen(branch.key, branch.id);
    return {
      key: branch.key, id: branch.id, node: null, depth: 1, collapsible: true, open, via: [], childIds: branch.childIds,
      children: open ? branch.childLinks.map((link) => build(link.id, branch.key + "/" + link.id, 2, new Set(), link.via)) : [],
    };
  });
}

/** 접힌 카드에 보여줄 요약. 직접 자식을 종류별로 센다. */
export function collapsedSummary(model, entry) {
  if (entry.id === COMMON_ID) return `진입점 ${entry.childIds.length}`;
  if (entry.node?.kind === "HTTP_CLIENT") return model.callTarget.has(entry.id) ? "BE 경로 보기" : "연결된 엔드포인트 없음";
  if (entry.node?.kind === "ENDPOINT") return "BE 경로 보기";
  const counts = new Map();
  for (const id of entry.childIds) {
    const kind = model.nodeById.get(id)?.kind;
    const label = { COMPONENT: "컴포넌트", HOOK: "훅", HTTP_CLIENT: "API", MODULE: "함수" }[kind] ?? kind;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => `${label} ${count}`).join(" · ");
}

/** 노드 하나를 트리에서 찾을 때 쓸 키. 상류를 거슬러 가장 가까운 페이지(또는 공통 진입점)까지의 경로를 만든다. */
export function keyFor(model, branches, id) {
  const rootKeys = new Map(branches.filter(({ node }) => node).map(({ id: rootId, key }) => [rootId, key]));
  const commonBranch = branches.find((branch) => branch.id === COMMON_ID);
  const commonChildren = new Set((commonBranch?.childLinks ?? []).flatMap(({ id: child, via: skipped }) => [child, ...skipped]));
  const via = new Map([[id, null]]);
  const queue = [id];
  while (queue.length) {
    const current = queue.shift();
    const isRoot = rootKeys.has(current);
    if (isRoot || commonChildren.has(current)) {
      const chain = [];
      for (let cursor = current; cursor; cursor = via.get(cursor)) chain.push(cursor);
      let key = isRoot ? rootKeys.get(current) : "b:" + COMMON_ID;
      // 훅·함수는 카드가 없으므로 키에서도 건너뛴다.
      for (const step of chain.slice(isRoot ? 1 : 0)) {
        if (!FOLDED.has(model.nodeById.get(step)?.kind)) key += "/" + step;
      }
      return key;
    }
    for (const parent of [...(model.prev.get(current) ?? []), ...(model.callSources.get(current) ?? [])]) {
      if (!via.has(parent)) {
        via.set(parent, current);
        queue.push(parent);
      }
    }
  }
  return null;
}

/**
 * 방사형 배치. 1단 가지는 원둘레를 나눠 갖고(열린 가지는 잎 수만큼 넓게), 아래 단은 부모 호 안에서 다시 나눈다.
 * 같은 단에서 이웃이 너무 가까우면 그 단의 반지름을 키운다. 좌표는 중심(0,0) 기준이다.
 */
export function layoutRadial(tree, metrics) {
  const leaves = (entry) => entry.children.length ? entry.children.reduce((sum, child) => sum + leaves(child), 0) : 1;
  const weights = tree.map(leaves);
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const minShare = Math.min(TAU / Math.max(1, tree.length), metrics.minArc / metrics.ring);
  const shares = weights.map((weight) => Math.max(minShare, (weight / total) * TAU));
  const scale = TAU / shares.reduce((sum, share) => sum + share, 0);
  const byDepth = new Map();
  const placed = [];
  // 입력 트리는 건드리지 않고 배치된 복사본을 만든다(React Compiler가 입력을 불변으로 보기 때문).
  function assign(entry, start, end, depth, parentKey) {
    const angle = (start + end) / 2;
    const { children, ...rest } = entry;
    const item = { ...rest, depth, angle, parentKey };
    push(byDepth, depth, item);
    placed.push(item);
    const childWeights = children.map(leaves);
    const childTotal = childWeights.reduce((sum, weight) => sum + weight, 0) || 1;
    // 자식은 부모 방향을 중심으로 잎 수에 비례한 좁은 호만 쓴다. 부채꼴 전체로 퍼지면 선이 중심을 가로지른다.
    const childRadius = metrics.ring + depth * metrics.step;
    const span = Math.min(end - start, (childTotal * metrics.minArc * metrics.spread) / childRadius);
    let cursor = angle - span / 2;
    children.forEach((child, index) => {
      const slice = span * childWeights[index] / childTotal;
      assign(child, cursor, cursor + slice, depth + 1, entry.key);
      cursor += slice;
    });
  }
  let cursor = -Math.PI / 2;
  tree.forEach((branch, index) => {
    const span = shares[index] * scale;
    assign(branch, cursor, cursor + span, 1, null);
    cursor += span;
  });
  const radii = [];
  const maxDepth = Math.max(0, ...byDepth.keys());
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const angles = (byDepth.get(depth) ?? []).map(({ angle }) => angle).sort((a, b) => a - b);
    let gap = TAU;
    for (let index = 1; index < angles.length; index += 1) gap = Math.min(gap, angles[index] - angles[index - 1]);
    if (angles.length > 1) gap = Math.min(gap, angles[0] + TAU - angles[angles.length - 1]);
    const base = depth === 1 ? metrics.ring : radii[depth - 2] + metrics.step;
    radii.push(Math.max(base, angles.length > 1 ? metrics.minArc / gap : 0));
  }
  const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const entries = placed.map((item) => {
    const radius = radii[item.depth - 1];
    const x = radius * Math.cos(item.angle);
    const y = radius * Math.sin(item.angle);
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    return { ...item, x, y };
  });
  return { entries, bounds };
}

/**
 * 팀원 한 명의 작업 파일과 영향 범위.
 * working: 작업 중 파일에 해당하는 노드. impact: 그 노드들의 상류와 하류(HTTP 호출을 건너 FE↔BE 모두).
 * outside: 기준 커밋에 노드가 없는 작업 파일(집계 제외).
 */
export function memberFocus(model, workers, userId, repoIds) {
  const working = new Set();
  const outside = [];
  for (const [key, people] of workers) {
    const person = people.get(userId);
    if (!person || !repoIds.has(person.repoId)) continue;
    const ids = model.byFile.get(key);
    if (ids?.length) ids.forEach((id) => working.add(id));
    else outside.push(person);
  }
  const impact = new Set();
  for (const id of working) {
    for (const key of model.reach(id)) impact.add(key);
    for (const key of model.ancestors(id)) impact.add(key);
  }
  for (const id of working) impact.delete(id);
  const count = (kind) => [...working, ...impact].filter((id) => model.nodeById.get(id)?.kind === kind).length;
  const summary = { pages: count("PAGE"), apis: count("HTTP_CLIENT"), endpoints: count("ENDPOINT"), tables: count("DB_TABLE") };
  const touches = (id) => working.has(id) || [...model.reach(id)].some((key) => working.has(key));
  return { userId, working, impact, outside, summary, touches };
}

/** 활동 목록에서 팀원 목록을 만든다. 표시 중인 저장소의 유효한 관측만 센다. */
export function memberList(workers, repoIds) {
  const members = new Map();
  for (const people of workers.values()) {
    for (const person of people.values()) {
      if (!repoIds.has(person.repoId)) continue;
      const member = members.get(person.userId) ?? { userId: person.userId, displayName: person.displayName, files: 0 };
      member.files += 1;
      members.set(person.userId, member);
    }
  }
  return [...members.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function currentWorkers(activity, now) {
  const byFile = new Map();
  const serverNow = activity?.receivedAt
    ? Date.parse(activity.serverTime) + Math.max(0, now - activity.receivedAt)
    : Date.parse(activity?.serverTime ?? "");
  for (const item of activity?.items ?? []) {
    if (Date.parse(item.expiresAt) <= serverNow) continue;
    const key = fileKey(item.repoId, item.relativePath);
    const people = byFile.get(key) ?? new Map();
    people.set(item.userId, item);
    byFile.set(key, people);
  }
  return byFile;
}

export function fileKey(repoId, relativePath) {
  return `${repoId}:${relativePath}`;
}
