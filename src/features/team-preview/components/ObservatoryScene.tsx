import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PreviewTeam } from '../data/previewData'
import '../styles/ObservatoryScene.css'

interface ObservatorySceneProps {
  team: PreviewTeam
  selectedAgentId: string | null
  selectedMemberId: string | null
  visibleAgentIds: string[]
  onSelectAgent: (id: string) => void
  paused: boolean
  view: 'orbit' | 'top'
  resetKey: number
  onAvailabilityChange: (available: boolean) => void
  panelOpen?: boolean
}

function releaseScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    }
  })
  materials.forEach((material) => {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
    material.dispose()
  })
  geometries.forEach((geometry) => geometry.dispose())
  textures.forEach((texture) => texture.dispose())
}

function printedTexture(text: string, dark: boolean) {
  const surface = document.createElement('canvas')
  surface.width = 512
  surface.height = 512
  const context = surface.getContext('2d')!
  context.fillStyle = dark ? '#35363a' : '#f8f8fa'
  context.fillRect(0, 0, 512, 512)
  context.fillStyle = dark ? '#f5f5f7' : '#454549'
  context.font = '500 62px "Segoe UI", sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 256, 256, 450)
  const texture = new THREE.CanvasTexture(surface)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export default function ObservatoryScene(props: ObservatorySceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const labelLayer = useRef<HTMLDivElement>(null)
  const labels = useRef(new Map<string, HTMLButtonElement>())
  const leaders = useRef(new Map<string, SVGPathElement>())
  const control = useRef(props)
  const wake = useRef<() => void>(() => {})
  const { team, selectedAgentId, selectedMemberId, visibleAgentIds, onSelectAgent } = props
  const agents = team.members.flatMap((member) => member.agents.map((agent) => ({ agent, member })))
  useEffect(() => { control.current = props; wake.current() }, [props])

  useEffect(() => {
    const element = host.current
    const labelsElement = labelLayer.current
    if (!element) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }) }
    catch { control.current.onAvailabilityChange(false); return }
    const canvas = renderer.domElement
    canvas.className = 'obs-scene-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    element.appendChild(canvas)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f5f5f7')
    scene.fog = new THREE.Fog('#f5f5f7', 22, 50)
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80)
    const controls = new OrbitControls(camera, canvas)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.rotateSpeed = 0.45
    controls.zoomSpeed = 0.55
    controls.minPolarAngle = 0.08
    controls.maxPolarAngle = Math.PI * 0.43
    controls.minDistance = 6
    controls.maxDistance = 27
    const generator = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    let environment: THREE.WebGLRenderTarget | undefined
    try { environment = generator.fromScene(room, 0.05); scene.environment = environment.texture; scene.environmentIntensity = 0.22 }
    catch { scene.environment = null }
    room.dispose()
    generator.dispose()
    scene.add(new THREE.HemisphereLight('#ffffff', '#c3c6cc', 2.2))
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.5)
    keyLight.position.set(-5, 9, 6)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(2048, 2048)
    keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -7
    keyLight.shadow.camera.right = keyLight.shadow.camera.top = 7
    keyLight.shadow.camera.near = 0.1
    keyLight.shadow.camera.far = 25
    keyLight.shadow.bias = -0.0002
    keyLight.shadow.normalBias = 0.025
    keyLight.shadow.radius = 4
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#e9edf0', 0.6)
    fillLight.position.set(4, 4, -5)
    scene.add(fillLight)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: '#f5f5f7', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.29
    floor.receiveShadow = true
    scene.add(floor)
    const selectables: THREE.Mesh[] = []
    const nodes: { id: string; memberId: string; group: THREE.Group; position: THREE.Vector3; labelHeight: number; materials: THREE.Material[]; marker: THREE.MeshStandardMaterial; emphasis: number; visibility: number }[] = []
    const stations: { memberId: string; material: THREE.MeshStandardMaterial }[] = []
    team.members.forEach((member, memberIndex) => {
      const column = memberIndex % 3
      const row = Math.floor(memberIndex / 3)
      const stationX = (column - 1) * 2.8 + (row ? 0.32 : -0.18)
      const stationZ = row ? 1.65 : -1.6
      const padWidth = member.agents.length > 1 ? 2.18 : 1.72
      const padMaterial = new THREE.MeshPhysicalMaterial({ color: '#e1e3e7', roughness: 0.65, metalness: 0.03, clearcoat: 0.08 })
      const tray = new THREE.Mesh(new RoundedBoxGeometry(padWidth, 0.045, 1.65, 5, 0.022), padMaterial)
      tray.position.set(stationX, -0.24, stationZ)
      tray.castShadow = true
      tray.receiveShadow = true
      scene.add(tray)
      stations.push({ memberId: member.id, material: padMaterial })
      member.agents.forEach((agent, agentIndex) => {
        const offset = (agentIndex - (member.agents.length - 1) / 2) * 0.94
        const group = new THREE.Group()
        group.position.set(stationX + offset, -0.15, stationZ)
        group.rotation.x = -0.09
        const isDark = agent.tool === 'Claude Code'
        const surface = new THREE.MeshPhysicalMaterial({ color: isDark ? '#35363a' : '#f8f8fa', roughness: 0.48, metalness: 0.03, clearcoat: 0.1, clearcoatRoughness: 0.5 })
        const tile = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.12, 0.94, 6, 0.055), surface)
        tile.position.y = 0.08
        group.add(tile)
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.78), new THREE.MeshBasicMaterial({ map: printedTexture(agent.tool, isDark), toneMapped: false }))
        face.rotation.x = -Math.PI / 2
        face.position.y = 0.142
        group.add(face)
        const led = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.006, 16), new THREE.MeshStandardMaterial({ color: agent.online ? '#348164' : '#b4b6bb', roughness: 0.6 }))
        led.position.set(0.26, 0.148, 0.32)
        group.add(led)
        const marker = new THREE.MeshStandardMaterial({ color: '#c9cdd3', roughness: 0.65 })
        const edge = new THREE.Mesh(new RoundedBoxGeometry(0.795, 0.025, 0.955, 5, 0.012), marker)
        edge.position.y = 0.015
        group.add(edge)
        const materials: THREE.Material[] = []
        group.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true
            object.receiveShadow = true
            object.userData.agentId = agent.id
            selectables.push(object)
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              material.transparent = true
              if (!materials.includes(material)) materials.push(material)
            }
          }
        })
        scene.add(group)
        nodes.push({ id: agent.id, memberId: member.id, group, position: group.position.clone(), labelHeight: 0.52 + agentIndex * 0.2, materials, marker, emphasis: 0, visibility: 1 })
      })
    })
    let disposed = false
    let contextLost = false
    let intersecting = true
    let frameId = 0
    let width = 1
    let height = 1
    let previous = performance.now()
    let initialized = false
    let autoCamera = true
    let lastSelection: string | null = null
    let lastMember: string | null = null
    let lastView = control.current.view
    let lastReset = control.current.resetKey
    let lastPanel = control.current.panelOpen ?? !!control.current.selectedAgentId
    let hoverId: string | null = null
    let pointerStart: { x: number; y: number } | null = null
    const desiredCamera = new THREE.Vector3()
    const desiredTarget = new THREE.Vector3()
    const projected = new THREE.Vector3()
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let viewOffset = 0
    let desiredViewOffset = 0
    function setPreset() {
      const selected = nodes.find((node) => node.id === control.current.selectedAgentId)
      const memberNodes = nodes.filter((node) => node.memberId === control.current.selectedMemberId)
      desiredTarget.set(0, 0, 0)
      if (selected) desiredTarget.copy(selected.position).multiplyScalar(0.06)
      else if (memberNodes.length) {
        memberNodes.forEach((node) => desiredTarget.add(node.position))
        desiredTarget.multiplyScalar(0.2 / memberNodes.length)
      }
      desiredTarget.y = 0.04
      const panelVisible = (control.current.panelOpen ?? !!selected) && width > 900
      const leftReserve = width > 900 ? panelVisible ? 260 : 220 : 0
      const rightReserve = panelVisible ? 370 : 0
      const availableWidth = Math.max(width - leftReserve - rightReserve - 70, width * 0.45)
      const distance = Math.max(10.5, 10.9 / Math.max(availableWidth / height, 0.5)) * (panelVisible ? 1.28 : 1)
      controls.maxDistance = Math.max(27, distance * 1.6)
      if (control.current.view === 'top') desiredCamera.set(0.1, distance * 1.06, 0.15)
      else desiredCamera.set(distance * 0.22, distance * 0.78, distance * 0.76)
      desiredCamera.add(desiredTarget)
      desiredViewOffset = (rightReserve - leftReserve) / 2
      autoCamera = true
    }
    function placeLabels() {
      if (!labelLayer.current) return
      labelLayer.current.style.visibility = 'visible'
      const placed: { x: number; y: number }[] = []
      const compact = width < 600
      const labelWidth = compact ? 86 : 128
      const labelHeight = compact ? 31 : 48
      nodes.map((node) => {
        projected.copy(node.group.position)
        projected.y += node.labelHeight
        projected.project(camera)
        return { node, x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height, depth: projected.z }
      }).sort((a, b) => a.y - b.y).forEach(({ node, x, y, depth }) => {
        const label = labels.current.get(node.id)
        const leader = leaders.current.get(node.id)
        if (!label) return
        const matches = control.current.visibleAgentIds.includes(node.id) && (!control.current.selectedMemberId || control.current.selectedMemberId === node.memberId)
        const visible = matches && depth > -1 && depth < 1 && x > -40 && x < width + 40 && y > -30 && y < height + 30
        label.hidden = !visible
        if (leader) leader.style.opacity = '0'
        if (!visible) return
        const minLabelX = width > 900 ? 250 + labelWidth / 2 : labelWidth / 2 + 12
        const panelVisible = (control.current.panelOpen ?? !!control.current.selectedAgentId) && width > 900
        const maxLabelX = width - (panelVisible ? 355 : 12) - labelWidth / 2
        const boundedX = THREE.MathUtils.clamp(x, minLabelX, Math.max(minLabelX, maxLabelX))
        let nextY = THREE.MathUtils.clamp(y, labelHeight + 14, height - 20)
        const collision = placed.find((box) => Math.abs(boundedX - box.x) < labelWidth + 5 && Math.abs(nextY - box.y) < labelHeight + 6)
        if (collision) nextY = Math.max(labelHeight + 14, collision.y - labelHeight - 7)
        label.style.transform = `translate3d(${boundedX.toFixed(1)}px, ${nextY.toFixed(1)}px, 0) translate(-50%, -100%)`
        label.style.zIndex = node.id === control.current.selectedAgentId ? '4' : '2'
        if (leader && Math.hypot(boundedX - x, nextY - y) > 9) {
          leader.setAttribute('d', `M ${boundedX.toFixed(1)} ${nextY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`)
          leader.style.opacity = '0.45'
        }
        placed.push({ x: boundedX, y: nextY })
      })
    }
    function frame(now: number) {
      frameId = 0
      if (disposed || contextLost || document.hidden || !intersecting) return
      const delta = THREE.MathUtils.clamp((now - previous) / 1000, 0.001, 0.05)
      previous = now
      const frozen = control.current.paused
      const blend = frozen ? 1 : 1 - Math.exp(-delta * 11)
      const panel = control.current.panelOpen ?? !!control.current.selectedAgentId
      if (lastSelection !== control.current.selectedAgentId || lastMember !== control.current.selectedMemberId || lastView !== control.current.view || lastReset !== control.current.resetKey || lastPanel !== panel) {
        lastSelection = control.current.selectedAgentId
        lastMember = control.current.selectedMemberId
        lastView = control.current.view
        lastReset = control.current.resetKey
        lastPanel = panel
        setPreset()
      }
      let settling = false
      nodes.forEach((node) => {
        const matches = control.current.visibleAgentIds.includes(node.id) && (!control.current.selectedMemberId || control.current.selectedMemberId === node.memberId)
        const targetEmphasis = node.id === control.current.selectedAgentId || node.id === hoverId ? 1 : 0
        const targetVisibility = matches ? 1 : 0.18
        node.emphasis = THREE.MathUtils.lerp(node.emphasis, targetEmphasis, blend)
        node.visibility = THREE.MathUtils.lerp(node.visibility, targetVisibility, blend)
        if (Math.abs(node.emphasis - targetEmphasis) > 0.002 || Math.abs(node.visibility - targetVisibility) > 0.002) settling = true
        node.materials.forEach((material) => { material.opacity = node.visibility; material.depthWrite = node.visibility > 0.5 })
        node.marker.color.set(node.id === control.current.selectedAgentId ? '#0066cc' : '#c9cdd3')
        node.group.position.y = node.position.y + node.emphasis * 0.09
      })
      stations.forEach((station) => station.material.color.set(!control.current.selectedMemberId || station.memberId === control.current.selectedMemberId ? '#e1e3e7' : '#ededf0'))
      controls.enableDamping = !frozen
      if (autoCamera) {
        const cameraBlend = !initialized || frozen ? 1 : 1 - Math.exp(-delta * 5.5)
        camera.position.lerp(desiredCamera, cameraBlend)
        controls.target.lerp(desiredTarget, cameraBlend)
        viewOffset = THREE.MathUtils.lerp(viewOffset, desiredViewOffset, cameraBlend)
        if (camera.position.distanceToSquared(desiredCamera) > 0.0001 || controls.target.distanceToSquared(desiredTarget) > 0.0001 || Math.abs(viewOffset - desiredViewOffset) > 0.1) settling = true
        else autoCamera = false
      }
      camera.setViewOffset(width, height, viewOffset, 0, width, height)
      const changed = controls.update()
      initialized = true
      renderer.render(scene, camera)
      placeLabels()
      if (settling || changed) wakeUp()
    }
    function wakeUp() {
      if (!frameId && !disposed && !contextLost && !document.hidden && intersecting) frameId = requestAnimationFrame(frame)
    }
    wake.current = wakeUp
    function resize() {
      width = Math.max(element!.clientWidth, 1)
      height = Math.max(element!.clientHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      setPreset()
      wakeUp()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(element)
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting
      if (intersecting) { previous = performance.now(); wakeUp() }
      else { cancelAnimationFrame(frameId); frameId = 0 }
    }, { threshold: 0.01 })
    intersectionObserver.observe(element)
    function pick(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect()
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      return raycaster.intersectObjects(selectables, false).map((hit) => hit.object.userData.agentId as string).find((id) => control.current.visibleAgentIds.includes(id) && (!control.current.selectedMemberId || nodes.some((node) => node.id === id && node.memberId === control.current.selectedMemberId)))
    }
    function pointerDown(event: PointerEvent) { pointerStart = { x: event.clientX, y: event.clientY } }
    function pointerMove(event: PointerEvent) {
      const nextHover = event.buttons ? null : pick(event) ?? null
      canvas.style.cursor = event.buttons ? 'grabbing' : nextHover ? 'pointer' : 'grab'
      if (nextHover !== hoverId) { hoverId = nextHover; wakeUp() }
    }
    function pointerUp(event: PointerEvent) {
      if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 6) {
        const id = pick(event)
        if (id) control.current.onSelectAgent(id)
      }
      pointerStart = null
      canvas.style.cursor = 'grab'
    }
    function pointerLeave() { hoverId = null; pointerStart = null; wakeUp() }
    function manualCamera() { autoCamera = false; wakeUp() }
    function visibility() {
      if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0 }
      else { previous = performance.now(); wakeUp() }
    }
    function contextLostHandler(event: Event) {
      event.preventDefault()
      contextLost = true
      cancelAnimationFrame(frameId)
      frameId = 0
      if (labelLayer.current) labelLayer.current.style.visibility = 'hidden'
      control.current.onAvailabilityChange(false)
    }
    function contextRestoredHandler() { contextLost = false; control.current.onAvailabilityChange(true); wakeUp() }
    controls.addEventListener('start', manualCamera)
    controls.addEventListener('change', wakeUp)
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerLeave)
    canvas.addEventListener('pointerleave', pointerLeave)
    canvas.addEventListener('webglcontextlost', contextLostHandler)
    canvas.addEventListener('webglcontextrestored', contextRestoredHandler)
    document.addEventListener('visibilitychange', visibility)
    resize()
    control.current.onAvailabilityChange(true)
    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      wake.current = () => {}
      if (labelsElement) labelsElement.style.visibility = 'hidden'
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      controls.removeEventListener('start', manualCamera)
      controls.removeEventListener('change', wakeUp)
      controls.dispose()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerLeave)
      canvas.removeEventListener('pointerleave', pointerLeave)
      canvas.removeEventListener('webglcontextlost', contextLostHandler)
      canvas.removeEventListener('webglcontextrestored', contextRestoredHandler)
      document.removeEventListener('visibilitychange', visibility)
      releaseScene(scene)
      keyLight.shadow.dispose()
      environment?.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [team])

  return <div className="obs-scene" ref={host} role="group" aria-label="팀과 에이전트의 3D 연결 지도. 드래그로 회전하고 휠로 확대할 수 있습니다.">
    <div className="obs-scene-labels" ref={labelLayer} style={{ visibility: 'hidden' }}>
      <svg className="obs-scene-leaders" aria-hidden="true">{agents.map(({ agent }) => <path key={agent.id} ref={(element) => { if (element) leaders.current.set(agent.id, element); else leaders.current.delete(agent.id) }} />)}</svg>
      {agents.map(({ agent, member }) => <button type="button" key={agent.id}
        data-agent-id={agent.id}
        ref={(element) => { if (element) labels.current.set(agent.id, element); else labels.current.delete(agent.id) }}
        className={`obs-agent-label${selectedAgentId === agent.id ? ' is-selected' : ''}${agent.online ? ' is-online' : ' is-offline'}`}
        aria-label={`${member.name}의 ${agent.name}, ${agent.online ? '온라인' : '오프라인'}, 상세 보기`}
        aria-pressed={selectedAgentId === agent.id}
        hidden={!visibleAgentIds.includes(agent.id) || (!!selectedMemberId && member.id !== selectedMemberId)}
        onClick={() => onSelectAgent(agent.id)}>
        <span className="obs-agent-label-main">{agent.name}</span>
        <span className="obs-agent-label-owner">{member.name}<span><i aria-hidden="true" />{agent.online ? '온라인' : '오프라인'}</span></span>
      </button>)}
    </div>
  </div>
}
