import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const AGENT_MODEL_SIZE = 0.38
const FACE_REFERENCE_SHADOW = new THREE.Color('#5c6e88')
const FACE_REFERENCE_HIGHLIGHT = new THREE.Color('#a5b9d8')

export interface AgentCompanion {
  group: THREE.Group
  body: THREE.Group
  phase: number
  online: boolean
  dispose: () => void
}

export interface AgentCompanionAsset {
  create: (online: boolean, variant: number) => AgentCompanion
  dispose: () => void
}

function matchFaceReferenceColors(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)
      || object.material.name !== 'Slate_Inset_Velvet') return
    const colors = object.geometry.getAttribute('color')
    if (!colors || colors.count === 0) return

    // 참고 이미지에서 측정한 얼굴 색 범위로 정점색 그라데이션 보정
    const minimum = new THREE.Vector3().setScalar(Infinity)
    const maximum = new THREE.Vector3().setScalar(-Infinity)
    const sample = new THREE.Vector3()
    for (let index = 0; index < colors.count; index++) {
      sample.fromBufferAttribute(colors, index)
      minimum.min(sample)
      maximum.max(sample)
    }
    const range = maximum.sub(minimum)
    const adjusted = colors.clone()
    for (let index = 0; index < colors.count; index++) {
      sample.fromBufferAttribute(colors, index).sub(minimum)
      adjusted.setXYZ(index,
        THREE.MathUtils.lerp(FACE_REFERENCE_SHADOW.r, FACE_REFERENCE_HIGHLIGHT.r, range.x > 0 ? sample.x / range.x : 0.5),
        THREE.MathUtils.lerp(FACE_REFERENCE_SHADOW.g, FACE_REFERENCE_HIGHLIGHT.g, range.y > 0 ? sample.y / range.y : 0.5),
        THREE.MathUtils.lerp(FACE_REFERENCE_SHADOW.b, FACE_REFERENCE_HIGHLIGHT.b, range.z > 0 ? sample.z / range.z : 0.5),
      )
    }
    object.geometry.setAttribute('color', adjusted)
  })
}

function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  const images = new Set<ImageBitmap>()

  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    }
  })
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value)
    }
  }
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => {
    texture.dispose()
    if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) images.add(texture.image)
  })
  images.forEach((image) => image.close())
  root.clear()
}

export async function loadAgentCompanionAsset(): Promise<AgentCompanionAsset> {
  const gltf = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}models/mascot.glb`,
  )
  matchFaceReferenceColors(gltf.scene)
  const template = new THREE.Group()
  const oriented = new THREE.Group()
  oriented.rotation.y = Math.PI / 2
  oriented.add(gltf.scene)
  template.add(oriented)

  const bounds = new THREE.Box3().setFromObject(template)
  const size = bounds.getSize(new THREE.Vector3())
  const largestDimension = Math.max(size.x, size.y, size.z)
  if (bounds.isEmpty() || !Number.isFinite(largestDimension) || largestDimension <= 0) {
    disposeModel(template)
    throw new Error('Agent 모델의 크기를 확인하지 못했습니다.')
  }
  oriented.position.sub(bounds.getCenter(new THREE.Vector3()))
  template.scale.setScalar(AGENT_MODEL_SIZE / largestDimension)

  const instances = new Set<AgentCompanion>()
  let disposed = false

  return {
    create(online, variant) {
      if (disposed) throw new Error('이미 해제된 Agent 모델입니다.')
      const group = new THREE.Group()
      const body = new THREE.Group()
      const model = template.clone(true)
      const materials = new Map<THREE.Material, THREE.Material>()
      group.name = 'AgentMascot'
      body.add(model)
      group.add(body)

      // 인스턴스별 재질만 복제해 상태와 투명도 분리, 형상과 텍스처 공유
      const cloneMaterial = (source: THREE.Material) => {
        let material = materials.get(source)
        if (!material) {
          if (source instanceof THREE.MeshStandardMaterial && source.name === 'Slate_Inset_Velvet') {
            // 참고 이미지의 얼굴 색상과 그라데이션 유지, 조명과 톤 매핑 영향 제외
            material = new THREE.MeshBasicMaterial({
              name: source.name,
              color: source.color.clone(),
              map: source.map,
              alphaMap: source.alphaMap,
              alphaTest: source.alphaTest,
              vertexColors: source.vertexColors,
              side: source.side,
              transparent: source.transparent,
              opacity: source.opacity,
              depthTest: source.depthTest,
              depthWrite: source.depthWrite,
              toneMapped: false,
              fog: false,
            })
          } else {
            material = source.clone()
          }
          material.userData.agentBaseOpacity = material.opacity
          material.userData.agentBaseTransparent = material.transparent
          material.userData.agentBaseDepthWrite = material.depthWrite
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
            // 안개로 인한 마스코트 얼굴 대비 저하 방지
            material.fog = false
          }
          if (material instanceof THREE.MeshPhysicalMaterial) {
            // 눈 렌즈의 밝은 반사 완화
            if (material.name === 'Lens_Clear_Crystal') {
              material.specularIntensity = 0.12
              material.envMapIntensity = 0.15
            }
          }
          materials.set(source, material)
        }
        return material
      }
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true
          object.receiveShadow = true
          object.material = Array.isArray(object.material)
            ? object.material.map(cloneMaterial)
            : cloneMaterial(object.material)
        }
      })

      let instanceDisposed = false
      const companion: AgentCompanion = {
        group,
        body,
        phase: variant * 1.17,
        online,
        dispose() {
          if (instanceDisposed) return
          instanceDisposed = true
          group.removeFromParent()
          materials.forEach((material) => material.dispose())
          materials.clear()
          body.clear()
          group.clear()
          instances.delete(companion)
        },
      }
      instances.add(companion)
      return companion
    },
    dispose() {
      if (disposed) return
      disposed = true
      instances.forEach((companion) => companion.dispose())
      disposeModel(template)
    },
  }
}
