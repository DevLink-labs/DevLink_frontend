import { useEffect, useId, useState } from "react";

function readToken(style, name) {
  return Number.parseFloat(style.getPropertyValue(name));
}

function roundedPath(points, radius) {
  const turns = points.filter(([x, y], index) => {
    const previous = points[index - 1];
    return !previous || previous[0] !== x || previous[1] !== y;
  }).filter(([x, y], index, all) => {
    const previous = all[index - 1];
    const next = all[index + 1];
    return !previous || !next || (previous[0] !== x || x !== next[0]) && (previous[1] !== y || y !== next[1]);
  });
  return turns.map(([x, y], index) => {
    const previous = turns[index - 1];
    const next = turns[index + 1];
    if (!previous) return "M " + x + " " + y;
    if (!next) return "L " + x + " " + y;
    const distance = (point) => Math.abs(x - point[0]) + Math.abs(y - point[1]);
    const curve = Math.min(radius, distance(previous) / 2, distance(next) / 2);
    const around = (point) => [x + Math.sign(point[0] - x) * curve, y + Math.sign(point[1] - y) * curve].join(" ");
    return "L " + around(previous) + " Q " + x + " " + y + " " + around(next);
  }).join(" ");
}

function alignRanks(canvas, edges, gap, scale) {
  const children = new Map();
  for (const { sourceId, targetId, relationType } of edges) {
    if (relationType === "HTTP_CALL") continue;
    const targets = children.get(sourceId) ?? [];
    targets.push(targetId);
    children.set(sourceId, targets);
  }

  for (const lane of canvas.querySelectorAll("[data-repo-lane]")) {
    const centers = new Map();
    for (const rank of [...lane.querySelectorAll(".dependency-row")].reverse()) {
      const cards = [...rank.querySelectorAll("[data-node-id]")];
      const widths = cards.map((card) => card.getBoundingClientRect().width / scale);
      let remaining = widths.reduce((total, width) => total + width, 0) + Math.max(0, widths.length - 1) * gap;
      let nextLeft = 0;
      cards.forEach((card, index) => {
        const width = widths[index];
        const naturalLeft = card.offsetLeft;
        const targetCenters = (children.get(card.dataset.nodeId) ?? [])
          .map((target) => centers.get(target)).filter((center) => center !== undefined);
        const desiredCenter = targetCenters.length
          ? (Math.min(...targetCenters) + Math.max(...targetCenters)) / 2 : naturalLeft + width / 2;
        const maxLeft = rank.clientWidth - remaining;
        const left = Math.max(nextLeft, Math.min(desiredCenter - width / 2, maxLeft));
        card.style.setProperty("--tree-card-offset", (left - naturalLeft) + "px");
        centers.set(card.dataset.nodeId, left + width / 2);
        nextLeft = left + width + gap;
        remaining -= width + gap;
      });
    }
  }
}

function readNodes(canvas, box, inset, scale) {
  const x = (value) => (value - box.left) / scale;
  const y = (value) => (value - box.top) / scale;
  return new Map([...canvas.querySelectorAll("[data-node-id]")].map((card) => {
    const bounds = card.getBoundingClientRect();
    const lane = card.closest("[data-repo-lane]").getBoundingClientRect();
    const rank = card.closest(".dependency-row");
    const rankBox = rank.getBoundingClientRect();
    const previous = rank.previousElementSibling?.getBoundingClientRect();
    const next = rank.nextElementSibling?.getBoundingClientRect();
    return [card.dataset.nodeId, {
      center: x((bounds.left + bounds.right) / 2),
      left: x(bounds.left),
      right: x(bounds.right),
      top: y(bounds.top),
      bottom: y(bounds.bottom),
      middle: y((bounds.top + bounds.bottom) / 2),
      laneLeft: x(lane.left),
      laneRight: x(lane.right),
      before: previous ? y((rankBox.top + previous.bottom) / 2) : y(rankBox.top) - inset,
      after: next ? y((rankBox.bottom + next.top) / 2) : y(rankBox.bottom) + inset,
      method: card.dataset.httpMethod,
    }];
  }));
}

function drawPaths(canvas, edges) {
  const style = getComputedStyle(canvas);
  const radius = readToken(style, "--tree-edge-radius");
  const inset = readToken(style, "--tree-edge-entry-gap");
  const track = readToken(style, "--tree-http-track-gap");
  const panel = readToken(style, "--tree-panel-inline");
  const scale = readToken(style, "--tree-fit-scale") || 1;
  alignRanks(canvas, edges, readToken(style, "--tree-sibling-gap"), scale);

  const box = canvas.getBoundingClientRect();
  const nodes = readNodes(canvas, box, radius + inset, scale);
  const local = [];
  const lastEntry = new Map();
  const groups = new Map();

  for (const edge of edges) {
    const from = nodes.get(edge.sourceId);
    const to = nodes.get(edge.targetId);
    if (!from || !to) continue;
    if (edge.relationType === "HTTP_CALL") {
      const related = groups.get(edge.targetId) ?? [];
      if (!related.some(({ sourceId }) => sourceId === edge.sourceId)) related.push(edge);
      groups.set(edge.targetId, related);
      continue;
    }

    const side = edge.sourceId === edge.targetId ? from.right + radius : from.laneLeft + panel / 2;
    const points = [[from.center, from.bottom], [from.center, from.after]];
    if (from.after !== to.before) points.push([side, from.after], [side, to.before]);
    points.push([to.center, to.before], [to.center, to.top - inset]);
    lastEntry.set(edge.targetId, local.length);
    local.push({ ...edge, path: roundedPath(points, radius), arrow: false });
  }
  for (const index of lastEntry.values()) local[index].arrow = true;

  const http = [...groups].map(([targetId, group], index) => {
    const to = nodes.get(targetId);
    const sources = group.map(({ sourceId }) => nodes.get(sourceId));
    const laneRight = sources[0].laneRight;
    const gap = to.laneLeft - laneRight;
    const middle = laneRight + gap / 2;
    const available = Math.max(0, gap - radius * 2);
    const spacing = Math.min(track, available / Math.max(1, groups.size - 1));
    const bus = middle + (index - (groups.size - 1) / 2) * spacing;
    const entry = to.left - inset;
    const distances = sources.map((source) => source.after);
    const upper = Math.min(...distances);
    const lower = Math.max(...distances);
    const far = Math.abs(upper - to.middle) > Math.abs(lower - to.middle) ? upper : lower;
    const other = far === upper ? lower : upper;
    const farIndex = distances.indexOf(far);
    const otherIndex = upper < to.middle && lower > to.middle ? distances.indexOf(other) : -1;
    const throughBus = (source, end) => roundedPath([[source.center, source.bottom],
      [source.center, source.after], [bus, source.after], [bus, to.middle], [end, to.middle]], radius);
    const stem = throughBus(sources[farIndex], entry);
    const extra = otherIndex >= 0 ? throughBus(sources[otherIndex], Math.min(entry, bus + radius)) : null;
    return {
      targetId,
      branches: group.flatMap(({ sourceId }, sourceIndex) => {
        if (sourceIndex === farIndex || sourceIndex === otherIndex) return [];
        const source = sources[sourceIndex];
        const join = source.after === far || otherIndex >= 0 && source.after === other ? bus - radius : bus;
        return [{ sourceId, path: roundedPath([[source.center, source.bottom],
          [source.center, source.after], [join, source.after]], radius) }];
      }),
      stem,
      extra,
      label: "HTTP " + (to.method ?? "") + " · " + group.length + "곳",
      labelX: to.left - readToken(style, "--tree-http-label-inset"),
      labelY: to.middle - readToken(style, "--tree-http-label-offset"),
    };
  });

  return {
    local,
    http,
    tip: readToken(style, "--tree-edge-tip"),
    httpTip: readToken(style, "--tree-http-tip"),
  };
}

export default function DependencyTreeLines({ canvas, edges, focus, onSelect }) {
  const marker = useId();
  const [drawing, setDrawing] = useState(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return undefined;
    let frame;
    function redraw() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setDrawing(drawPaths(element, edges)));
    }
    const observer = new ResizeObserver(redraw);
    observer.observe(element);
    for (const node of element.querySelectorAll("[data-node-id]")) observer.observe(node);
    redraw();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [canvas, edges]);

  if (!drawing) return null;
  const httpMarker = marker + "-http";
  const selectPath = (path, id) => <path d={path} className="dependency-hit" onClick={() => onSelect(id)} />;

  return (
    <svg className="dependency-lines" aria-hidden="true">
      <defs>
        <marker id={marker} markerWidth={drawing.tip} markerHeight={drawing.tip}
          markerUnits="userSpaceOnUse" viewBox="0 0 1 1" refX="1" refY=".5" orient="auto">
          <polygon points="0,0 1,.5 0,1" className="dependency-marker" />
        </marker>
        <marker id={httpMarker} markerWidth={drawing.httpTip} markerHeight={drawing.httpTip}
          markerUnits="userSpaceOnUse" viewBox="0 0 1 1" refX="1" refY=".5" orient="auto">
          <polygon points="0,0 1,.5 0,1" className="dependency-http-marker" />
        </marker>
      </defs>
      {drawing.local.map(({ sourceId, targetId, relationType, path, arrow }) => (
        <path key={[sourceId, targetId, relationType].join(":")} d={path}
          markerEnd={arrow ? "url(#" + marker + ")" : undefined}
          className={"dependency-line" + (focus.has(sourceId) && focus.has(targetId) ? " dependency-highlight" : "")} />
      ))}
      {drawing.http.map(({ targetId, branches, stem, extra, label, labelX, labelY }) => (
        <g key={targetId}>
          {branches.map(({ sourceId, path }) => (
            <g key={sourceId}>
              <path d={path} className="dependency-line dependency-http" />
              {selectPath(path, targetId)}
            </g>
          ))}
          {extra && <>
            <path d={extra} className="dependency-line dependency-http" />
            {selectPath(extra, targetId)}
          </>}
          <path d={stem} className="dependency-line dependency-http" markerEnd={"url(#" + httpMarker + ")"} />
          {selectPath(stem, targetId)}
          <text x={labelX} y={labelY} textAnchor="end" className="dependency-http-label">{label}</text>
        </g>
      ))}
    </svg>
  );
}
