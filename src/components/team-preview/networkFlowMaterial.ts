import * as THREE from 'three'

export function createNetworkFlowMaterial(color: string, phase: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uPhase: { value: phase },
      uOpacity: { value: 1 },
      uPaused: { value: 0 },
    },
    vertexShader: `
      varying float vAlong;
      void main() {
        vAlong = uv.x;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uPhase;
      uniform float uOpacity;
      uniform float uPaused;
      varying float vAlong;
      void main() {
        float head = fract(uTime * 0.19 + uPhase);
        float behind = (head - vAlong) / 0.24;
        float sweep = exp(-behind * 3.8) * step(0.0, behind) * step(behind, 1.0);
        float envelope = smoothstep(0.0, 0.08, head) * (1.0 - smoothstep(0.92, 1.0, head));
        sweep *= envelope * (1.0 - uPaused);
        vec3 ink = mix(uColor, vec3(0.82, 0.94, 1.0), sweep * 0.45);
        gl_FragColor = vec4(ink, uOpacity * (0.24 + sweep * 0.76));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
}
