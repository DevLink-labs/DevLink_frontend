import * as THREE from "three";

export function createPlushPileGeometry(source: THREE.BufferGeometry, count: number, length: number): THREE.BufferGeometry {
  const position = source.getAttribute("position");
  const sourceNormal = source.getAttribute("normal");
  const sourceUv = source.getAttribute("uv");
  const sourceIndex = source.getIndex();
  const triangleCount = Math.floor((sourceIndex?.count ?? position.count) / 3);
  const cumulativeAreas = new Float64Array(triangleCount);
  const vertexIndex = (offset: number) => sourceIndex ? sourceIndex.getX(offset) : offset;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const cross = new THREE.Vector3();
  let totalArea = 0;
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    a.fromBufferAttribute(position, vertexIndex(triangle * 3));
    b.fromBufferAttribute(position, vertexIndex(triangle * 3 + 1));
    c.fromBufferAttribute(position, vertexIndex(triangle * 3 + 2));
    totalArea += cross.subVectors(c, a).cross(edge.subVectors(b, a)).length() * 0.5;
    cumulativeAreas[triangle] = totalArea;
  }

  const geometry = new THREE.BufferGeometry();
  if (totalArea === 0 || count <= 0 || length <= 0) return geometry;
  const fiberCount = Math.floor(count);
  const positions = new Float32Array(fiberCount * 12);
  const uvs = new Float32Array(fiberCount * 8);
  const indices: number[] = [];
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  let seed = 2166136261;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let fiber = 0; fiber < fiberCount; fiber++) {
    const targetArea = random() * totalArea;
    let low = 0;
    let high = triangleCount - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (cumulativeAreas[middle] <= targetArea) low = middle + 1;
      else high = middle;
    }
    const ia = vertexIndex(low * 3);
    const ib = vertexIndex(low * 3 + 1);
    const ic = vertexIndex(low * 3 + 2);
    const root = Math.sqrt(random());
    const wa = 1 - root;
    const wb = root * random();
    const wc = 1 - wa - wb;
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    point.copy(a).multiplyScalar(wa).addScaledVector(b, wb).addScaledVector(c, wc);
    normal.subVectors(b, a).cross(edge.subVectors(c, a)).normalize();
    if (sourceNormal) {
      a.fromBufferAttribute(sourceNormal, ia);
      b.fromBufferAttribute(sourceNormal, ib);
      c.fromBufferAttribute(sourceNormal, ic);
      normal.copy(a).multiplyScalar(wa).addScaledVector(b, wb).addScaledVector(c, wc).normalize();
    }
    tangent.set(0, Math.abs(normal.z) > 0.9 ? 1 : 0, Math.abs(normal.z) > 0.9 ? 0 : 1).cross(normal).normalize();
    bitangent.crossVectors(normal, tangent);
    const fiberLength = length * (0.65 + random() * 0.55);
    const radius = length * 0.06 * (0.8 + random() * 0.4);
    const angle = random() * Math.PI * 2;
    const u = sourceUv ? sourceUv.getX(ia) * wa + sourceUv.getX(ib) * wb + sourceUv.getX(ic) * wc : 0;
    const v = sourceUv ? sourceUv.getY(ia) * wa + sourceUv.getY(ib) * wb + sourceUv.getY(ic) * wc : 0;
    for (let corner = 0; corner < 4; corner++) {
      vertex.copy(point).addScaledVector(normal, corner === 3 ? fiberLength : -length * 0.04);
      const spread = corner === 3 ? fiberLength * 0.15 : radius;
      const direction = angle + (corner === 3 ? 0 : corner / 3 * Math.PI * 2);
      vertex.addScaledVector(tangent, Math.cos(direction) * spread).addScaledVector(bitangent, Math.sin(direction) * spread);
      vertex.toArray(positions, fiber * 12 + corner * 3);
      uvs[fiber * 8 + corner * 2] = u;
      uvs[fiber * 8 + corner * 2 + 1] = v;
      if (corner < 3) indices.push(fiber * 4 + corner, fiber * 4 + (corner + 1) % 3, fiber * 4 + 3);
    }
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
