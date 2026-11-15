import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createAgentSessionLinks } from "./agentSessionLinks.js";

function anchors() {
  const from = new THREE.Object3D();
  const to = new THREE.Object3D();
  from.position.set(3, 0.2, 0);
  to.position.set(0, 0.2, 3);
  return new Map([
    ["1", { object: from, memberId: "requester" }],
    ["2", { object: to, memberId: "receiver" }],
  ]);
}

function connection(status = "PENDING", reverse = false) {
  const requesterAgentId = reverse ? "2" : "1";
  const receiverAgentId = reverse ? "1" : "2";
  return {
    id: status === "PENDING" ? `pending:${requesterAgentId}:${receiverAgentId}` : "1:2",
    requesterAgentId,
    receiverAgentId,
    sessionCount: 1,
    status,
  };
}

function packets(link, type) {
  return link.children.filter((child) => child.geometry.type === type);
}

function curve(link) {
  const { uStart, uControlA, uControlB, uEnd } = link.children[0].material.uniforms;
  return new THREE.CubicBezierCurve3(uStart.value, uControlA.value, uControlB.value, uEnd.value);
}

test("대기 요청은 각 방향마다 주황색 화살표 하나가 요청자에서 수신자로 이동", () => {
  const links = createAgentSessionLinks();
  try {
    const points = anchors();
    const connections = [connection(), connection("PENDING", true)];
    links.update(connections, points, 0.3, 1, null);
    const arrows = links.group.children.map((link) => {
      const meshes = packets(link, "ConeGeometry");
      assert.equal(meshes.length, 1);
      return meshes[0];
    });
    const before = arrows.map((arrow) => arrow.position.clone());
    links.update(connections, points, 0.301, 1, null);

    links.group.children.forEach((link, linkIndex) => {
      const request = connections[linkIndex];
      const path = curve(link);
      const requester = points.get(request.requesterAgentId).object.position;
      const receiver = points.get(request.receiverAgentId).object.position;
      assert.ok(path.v0.distanceTo(requester) < path.v0.distanceTo(receiver));
      assert.ok(path.v3.distanceTo(receiver) < path.v3.distanceTo(requester));
      const arrow = arrows[linkIndex];
      const movement = arrow.position.clone().sub(before[linkIndex]);
      const nose = new THREE.Vector3(0, 0, 1).applyQuaternion(arrow.quaternion);
      assert.ok(movement.dot(nose) > 0);
      const { r, g, b } = arrow.material.color;
      assert.ok(r > g && g > b);
      const positions = arrow.geometry.attributes.position;
      const tip = new THREE.Vector3();
      for (let vertex = 0; vertex < positions.count; vertex++) {
        if (positions.getZ(vertex) > tip.z) tip.fromBufferAttribute(positions, vertex);
      }
      assert.ok(tip.normalize().dot(new THREE.Vector3(0, 0, 1)) > 0.99);
    });
  } finally {
    links.dispose();
  }
});

test("진행 중 연결은 선과 끝점만 표시하고 흐르는 빛에 현재 시각을 반영", () => {
  const links = createAgentSessionLinks();
  try {
    const connections = [connection("IN_PROGRESS")];
    const points = anchors();
    links.update(connections, points, 0.3, 1, null);
    const link = links.group.children[0];
    const lineMeshes = link.children.filter(({ geometry }) => geometry.type === "TubeGeometry");
    assert.ok(lineMeshes.length > 0);
    assert.ok(link.children.every(({ geometry }) => ["TubeGeometry", "TorusGeometry"].includes(geometry.type)));
    for (const { material } of lineMeshes) {
      assert.equal(material.uniforms.uTime.value, 0.3);
      assert.equal(material.uniforms.uPending.value, 0);
    }
    links.update(connections, points, 0.8, 1, null);
    for (const { material } of lineMeshes) {
      assert.equal(material.uniforms.uTime.value, 0.8);
    }
  } finally {
    links.dispose();
  }
});

test("같은 Agent 쌍의 진행 중 연결과 양쪽 대기 요청은 높이를 나눠 표시", () => {
  const links = createAgentSessionLinks();
  try {
    links.update([connection("IN_PROGRESS"), connection(), connection("PENDING", true)], anchors(), 1, 1, null);
    const heights = links.group.children.map((link) => curve(link).getPoint(0.5).y);
    assert.ok(heights[1] - heights[0] > 0.08);
    assert.ok(heights[2] - heights[1] > 0.08);
  } finally {
    links.dispose();
  }
});

test("요청 수락·종료 시 이전 연결과 재질을 정리하고 공유 지오메트리는 마지막에 해제", () => {
  const links = createAgentSessionLinks();
  const points = anchors();
  links.update([connection()], points, 1, 1, null);
  const pending = links.group.children[0];
  const arrowGeometry = packets(pending, "ConeGeometry")[0].geometry;
  const materials = new Set(pending.children.map((child) => child.material));
  let disposedMaterials = 0;
  let disposedArrows = 0;
  for (const material of materials) material.addEventListener("dispose", () => disposedMaterials++);
  arrowGeometry.addEventListener("dispose", () => disposedArrows++);

  links.update([connection("IN_PROGRESS")], points, 1, 1, null);
  assert.equal(pending.parent, null);
  assert.equal(disposedMaterials, materials.size);
  assert.equal(disposedArrows, 0);
  assert.equal(links.group.children.length, 1);
  assert.equal(packets(links.group.children[0], "ConeGeometry").length, 0);

  links.update([], points, 1, 1, null);
  assert.equal(links.group.children.length, 0);
  assert.equal(links.group.visible, false);
  links.dispose();
  assert.equal(disposedArrows, 1);
});

test("일시정지된 시각과 숨김·누락된 Agent에도 연결 표시 상태 유지", () => {
  const links = createAgentSessionLinks();
  try {
    const connections = [connection()];
    const points = anchors();
    links.update(connections, points, 1, 1, null);
    const link = links.group.children[0];
    const before = packets(link, "ConeGeometry").map((packet) => packet.position.clone());
    links.update(connections, points, 1, 1, null);
    assert.deepEqual(packets(link, "ConeGeometry").map((packet) => packet.position), before);
    links.update(connections, points, 1, 0, null);
    assert.equal(links.group.visible, false);
    links.update(connections, new Map(), 1, 1, null);
    assert.equal(link.visible, false);
    links.update(connections, points, 1, 1, "unrelated-member");
    assert.equal(link.visible, true);
    assert.ok(packets(link, "ConeGeometry")[0].material.opacity < 0.2);
  } finally {
    links.dispose();
  }
});
