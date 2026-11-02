import * as THREE from 'three'

function createPebbleGeometry() {
  const geometry = new THREE.SphereGeometry(1, 64, 40)
  const positions = geometry.getAttribute('position')
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index)
    const y = positions.getY(index)
    const z = positions.getZ(index)
    const shoulder = 1 + 0.1 * y - 0.035 * z
    positions.setXYZ(
      index,
      x * 0.56 * shoulder + 0.06 * (1 - y * y),
      y * 0.365 + 0.185 + x * 0.035,
      z * 0.495 * (1 - 0.045 * x),
    )
  }
  geometry.computeVertexNormals()
  return geometry
}

function createLiquidGeometry() {
  const profile: THREE.Vector2[] = []
  for (let index = 0; index <= 24; index++) {
    const angle = -Math.PI / 2 + index / 24 * Math.PI / 2
    profile.push(new THREE.Vector2(Math.cos(angle) * 0.32, Math.sin(angle) * 0.13 - 0.025))
  }
  profile.push(new THREE.Vector2(0.318, -0.014), new THREE.Vector2(0.307, -0.005), new THREE.Vector2(0, -0.005))
  return new THREE.LatheGeometry(profile, 64)
}

export function createNetworkAgentAsset(online: boolean, variant = 0): { group: THREE.Group; materials: THREE.Material[] } {
  const group = new THREE.Group()
  group.rotation.y = -0.22 + (variant % 4) * 0.14

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: online ? '#f1f7fb' : '#e0e5eb',
    metalness: 0,
    roughness: online ? 0.07 : 0.46,
    transmission: online ? 0.91 : 0.36,
    thickness: online ? 0.43 : 0.65,
    ior: online ? 1.47 : 1.38,
    attenuationColor: new THREE.Color(online ? '#c6d9e5' : '#ccd3dc'),
    attenuationDistance: online ? 4 : 0.8,
    clearcoat: online ? 0.2 : 0.28,
    clearcoatRoughness: online ? 0.1 : 0.4,
    envMapIntensity: online ? 0.85 : 0.7,
    specularIntensity: online ? 0.8 : 0.55,
  })
  const shell = new THREE.Mesh(createPebbleGeometry(), shellMaterial)
  shell.castShadow = false
  shell.receiveShadow = false
  shell.renderOrder = 2
  group.add(shell)

  if (online) {
    const rimMaterial = new THREE.MeshBasicMaterial({ color: '#688897', transparent: true, opacity: 1, depthWrite: false, toneMapped: false })
    rimMaterial.userData.keepTransparent = true
    rimMaterial.userData.noDepthWrite = true
    rimMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNetworkGlassNormal;\nvarying vec3 vNetworkGlassView;')
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', 'vNetworkGlassNormal = normalize(normalMatrix * normal);\nvNetworkGlassView = -(modelViewMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>')
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNetworkGlassNormal;\nvarying vec3 vNetworkGlassView;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\nfloat glassFacing = clamp(abs(dot(normalize(vNetworkGlassNormal), normalize(vNetworkGlassView))), 0.0, 1.0);\ngl_FragColor.a = opacity * pow(1.0 - glassFacing, 2.7) * 0.36;')
    }
    rimMaterial.customProgramCacheKey = () => 'network-glass-fresnel-rim-v1'
    const rim = new THREE.Mesh(shell.geometry, rimMaterial)
    rim.renderOrder = 3
    group.add(rim)

    const liquidMaterial = new THREE.MeshPhysicalMaterial({
      color: '#84aabe',
      metalness: 0,
      roughness: 0.3,
      clearcoat: 0.18,
      clearcoatRoughness: 0.15,
      ior: 1.33,
      specularIntensity: 0.5,
      envMapIntensity: 0.35,
    })
    const liquid = new THREE.Mesh(createLiquidGeometry(), liquidMaterial)
    liquid.position.set(0.025, 0, 0.005)
    liquid.rotation.z = -0.025
    liquid.castShadow = false
    liquid.receiveShadow = false
    liquid.renderOrder = 0
    group.add(liquid)
  }

  const contactMaterial = new THREE.MeshPhysicalMaterial({
    color: online ? '#9ebdcc' : '#d0d5dc',
    metalness: 0,
    roughness: online ? 0.18 : 0.6,
    transmission: online ? 0.5 : 0.15,
    thickness: 0.04,
    ior: 1.4,
    clearcoat: online ? 0.12 : 0,
    envMapIntensity: 0.45,
  })
  const contact = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.011, 8, 72), contactMaterial)
  contact.rotation.x = Math.PI / 2
  contact.scale.y = 0.84
  contact.position.set(0.025, -0.14, 0)
  group.add(contact)

  if (!online) {
    const points = new THREE.EllipseCurve(0, 0, 0.56, 0.49, 0, Math.PI * 2).getPoints(96).map((point) => new THREE.Vector3(point.x, -0.19, point.y))
    const indicator = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: '#9ba5b1', dashSize: 0.095, gapSize: 0.075 }))
    indicator.computeLineDistances()
    group.add(indicator)
  }

  const materials = new Set<THREE.Material>()
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    }
  })
  return { group, materials: [...materials] }
}
