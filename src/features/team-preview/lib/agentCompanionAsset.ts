import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export function createAgentCompanion(online: boolean, _accent: THREE.Color, variant: number) {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)

  const surface = new THREE.MeshPhysicalMaterial({
    color: online ? '#eef0f2' : '#b5bac1',
    metalness: 0.12,
    roughness: 0.44,
    clearcoat: 0.2,
    clearcoatRoughness: 0.4,
  })
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.28, 0.235, 4, 0.065), surface)
  body.add(shell)

  const display = new THREE.Mesh(
    new RoundedBoxGeometry(0.238, 0.118, 0.028, 4, 0.028),
    new THREE.MeshPhysicalMaterial({ color: '#242830', metalness: 0.1, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
  )
  display.position.set(0, 0.012, 0.112)
  body.add(display)

  const eyes = new THREE.Group()
  eyes.position.set(0, 0.012, 0.129)
  const eyeGeometry = new THREE.CapsuleGeometry(0.012, 0.022, 4, 12)
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: online ? '#e8edf3' : '#8f99a6', toneMapped: false })
  for (const x of [-0.045, 0.045]) {
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    eye.position.x = x
    eye.scale.z = 0.3
    eyes.add(eye)
  }
  body.add(eyes)
  const fins: THREE.Mesh[] = []
  const signal = new THREE.Mesh(
    new THREE.SphereGeometry(0.006, 8, 6),
    new THREE.MeshStandardMaterial({ color: online ? '#788593' : '#929ba5', roughness: 0.5, metalness: 0.15 }),
  )
  signal.position.set(0, -0.084, 0.119)
  body.add(signal)

  return { group, body, eyes, fins, signal, phase: variant * 1.17, online }
}
