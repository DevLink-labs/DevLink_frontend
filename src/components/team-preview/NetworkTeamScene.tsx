import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { PreviewTeam } from './previewData'
import { getDemoExchanges, getNetworkEntries } from './networkPreviewData'
import { createNetworkAgentAsset } from './networkAgentAsset'
import { createNetworkFlowMaterial } from './networkFlowMaterial'
import './NetworkTeamScene.css'

interface NetworkTeamSceneProps {
  team: PreviewTeam
  selectedAgentId: string | null
  focusedPairId: string | null
  visibleAgentIds: string[]
  onSelectAgent: (id: string) => void
  paused: boolean
  view: 'space' | 'plan'
  resetKey: number
  panelOpen: boolean
  onAvailabilityChange: (available: boolean) => void
}

function disposeScene(scene: THREE.Scene) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    }
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}

export default function NetworkTeamScene(props: NetworkTeamSceneProps) {
  const { team, selectedAgentId, focusedPairId, visibleAgentIds, onSelectAgent } = props
  const host = useRef<HTMLDivElement>(null)
  const labelsLayer = useRef<HTMLDivElement>(null)
  const labels = useRef(new Map<string, HTMLButtonElement>())
  const leaders = useRef(new Map<string, SVGPathElement>())
  const control = useRef(props)
  const wake = useRef<() => void>(() => {})
  const entries = getNetworkEntries(team)
  const focusedPair = getDemoExchanges(team).find((exchange) => exchange.id === focusedPairId)
  const focusedIds = focusedPair ? [focusedPair.fromId, focusedPair.toId] : []
  useEffect(() => { control.current = props; wake.current() }, [props])

  useEffect(() => {
    const element = host.current
    if (!element) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }) }
    catch { control.current.onAvailabilityChange(false); return }
    const canvas = renderer.domElement
    canvas.className = 'nts-canvas'
    canvas.setAttribute('aria-hidden', 'true')
    element.appendChild(canvas)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#f3f4f6')
    scene.fog = new THREE.Fog('#f3f4f6', 24, 50)
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80)
    const controls = new OrbitControls(camera, canvas)
    controls.enablePan = false
    controls.enableDamping = true
    controls.dampingFactor = 0.09
    controls.rotateSpeed = 0.45
    controls.zoomSpeed = 0.55
    controls.minPolarAngle = 0.08
    controls.maxPolarAngle = Math.PI * 0.43
    controls.minDistance = 7
    controls.maxDistance = 30
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    let environment: THREE.WebGLRenderTarget | undefined
    try { environment = pmrem.fromScene(room, 0.05); scene.environment = environment.texture; scene.environmentIntensity = 0.55 }
    catch { scene.environment = null }
    room.dispose()
    pmrem.dispose()
    scene.add(new THREE.HemisphereLight('#ffffff', '#b5bdc7', 1.8))
    const key = new THREE.DirectionalLight('#ffffff', 2.3)
    key.position.set(-4, 9, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = key.shadow.camera.bottom = -8
    key.shadow.camera.right = key.shadow.camera.top = 8
    key.shadow.camera.near = 0.1
    key.shadow.camera.far = 25
    key.shadow.normalBias = 0.025
    key.shadow.bias = -0.0002
    scene.add(key)
    const fill = new THREE.DirectionalLight('#d5dce4', 0.75)
    fill.position.set(5, 4, -5)
    scene.add(fill)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: '#f3f4f6', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.24
    floor.receiveShadow = true
    scene.add(floor)

    const selectables: THREE.Mesh[] = []
    const nodes = getNetworkEntries(team).map(({ agent, member }, index) => {
      const group = new THREE.Group()
      const asset = createNetworkAgentAsset(agent.online, index)
      group.add(asset.group)
      const selectionMaterial = new THREE.MeshBasicMaterial({ color: '#3977b5', transparent: true, opacity: 0 })
      const selectionRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.015, 6, 64), selectionMaterial)
      selectionRing.rotation.x = Math.PI / 2
      selectionRing.position.y = -0.19
      group.add(selectionRing)
      const materials: THREE.Material[] = []
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          if (object instanceof THREE.Mesh) { object.userData.agentId = agent.id; selectables.push(object) }
          for (const item of Array.isArray(object.material) ? object.material : [object.material]) {
            if (item !== selectionMaterial && !materials.includes(item)) materials.push(item)
          }
        }
      })
      scene.add(group)
      return { agent, member, index, group, position: new THREE.Vector3(), materials, selectionMaterial, emphasis: 0, opacity: 1 }
    })
    const nodeById = new Map(nodes.map((node) => [node.agent.id, node]))
    const edges = nodes.length > 1 ? nodes.map((node, index) => {
      const next = nodes[(index + 1) % nodes.length]
      const online = node.agent.online && next.agent.online
      const material = online
        ? new THREE.LineBasicMaterial({ color: '#9ca9b7', transparent: true, opacity: 0.6 })
        : new THREE.LineDashedMaterial({ color: '#b4bbc4', dashSize: 0.12, gapSize: 0.12, transparent: true, opacity: 0.8 })
      const line = new THREE.Line(new THREE.BufferGeometry(), material)
      scene.add(line)
      return { fromId: node.agent.id, toId: next.agent.id, line, material }
    }) : []
    const exchanges = getDemoExchanges(team).map((exchange, index) => {
      const color = index === 0 ? '#3977b5' : '#39866d'
      const material = createNetworkFlowMaterial(color, index * 0.43)
      const path = new THREE.Mesh(new THREE.BufferGeometry(), material)
      scene.add(path)
      const arrowMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
      const arrow = new THREE.Line(new THREE.BufferGeometry(), arrowMaterial)
      scene.add(arrow)
      return { ...exchange, index, path, material, arrow, arrowMaterial, curve: new THREE.QuadraticBezierCurve3(), visible: true }
    })

    let disposed = false
    let contextLost = false
    let intersecting = true
    let frameId = 0
    let width = 1
    let height = 1
    let compact = false
    let elapsed = 0
    let previous = performance.now()
    let initialized = false
    let autoCamera = true
    let hoverId: string | null = null
    let pointerStart: { x: number; y: number } | null = null
    let lastSelection = control.current.selectedAgentId
    let lastPair = control.current.focusedPairId
    let lastView = control.current.view
    let lastReset = control.current.resetKey
    let lastPanel = control.current.panelOpen
    const desiredCamera = new THREE.Vector3()
    const desiredTarget = new THREE.Vector3()
    const projected = new THREE.Vector3()
    const anchor = new THREE.Vector3()
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let viewOffset = 0
    let desiredViewOffset = 0

    function layoutNodes() {
      const positions = [
        [-3.4, -1.7], [-0.8, -2.4], [2.2, -1.7], [3.8, 0.4],
        [2.6, 2.2], [-0.3, 1.6], [-3.3, 1.9], [-4.5, 0.1],
      ]
      nodes.forEach((node, index) => {
        if (compact) node.position.set(index % 2 ? 1.45 : -1.45, 0, (Math.floor(index / 2) - (Math.ceil(nodes.length / 2) - 1) / 2) * 2.1)
        else if (nodes.length === 8) node.position.set(positions[index][0], 0, positions[index][1])
        else {
          const angle = index / nodes.length * Math.PI * 2 - Math.PI / 2
          node.position.set(Math.cos(angle) * 3.6, 0, Math.sin(angle) * 2.1)
        }
        node.group.position.copy(node.position)
      })
      edges.forEach((edge) => {
        const from = nodeById.get(edge.fromId)!.position.clone().setY(-0.18)
        const to = nodeById.get(edge.toId)!.position.clone().setY(-0.18)
        const midpoint = from.clone().lerp(to, 0.5)
        midpoint.y = -0.15
        const geometry = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(from, midpoint, to).getPoints(50))
        edge.line.geometry.dispose()
        edge.line.geometry = geometry
        edge.line.computeLineDistances()
      })
      exchanges.forEach((exchange) => {
        const from = nodeById.get(exchange.fromId)!.position.clone().setY(0.12)
        const to = nodeById.get(exchange.toId)!.position.clone().setY(0.12)
        const midpoint = from.clone().lerp(to, 0.5)
        midpoint.y = compact ? 0.5 : 0.65 + exchange.index * 0.15
        exchange.curve = new THREE.QuadraticBezierCurve3(from, midpoint, to)
        exchange.path.geometry.dispose()
        exchange.path.geometry = new THREE.TubeGeometry(exchange.curve, 100, 0.023, 6, false)
        const tip = exchange.curve.getPoint(compact ? 0.65 : 0.8)
        const direction = exchange.curve.getTangent(compact ? 0.65 : 0.8).normalize()
        const side = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize()
        const heel = tip.clone().addScaledVector(direction, -0.15)
        exchange.arrow.geometry.dispose()
        exchange.arrow.geometry = new THREE.BufferGeometry().setFromPoints([
          heel.clone().addScaledVector(side, 0.075), tip, heel.clone().addScaledVector(side, -0.075),
        ])
      })
    }

    function setPreset() {
      const panel = control.current.panelOpen && width > 1000
      const available = Math.max(width - (panel ? 430 : 0) - 80, width * 0.55)
      const distance = compact ? Math.max(12.8, 8.4 / Math.max(width / height, 0.45)) : Math.max(11.8, 12.2 / Math.max(available / height, 0.5)) * (panel ? 1.08 : 1)
      desiredTarget.set(-0.25, 0, 0)
      const selected = nodeById.get(control.current.selectedAgentId ?? '')
      if (selected && !compact) desiredTarget.addScaledVector(selected.position, 0.1)
      if (control.current.view === 'plan') desiredCamera.set(0, distance * 1.08, distance * 0.04)
      else desiredCamera.set(distance * 0.035, distance * 0.82, distance * 0.75)
      desiredCamera.add(desiredTarget)
      desiredViewOffset = panel ? 210 : 0
      controls.maxDistance = Math.max(30, distance * 1.7)
      autoCamera = true
    }

    function placeLabels() {
      if (!labelsLayer.current) return
      labelsLayer.current.style.visibility = 'visible'
      const rightReserve = control.current.panelOpen && width > 1000 ? 420 : 0
      const labelWidth = compact ? 112 : 144
      type Rect = { left: number; right: number; top: number; bottom: number }
      const placed: Rect[] = []
      const bounds = nodes.map((node) => {
        const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
        for (const x of [-0.64, 0.64]) for (const y of [-0.2, 0.6]) for (const z of [-0.57, 0.57]) {
          projected.set(node.group.position.x + x, node.group.position.y + y, node.group.position.z + z).project(camera)
          const screenX = (projected.x * 0.5 + 0.5) * width
          const screenY = (-projected.y * 0.5 + 0.5) * height
          box.left = Math.min(box.left, screenX)
          box.right = Math.max(box.right, screenX)
          box.top = Math.min(box.top, screenY)
          box.bottom = Math.max(box.bottom, screenY)
        }
        anchor.copy(node.group.position).setY(node.group.position.y + 0.18).project(camera)
        return { node, box, depth: anchor.z }
      })
      const overlap = (a: Rect, b: Rect, gap = 0) => Math.max(0, Math.min(a.right + gap, b.right) - Math.max(a.left - gap, b.left))
        * Math.max(0, Math.min(a.bottom + gap, b.bottom) - Math.max(a.top - gap, b.top))
      bounds.sort((a, b) => a.box.bottom - b.box.bottom).forEach(({ node, box, depth }) => {
        const label = labels.current.get(node.agent.id)
        const leader = leaders.current.get(node.agent.id)
        if (!label) return
        const visible = control.current.visibleAgentIds.includes(node.agent.id) && depth > -1 && depth < 1
          && box.right > 0 && box.left < width - rightReserve && box.bottom > 0 && box.top < height
        label.hidden = !visible
        if (leader) leader.style.opacity = '0'
        if (!visible) return
        const labelHeight = node.agent.online ? 30 : compact ? 40 : 44
        const middleX = (box.left + box.right) / 2
        const middleY = (box.top + box.bottom) / 2
        const belowY = box.bottom + 10
        const candidates = [
          [middleX, belowY],
          [box.right + labelWidth / 2 + 13, middleY - labelHeight / 2],
          [box.left - labelWidth / 2 - 13, middleY - labelHeight / 2],
          [middleX, box.top - labelHeight - 11],
          [middleX - 38, belowY + 5], [middleX + 38, belowY + 5],
          [box.right + labelWidth / 2 + 13, box.bottom],
          [box.left - labelWidth / 2 - 13, box.bottom],
        ].map(([x, y]) => {
          const nextX = THREE.MathUtils.clamp(x, labelWidth / 2 + 14, Math.max(labelWidth / 2 + 14, width - rightReserve - labelWidth / 2 - 14))
          const nextY = THREE.MathUtils.clamp(y, 12, height - labelHeight - 14)
          const rect = { left: nextX - labelWidth / 2, right: nextX + labelWidth / 2, top: nextY, bottom: nextY + labelHeight }
          const labelOverlap = placed.reduce((total, other) => total + overlap(rect, other, 7), 0)
          const bodyOverlap = bounds.reduce((total, other) => total + overlap(rect, other.box, 5), 0)
          return { x: nextX, y: nextY, rect, score: labelOverlap * 12 + bodyOverlap * 8 + Math.hypot(nextX - middleX, nextY - belowY) * 0.15 }
        }).sort((a, b) => a.score - b.score)
        const best = candidates[0]
        label.style.transform = `translate3d(${best.x.toFixed(1)}px, ${best.y.toFixed(1)}px, 0) translateX(-50%)`
        label.style.zIndex = node.agent.id === control.current.selectedAgentId ? '4' : '2'
        if (leader) {
          const endX = THREE.MathUtils.clamp(best.x, box.left, box.right)
          const endY = THREE.MathUtils.clamp(best.y + labelHeight / 2, box.top, box.bottom)
          const startX = THREE.MathUtils.clamp(endX, best.rect.left + 7, best.rect.right - 7)
          const startY = THREE.MathUtils.clamp(endY, best.rect.top + 3, best.rect.bottom - 3)
          if (Math.hypot(startX - endX, startY - endY) > 18) {
            leader.setAttribute('d', `M ${startX.toFixed(1)} ${startY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`)
            leader.style.opacity = '0.3'
          }
        }
        placed.push(best.rect)
      })
    }
    function frame(now: number) {
      frameId = 0
      if (disposed || contextLost || document.hidden || !intersecting) return
      const delta = THREE.MathUtils.clamp((now - previous) / 1000, 0.001, 0.05)
      previous = now
      const frozen = control.current.paused
      if (!frozen) elapsed += delta
      const blend = frozen ? 1 : 1 - Math.exp(-delta * 10)
      if (lastSelection !== control.current.selectedAgentId || lastPair !== control.current.focusedPairId || lastView !== control.current.view || lastReset !== control.current.resetKey || lastPanel !== control.current.panelOpen) {
        lastSelection = control.current.selectedAgentId
        lastPair = control.current.focusedPairId
        lastView = control.current.view
        lastReset = control.current.resetKey
        lastPanel = control.current.panelOpen
        setPreset()
      }
      const focusedPair = exchanges.find((exchange) => exchange.id === control.current.focusedPairId)
      const focusedIds = focusedPair ? [focusedPair.fromId, focusedPair.toId] : []
      let settling = false
      nodes.forEach((node) => {
        const matches = control.current.visibleAgentIds.includes(node.agent.id)
        const focusMatches = !focusedPair || focusedIds.includes(node.agent.id)
        const emphasis = node.agent.id === control.current.selectedAgentId || node.agent.id === hoverId || focusedIds.includes(node.agent.id) ? 1 : 0
        const opacity = matches ? focusMatches ? 1 : 0.42 : 0.12
        node.emphasis = THREE.MathUtils.lerp(node.emphasis, emphasis, blend)
        node.opacity = THREE.MathUtils.lerp(node.opacity, opacity, blend)
        if (Math.abs(node.emphasis - emphasis) > 0.002 || Math.abs(node.opacity - opacity) > 0.002) settling = true
        node.materials.forEach((material) => {
          const transparent = material.userData.keepTransparent === true || node.opacity < 0.995
          if (material.transparent !== transparent) {
            material.transparent = transparent
            material.needsUpdate = true
          }
          material.opacity = node.opacity
          material.depthWrite = material.userData.noDepthWrite !== true && node.opacity > 0.5
        })
        node.selectionMaterial.opacity = node.emphasis * node.opacity
        node.group.position.y = node.position.y + node.emphasis * 0.06
      })
      edges.forEach((edge) => {
        const matches = control.current.visibleAgentIds.includes(edge.fromId) && control.current.visibleAgentIds.includes(edge.toId)
        const selected = !control.current.selectedAgentId || edge.fromId === control.current.selectedAgentId || edge.toId === control.current.selectedAgentId
        edge.material.opacity = matches ? selected ? 0.7 : 0.22 : 0.08
      })
      exchanges.forEach((exchange) => {
        const matches = control.current.visibleAgentIds.includes(exchange.fromId) && control.current.visibleAgentIds.includes(exchange.toId)
        const focusMatches = focusedPair ? exchange.id === focusedPair.id : !control.current.selectedAgentId || exchange.fromId === control.current.selectedAgentId || exchange.toId === control.current.selectedAgentId
        exchange.visible = matches && focusMatches
        exchange.path.visible = matches
        exchange.material.uniforms.uTime.value = elapsed
        exchange.material.uniforms.uPaused.value = frozen ? 1 : 0
        exchange.material.uniforms.uOpacity.value = focusMatches ? 1 : 0.2
        exchange.arrow.visible = matches
        exchange.arrowMaterial.opacity = focusMatches ? 0.8 : 0.15
      })
      controls.enableDamping = !frozen
      if (autoCamera) {
        const cameraBlend = !initialized || frozen ? 1 : 1 - Math.exp(-delta * 5)
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
      if ((!frozen && exchanges.some((exchange) => exchange.visible)) || settling || changed) wakeUp()
    }

    function wakeUp() {
      if (!frameId && !disposed && !contextLost && !document.hidden && intersecting) frameId = requestAnimationFrame(frame)
    }
    wake.current = wakeUp
    function resize() {
      width = Math.max(element!.clientWidth, 1)
      height = Math.max(element!.clientHeight, 1)
      const nextCompact = width < 700
      if (!initialized || nextCompact !== compact) { compact = nextCompact; layoutNodes() }
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
      return raycaster.intersectObjects(selectables, false).map((hit) => hit.object.userData.agentId as string).find((id) => control.current.visibleAgentIds.includes(id))
    }
    function pointerDown(event: PointerEvent) { pointerStart = { x: event.clientX, y: event.clientY } }
    function pointerMove(event: PointerEvent) {
      const id = event.buttons ? null : pick(event) ?? null
      canvas.style.cursor = event.buttons ? 'grabbing' : id ? 'pointer' : 'grab'
      if (id !== hoverId) { hoverId = id; wakeUp() }
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
      if (labelsLayer.current) labelsLayer.current.style.visibility = 'hidden'
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
      if (labelsLayer.current) labelsLayer.current.style.visibility = 'hidden'
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
      disposeScene(scene)
      key.shadow.dispose()
      environment?.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [team])

  return <div className="nts-scene" ref={host} role="group" aria-label="에이전트 연결 지도. 드래그로 회전하고 휠로 확대할 수 있습니다. 실선은 연결, 점선은 오프라인 연결입니다.">
    <div className="nts-labels" ref={labelsLayer} style={{ visibility: 'hidden' }}>
      <svg className="nts-leaders" aria-hidden="true">{entries.map(({ agent }) => <path key={agent.id} ref={(element) => { if (element) leaders.current.set(agent.id, element); else leaders.current.delete(agent.id) }} />)}</svg>
      {entries.map(({ agent, member }) => <button type="button" key={agent.id} data-agent-id={agent.id}
        className={`nts-agent-label ${agent.online ? 'is-online' : 'is-offline'} ${selectedAgentId === agent.id ? 'is-selected' : ''} ${focusedIds.length && !focusedIds.includes(agent.id) ? 'is-muted' : ''}`}
        ref={(element) => { if (element) labels.current.set(agent.id, element); else labels.current.delete(agent.id) }}
        title={`${member.name} · ${agent.online ? '온라인' : '오프라인'}`} hidden={!visibleAgentIds.includes(agent.id)} aria-pressed={selectedAgentId === agent.id}
        aria-label={`${agent.name}, ${agent.online ? '온라인' : '오프라인'}, ${member.name}의 에이전트 상세 보기`} onClick={() => onSelectAgent(agent.id)}>
        <span className="nts-agent-name"><i aria-hidden="true" /><strong>{agent.name}</strong></span>{!agent.online && <span className="nts-offline-caption">오프라인</span>}
      </button>)}
    </div>
  </div>
}
