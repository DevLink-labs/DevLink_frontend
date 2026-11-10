import * as THREE from "three";

const vertexShader = `
  uniform vec3 uStart;
  uniform vec3 uControlA;
  uniform vec3 uControlB;
  uniform vec3 uEnd;
  uniform float uRadius;
  varying float vAlong;
  varying float vFacing;

  void main() {
    float t = uv.x;
    float s = 1.0 - t;
    vec3 point = s*s*s*uStart + 3.0*s*s*t*uControlA
      + 3.0*s*t*t*uControlB + t*t*t*uEnd;
    vec3 tangent = normalize(3.0*s*s*(uControlA-uStart)
      + 6.0*s*t*(uControlB-uControlA) + 3.0*t*t*(uEnd-uControlB));
    vec3 axis = abs(tangent.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 side = normalize(cross(tangent, axis));
    vec3 radial = side*cos(uv.y*6.283185) + cross(tangent, side)*sin(uv.y*6.283185);
    vec4 viewPoint = modelViewMatrix * vec4(point + radial*uRadius, 1.0);
    vAlong = t;
    vFacing = abs(dot(normalize(normalMatrix*radial), normalize(-viewPoint.xyz)));
    gl_Position = projectionMatrix * viewPoint;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uPhase;
  uniform float uOpacity;
  uniform float uGlow;
  varying float vAlong;
  varying float vFacing;

  void main() {
    float forward = fract(uTime*0.28 + uPhase - vAlong + 1.0);
    float backward = fract(uTime*0.28 + uPhase + vAlong + 0.5);
    float flow = max(exp(-forward*32.0), exp(-backward*32.0)*0.8);
    float tips = smoothstep(0.0, 0.035, vAlong) * smoothstep(0.0, 0.035, 1.0-vAlong);
    vec3 color = mix(vec3(0.16, 0.43, 0.69), vec3(0.66, 0.95, 1.0), flow);
    float alpha = mix(0.44 + flow*0.5, 0.06 + flow*0.14, uGlow);
    alpha *= mix(0.45, 1.0, vFacing) * tips * uOpacity;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export function createAgentSessionLinks() {
  const group = new THREE.Group();
  group.name = "ActiveAgentSessions";
  const geometry = new THREE.TubeGeometry(
    new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(1, 0, 0)),
    64, 1, 8, false,
  );
  const packetGeometry = new THREE.OctahedronGeometry(0.045);
  const ringGeometry = new THREE.TorusGeometry(0.09, 0.008, 6, 24);
  const links = new Map();
  const up = new THREE.Vector3(0, 0, 1);
  const direction = new THREE.Vector3();
  const sideways = new THREE.Vector3();
  const midpoint = new THREE.Vector3();
  let previousConnections;

  function removeLink(link) {
    group.remove(link.group);
    link.materials.forEach((material) => material.dispose());
  }

  function createLink(connection) {
    const root = new THREE.Group();
    root.name = `AgentSession:${connection.id}`;
    const curve = new THREE.CubicBezierCurve3();
    const phase = [...connection.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) % 997, 0) / 997;
    const uniforms = {
      uStart: { value: curve.v0 },
      uControlA: { value: curve.v1 },
      uControlB: { value: curve.v2 },
      uEnd: { value: curve.v3 },
      uTime: { value: 0 },
      uPhase: { value: phase },
      uOpacity: { value: 1 },
    };
    const materials = [0, 1].map((glow) => new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { ...uniforms, uGlow: { value: glow }, uRadius: { value: glow ? 0.052 : 0.014 } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }));
    materials.forEach((material) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      root.add(mesh);
    });
    const packetMaterial = new THREE.MeshBasicMaterial({ color: "#4c9bc9", transparent: true, depthWrite: false, toneMapped: false });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: "#6ca8cf", transparent: true, depthWrite: false, toneMapped: false });
    const packets = [0, 1].map(() => new THREE.Mesh(packetGeometry, packetMaterial));
    const rings = [0, 1].map(() => new THREE.Mesh(ringGeometry, ringMaterial));
    root.add(...packets, ...rings);
    group.add(root);
    return {
      group: root,
      curve,
      uniforms,
      phase,
      sourceId: connection.requesterAgentId,
      bendSide: 0,
      packets,
      rings,
      packetMaterial,
      ringMaterial,
      materials: [...materials, packetMaterial, ringMaterial],
    };
  }

  function update(connections, anchors, time, reveal, focusedMemberId) {
    if (previousConnections !== connections) {
      const ids = new Set(connections.map((connection) => connection.id));
      for (const [id, link] of links) {
        if (ids.has(id)) continue;
        removeLink(link);
        links.delete(id);
      }
      for (const connection of connections) {
        if (!links.has(connection.id)) links.set(connection.id, createLink(connection));
      }
      previousConnections = connections;
    }
    group.visible = reveal > 0.01 && connections.length > 0;
    if (!group.visible) return;

    const density = Math.max(0.48, 1 / Math.sqrt(Math.max(1, connections.length / 5)));
    for (const connection of connections) {
      const link = links.get(connection.id);
      const from = anchors.get(link.sourceId);
      const to = anchors.get(link.sourceId === connection.requesterAgentId
        ? connection.receiverAgentId : connection.requesterAgentId);
      link.group.visible = Boolean(from && to);
      if (!from || !to) continue;

      const { curve } = link;
      from.object.getWorldPosition(curve.v0);
      to.object.getWorldPosition(curve.v3);
      group.worldToLocal(curve.v0);
      group.worldToLocal(curve.v3);
      direction.subVectors(curve.v3, curve.v0);
      const length = direction.length();
      if (length < 0.1) {
        link.group.visible = false;
        continue;
      }

      midpoint.addVectors(curve.v0, curve.v3).multiplyScalar(0.5);
      sideways.set(-direction.z, 0, direction.x).normalize();
      if (link.bendSide === 0) {
        const alignment = sideways.dot(midpoint);
        link.bendSide = alignment < 0 || (Math.abs(alignment) < 0.01 && link.phase < 0.5) ? -1 : 1;
      }
      sideways.multiplyScalar(link.bendSide);
      const horizontalLengthSq = direction.x * direction.x + direction.z * direction.z;
      const closest = horizontalLengthSq > 0.001
        ? THREE.MathUtils.clamp(-(curve.v0.x * direction.x + curve.v0.z * direction.z) / horizontalLengthSq, 0, 1)
        : 0;
      const clearance = Math.hypot(curve.v0.x + direction.x * closest, curve.v0.z + direction.z * closest);
      const detour = Math.max(0.18, (1.55 - clearance) / 0.75);
      const lift = Math.min(0.7, 0.22 + length * 0.07) + link.phase * 0.12;
      curve.v1.copy(curve.v0).addScaledVector(direction, 1 / 3).addScaledVector(sideways, detour);
      curve.v2.copy(curve.v0).addScaledVector(direction, 2 / 3).addScaledVector(sideways, detour);
      curve.v1.y += lift;
      curve.v2.y += lift;
      direction.subVectors(curve.v1, curve.v0).normalize();
      curve.v0.addScaledVector(direction, 0.2);
      direction.subVectors(curve.v2, curve.v3).normalize();
      curve.v3.addScaledVector(direction, 0.2);

      const related = !focusedMemberId || from.memberId === focusedMemberId || to.memberId === focusedMemberId;
      const opacity = reveal * density * (related ? 1 : 0.12);
      link.uniforms.uTime.value = time;
      link.uniforms.uOpacity.value = opacity;
      link.packetMaterial.opacity = opacity * 0.95;
      link.ringMaterial.opacity = opacity * 0.6;
      const intensity = Math.min(1.3, 1 + (connection.sessionCount - 1) * 0.08);
      link.packets.forEach((packet, index) => {
        const progress = index === 0
          ? (time * 0.28 + link.phase) % 1
          : 1 - (time * 0.28 + link.phase + 0.5) % 1;
        curve.getPoint(progress, packet.position);
        curve.getTangent(progress, direction);
        packet.quaternion.setFromUnitVectors(up, direction);
        const envelope = THREE.MathUtils.smoothstep(progress, 0, 0.08) * (1 - THREE.MathUtils.smoothstep(progress, 0.92, 1));
        packet.scale.set(0.7, 0.7, 1.8).multiplyScalar(envelope * intensity);
      });
      link.rings.forEach((ring, index) => {
        const progress = index === 0 ? 0 : 1;
        curve.getPoint(progress, ring.position);
        curve.getTangent(progress, direction);
        ring.quaternion.setFromUnitVectors(up, direction);
        ring.scale.setScalar(1 + Math.sin(time * 2.4 + link.phase * 6.28 + index) * 0.1);
      });
    }
  }

  function dispose() {
    links.forEach(removeLink);
    links.clear();
    geometry.dispose();
    packetGeometry.dispose();
    ringGeometry.dispose();
  }

  return { group, update, dispose };
}
