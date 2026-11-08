const visibleLimit = 80;

export function upstream(id, edges) {
  const parents = new Map();
  for (const edge of edges) {
    const ids = parents.get(edge.targetId) ?? [];
    ids.push(edge.sourceId);
    parents.set(edge.targetId, ids);
  }
  const found = new Set();
  const pending = [id];
  while (pending.length > 0) {
    const current = pending.pop();
    if (found.has(current)) continue;
    found.add(current);
    pending.push(...(parents.get(current) ?? []));
  }
  return found;
}

export function displayGraph(graph, selected) {
  const edges = graph.edges.filter((edge) => edge.relationType !== "IMPORT");
  const linked = new Set(edges.flatMap((edge) => [edge.sourceId, edge.targetId]));
  const nodes = graph.nodes.filter((node) => linked.has(node.id) || node.kind !== "MODULE");
  if (nodes.length <= visibleLimit) return { nodes, edges };

  const next = new Map();
  const link = (from, to) => {
    const values = next.get(from) ?? [];
    values.push(to);
    next.set(from, values);
  };
  for (const { sourceId, targetId } of edges) {
    link(sourceId, targetId);
    link(targetId, sourceId);
  }
  const pending = selected ? [selected] : nodes.filter(({ kind }) => kind === "PAGE").slice(0, 2).map(({ id }) => id);
  if (!pending.length) pending.push(nodes[0].id);
  const visible = new Set();
  for (let cursor = 0; cursor < pending.length && visible.size < visibleLimit; cursor += 1) {
    const id = pending[cursor];
    if (visible.has(id)) continue;
    visible.add(id);
    pending.push(...(next.get(id) ?? []));
  }
  return {
    nodes: nodes.filter(({ id }) => visible.has(id)),
    edges: edges.filter(({ sourceId, targetId }) => visible.has(sourceId) && visible.has(targetId)),
  };
}

export function repositoryRows(nodes, edges) {
  const incoming = new Map(nodes.map(({ id }) => [id, 0]));
  const next = new Map();
  for (const { sourceId, targetId } of edges) {
    if (!incoming.has(sourceId) || !incoming.has(targetId)) continue;
    incoming.set(targetId, incoming.get(targetId) + 1);
    const links = next.get(sourceId) ?? [];
    links.push(targetId);
    next.set(sourceId, links);
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const rows = [];
  const visited = new Set();
  let layer = nodes.filter(({ id }) => incoming.get(id) === 0).map(({ id }) => id);
  while (layer.length) {
    for (let offset = 0; offset < layer.length; offset += 4) {
      rows.push(layer.slice(offset, offset + 4).map((id) => byId.get(id)));
    }
    const children = [];
    for (const id of layer) {
      visited.add(id);
      for (const child of next.get(id) ?? []) {
        const remaining = incoming.get(child) - 1;
        incoming.set(child, remaining);
        if (remaining === 0) children.push(child);
      }
    }
    layer = children;
  }
  const cyclic = nodes.filter(({ id }) => !visited.has(id));
  for (let offset = 0; offset < cyclic.length; offset += 4) rows.push(cyclic.slice(offset, offset + 4));
  return rows;
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
