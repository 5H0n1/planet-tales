import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Stars, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { TreeLike } from '../engine'
import { computeTrees, latLngToXYZ, taskLatLng, xyzToLatLng, surfaceR, SURFACE_BUMP } from '../engine'
import { usePlanetStore } from '../store'
import { planetColorByStage, stageOfProsperity, itemById } from '../types'
import type { PlacedItem } from '../store'
import { GlbSlot } from './Models'

const R = 2 // 星球半径
/** 放置吸附步长（度）：格子辅助线的吸附单位 */
const SNAP = 7.5

/** 离线镜面环境反射：RoomEnvironment 不需要下载 HDR */
function ChromeEnv() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

function PlanetSurface({
  stage,
  broken,
  placing,
  onPlaceMove,
  onPlaceClick,
}: {
  stage: number
  broken: boolean
  placing: boolean
  onPlaceMove: (lat: number, lng: number) => void
  onPlaceClick: (lat: number, lng: number) => void
}) {
  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(R, 32)
    const pos = g.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const r = R * (1 + bump(v) * SURFACE_BUMP)
      v.normalize().multiplyScalar(r)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])

  const snap = (e: { point: THREE.Vector3 }) => {
    const { lat, lng } = xyzToLatLng(e.point.x, e.point.y, e.point.z)
    const slat = Math.round(lat / SNAP) * SNAP
    const slng = Math.round(lng / SNAP) * SNAP
    return { lat: Math.max(-82, Math.min(82, slat)), lng: slng }
  }

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onPointerMove={(e) => {
        if (!placing) return
        e.stopPropagation()
        const { lat, lng } = snap(e)
        onPlaceMove(lat, lng)
      }}
      onClick={(e) => {
        if (!placing || e.delta > 4) return // 拖拽旋转不触发落位
        e.stopPropagation()
        const { lat, lng } = snap(e)
        onPlaceClick(lat, lng)
      }}
    >
      {/* 液态铬镜面：按阶段染色反射 */}
      <meshStandardMaterial
        color={broken ? '#7A3030' : planetColorByStage(stage)}
        metalness={broken ? 0.85 : 0.96}
        roughness={broken ? 0.35 : 0.1}
        envMapIntensity={broken ? 0.7 : 1.15}
      />
    </mesh>
  )
}

/** 确定性伪噪声：让球面有轻微低多边形起伏（SURFACE_BUMP 已调小，表面更平滑） */
function bump(v: THREE.Vector3): number {
  return (
    Math.sin(v.x * 2.1) * Math.sin(v.y * 2.3) * Math.sin(v.z * 1.9) * 0.6 +
    Math.sin(v.x * 5.2 + v.y * 3.7) * 0.4
  )
}

/** 放置模式下的经纬网格辅助线（家居装饰格子感） */
function PlacementGrid({ visible }: { visible: boolean }) {
  const geometry = useMemo(() => {
    const pts: number[] = []
    const r = R * 1.002
    // 纬线：每 15° 一条
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let lng = -180; lng < 180; lng += 5) {
        const a = latLngToXYZ(lat, lng, r)
        const b = latLngToXYZ(lat, lng + 5, r)
        pts.push(...a, ...b)
      }
    }
    // 经线：每 15° 一条
    for (let lng = -180; lng < 180; lng += 15) {
      for (let lat = -85; lat < 85; lat += 5) {
        const a = latLngToXYZ(lat, lng, r)
        const b = latLngToXYZ(lat + 5, lng, r)
        pts.push(...a, ...b)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <lineSegments geometry={geometry} visible={visible}>
      <lineBasicMaterial color="#FFFFFF" transparent opacity={0.22} depthWrite={false} />
    </lineSegments>
  )
}

/** 放置幽灵预览：半透明显示将要落下的物品 */
function PlacementGhost({ itemId, lat, lng }: { itemId: string; lat: number; lng: number }) {
  const gltf = useGLTF(`${import.meta.env.BASE_URL}models/${itemId}.glb`)
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true)
    o.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.material = (c.material as THREE.Material).clone()
        const m = c.material as THREE.MeshStandardMaterial
        m.transparent = true
        m.opacity = 0.55
        m.depthWrite = false
      }
    })
    const box = new THREE.Box3().setFromObject(o)
    const h = box.max.y - box.min.y
    const s = h > 1e-4 ? 0.55 / h : 1
    o.scale.setScalar(s)
    const b2 = new THREE.Box3().setFromObject(o)
    o.position.y -= b2.min.y
    return o
  }, [gltf])

  const radius = surfaceR(lat, lng, R) + 0.01
  const position = new THREE.Vector3(...latLngToXYZ(lat, lng, radius))
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    position.clone().normalize(),
  )
  const target = itemId === 'rainbow' ? 0.9 : 0.55
  void target
  return (
    <group position={position} quaternion={quaternion}>
      <primitive object={obj} />
      {/* 落点圆环标记 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.24, 0.3, 24]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** 一棵树 / 一颗种子 / 一株枯苗，带生长动画 */
function Tree({ tree, title, selected, onSelect }: { tree: TreeLike; title: string; selected: boolean; onSelect: () => void }) {
  const group = useRef<THREE.Group>(null!)
  const scale = useRef(0.01)
  const prevForm = useRef(tree.form)

  const { position, quaternion } = useMemo(() => {
    const radius = surfaceR(tree.lat, tree.lng, R) + 0.005
    const p = new THREE.Vector3(...latLngToXYZ(tree.lat, tree.lng, radius))
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      p.clone().normalize(),
    )
    return { position: p, quaternion: q }
  }, [tree.lat, tree.lng])

  useFrame((_, dt) => {
    if (prevForm.current !== tree.form) {
      prevForm.current = tree.form
      scale.current = 0.01 // 形态变化时从最小重新长出来
    }
    const target = tree.form === 1 ? 1 : 0.35
    scale.current = THREE.MathUtils.damp(scale.current, target, 4, dt)
    group.current.scale.setScalar(scale.current)
  })

  const wilted = tree.form === 2
  const seed = tree.form === 0

  return (
    <group position={position} quaternion={quaternion}>
      <group
        ref={group}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        {seed ? (
          <GlbSlot
            id="seed"
            targetHeight={0.22}
            fallback={
              <mesh>
                <coneGeometry args={[0.08, 0.2, 10]} />
                <meshStandardMaterial color="#FFD66B" emissive="#FFD66B" emissiveIntensity={0.8} />
              </mesh>
            }
          />
        ) : wilted ? (
          <GlbSlot
            id="dead"
            targetHeight={0.5}
            fallback={
              <>
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.03, 0.045, 0.22, 6]} />
                  <meshStandardMaterial color="#8A6F4D" flatShading />
                </mesh>
                <mesh position={[0, 0.24, 0]} rotation={[0, 0, 0.5]}>
                  <coneGeometry args={[0.1, 0.18, 7]} />
                  <meshStandardMaterial color="#C9A27E" flatShading roughness={0.8} />
                </mesh>
              </>
            }
          />
        ) : (
          <GlbSlot
            id="tree"
            targetHeight={0.85}
            fallback={
              <>
                <mesh position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.03, 0.045, 0.22, 6]} />
                  <meshStandardMaterial color="#7A5230" flatShading />
                </mesh>
                <mesh position={[0, 0.42, 0]}>
                  <coneGeometry args={[0.22, 0.4, 7]} />
                  <meshStandardMaterial color={tree.color} flatShading roughness={0.8} />
                </mesh>
              </>
            }
          />
        )}
      </group>
      {selected && (
        <Html center distanceFactor={6} position={[0, 0.8, 0]}>
          <div className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[#2D3142] shadow-lg">
            {title}
          </div>
        </Html>
      )}
    </group>
  )
}

/** 仓库物品：放置到星球上的装饰（GLB 模型，物理贴合地表） */
function PlacedThing({ placed }: { placed: PlacedItem }) {
  const { position, quaternion } = useMemo(() => {
    const { lat, lng } =
      placed.lat !== undefined && placed.lng !== undefined
        ? { lat: placed.lat, lng: placed.lng }
        : taskLatLng(placed.taskId + '#item')
    // 真实地形半径 + 微小浮空，保证不穿透地面
    const radius = surfaceR(lat, lng, R) + 0.012
    const p = new THREE.Vector3(...latLngToXYZ(lat, lng, radius))
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      p.clone().normalize(),
    )
    return { position: p, quaternion: q }
  }, [placed])

  const item = itemById(placed.itemId)
  if (!item) return null
  return (
    <group position={position} quaternion={quaternion}>
      {/* 镜面 GLB 模型，彩虹桥立起成拱 */}
      <GlbSlot
        id={item.id}
        targetHeight={item.id === 'rainbow' ? 0.9 : 0.55}
        fallback={
          <Html center distanceFactor={5} position={[0, 0, 0]}>
            <div className="text-xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
              {item.emoji}
            </div>
          </Html>
        }
      />
    </group>
  )
}

/** 环绕星球的小云朵（氛围组）：扁平铬盘，无球体 */
function Clouds({ night }: { night: boolean }) {
  const g = useRef<THREE.Group>(null!)
  useFrame((_, dt) => {
    g.current.rotation.y += dt * 0.05
  })
  const clouds = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => ({
        pos: latLngToXYZ(-20 + i * 18, i * 97, R * 1.28),
        s: 0.16 + (i % 3) * 0.05,
        tilt: [0.4 + i * 0.3, i * 0.8, 0.2] as [number, number, number],
      })),
    [],
  )
  return (
    <group ref={g}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos as [number, number, number]} rotation={c.tilt}>
          {/* 扁平圆环盘 = 无球体的卡通云 */}
          <torusGeometry args={[c.s, c.s * 0.42, 8, 20]} />
          <meshStandardMaterial
            color={night ? '#8E9BC0' : '#F4F6FF'}
            metalness={0.9}
            roughness={night ? 0.4 : 0.25}
            envMapIntensity={1.2}
            transparent
            opacity={night ? 0.4 : 0.92}
          />
        </mesh>
      ))}
    </group>
  )
}

/** 夜晚的萤火虫：绕星球缓慢漂移的发光粒子 */
function Fireflies({ count = 70 }: { count?: number }) {
  const points = useRef<THREE.Points>(null!)
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const { lat, lng } = {
        lat: Math.random() * 140 - 70,
        lng: Math.random() * 360 - 180,
      }
      const [x, y, z] = latLngToXYZ(lat, lng, R * (1.25 + Math.random() * 0.5))
      arr.set([x, y, z], i * 3)
    }
    return arr
  }, [count])

  useFrame((state, dt) => {
    points.current.rotation.y += dt * 0.04
    const mat = points.current.material as THREE.PointsMaterial
    mat.opacity = 0.55 + Math.sin(state.clock.elapsedTime * 2) * 0.3
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} color="#D8FF9E" transparent opacity={0.8} sizeAttenuation />
    </points>
  )
}

export default function PlanetScene({ idle = false, broken = false }: { idle?: boolean; broken?: boolean }) {
  const tasks = usePlanetStore((s) => s.tasks)
  const monthKey = usePlanetStore((s) => s.monthKey)
  const prosperity = usePlanetStore((s) => s.prosperity)
  const placedItems = usePlanetStore((s) => s.placedItems)
  const theme = usePlanetStore((s) => s.theme)
  const placingItemId = usePlanetStore((s) => s.placingItemId)
  const placeItemAt = usePlanetStore((s) => s.placeItemAt)
  const setPlacingItem = usePlanetStore((s) => s.setPlacingItem)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverLL, setHoverLL] = useState<{ lat: number; lng: number } | null>(null)
  const trees = useMemo(() => computeTrees(tasks, monthKey), [tasks, monthKey])
  const stage = stageOfProsperity(prosperity)
  const night = theme === 'night'

  // Esc 取消放置模式
  useEffect(() => {
    if (!placingItemId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlacingItem(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placingItemId, setPlacingItem])

  return (
    <Canvas
      camera={{ position: [0, 2.2, 6.2], fov: 42 }}
      dpr={[1, 2]}
      onPointerMissed={() => {
        if (placingItemId) setPlacingItem(null)
        setSelectedId(null)
      }}
    >
      <ChromeEnv />
      <color attach="background" args={[night ? '#1B2440' : '#9FD1F5']} />
      {night && <Stars radius={40} depth={20} count={1200} factor={3} saturation={0} fade speed={0.5} />}
      <ambientLight intensity={night ? 0.45 : 0.75} color={night ? '#B9C4FF' : '#FFF4E0'} />
      <directionalLight position={[5, 4, 5]} intensity={night ? 1.1 : 1.6} color={night ? '#AAB6FF' : '#FFE9C4'} />
      {!night && <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#BFDCFF" />}
      <pointLight position={[-6, -3, -4]} intensity={broken ? 30 : night ? 18 : 6} color={broken ? '#FF5A5A' : '#7A86FF'} />

      <group>
        <PlanetSurface
          stage={stage}
          broken={broken}
          placing={!!placingItemId}
          onPlaceMove={(lat, lng) => setHoverLL({ lat, lng })}
          onPlaceClick={(lat, lng) => {
            if (!placingItemId) return
            placeItemAt(placingItemId, lat, lng)
            setPlacingItem(null)
            setHoverLL(null)
          }}
        />
        <PlacementGrid visible={!!placingItemId} />
        {placingItemId && hoverLL && <PlacementGhost itemId={placingItemId} lat={hoverLL.lat} lng={hoverLL.lng} />}
        {trees.map((t) => (
          <Tree
            key={t.id}
            tree={t}
            title={tasks.find((x) => x.id === t.id)?.title ?? ''}
            selected={selectedId === t.id}
            onSelect={() => setSelectedId(t.id === selectedId ? null : t.id)}
          />
        ))}
        {placedItems.map((p) => (
          <PlacedThing key={p.taskId} placed={p} />
        ))}
        <Clouds night={night} />
        {night && <Fireflies />}
      </group>

      {/* 破碎时星球停止转动 */}
      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={12}
        autoRotate={!broken && !placingItemId}
        autoRotateSpeed={idle ? 2.6 : 0.6}
      />
    </Canvas>
  )
}
