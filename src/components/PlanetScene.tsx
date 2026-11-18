import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import type { TreeLike } from '../engine'
import { computeTrees, latLngToXYZ, taskLatLng } from '../engine'
import { usePlanetStore } from '../store'
import { planetColorByStage, stageOfProsperity, itemById } from '../types'
import type { PlacedItem } from '../store'

const R = 2 // 星球半径

/** 确定性伪噪声：让球面有低多边形起伏 */
function bump(v: THREE.Vector3): number {
  return (
    Math.sin(v.x * 2.1) * Math.sin(v.y * 2.3) * Math.sin(v.z * 1.9) * 0.6 +
    Math.sin(v.x * 5.2 + v.y * 3.7) * 0.4
  )
}

function PlanetSurface({ stage, broken }: { stage: number; broken: boolean }) {
  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(R, 24)
    const pos = g.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const r = R * (1 + bump(v) * 0.035)
      v.normalize().multiplyScalar(r)
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color={broken ? '#5E5148' : planetColorByStage(stage)}
        flatShading
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  )
}

/** 一棵树 / 一颗种子 / 一株枯苗，带生长动画 */
function Tree({ tree, title, selected, onSelect }: { tree: TreeLike; title: string; selected: boolean; onSelect: () => void }) {
  const group = useRef<THREE.Group>(null!)
  const scale = useRef(0.01)
  const prevForm = useRef(tree.form)

  const { position, quaternion } = useMemo(() => {
    const p = new THREE.Vector3(...latLngToXYZ(tree.lat, tree.lng, R * 1.02))
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
          <mesh>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshStandardMaterial color="#FFD66B" emissive="#FFD66B" emissiveIntensity={0.8} />
          </mesh>
        ) : (
          <>
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.03, 0.045, 0.22, 6]} />
              <meshStandardMaterial color={wilted ? '#8A6F4D' : '#7A5230'} flatShading />
            </mesh>
            <mesh position={[0, wilted ? 0.24 : 0.42, 0]} rotation={wilted ? [0, 0, 0.5] : [0, 0, 0]}>
              <coneGeometry args={[wilted ? 0.1 : 0.22, wilted ? 0.18 : 0.4, 7]} />
              <meshStandardMaterial color={wilted ? '#C9A27E' : tree.color} flatShading roughness={0.8} />
            </mesh>
          </>
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

/** 仓库物品：本月放置到星球上的装饰（emoji 立牌） */
function PlacedThing({ placed }: { placed: PlacedItem }) {
  const { position } = useMemo(() => {
    const { lat, lng } = taskLatLng(placed.taskId + '#item')
    return { position: new THREE.Vector3(...latLngToXYZ(lat, lng, R * 1.05)) }
  }, [placed.taskId])

  const item = itemById(placed.itemId)
  if (!item) return null
  return (
    <Html center distanceFactor={5} position={position}>
      <div className="text-xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>
        {item.emoji}
      </div>
    </Html>
  )
}

/** 环绕星球的小云朵（氛围组） */
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
      })),
    [],
  )
  return (
    <group ref={g}>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos as [number, number, number]}>
          <sphereGeometry args={[c.s, 10, 8]} />
          <meshStandardMaterial
            color={night ? '#8E9BC0' : '#FFFFFF'}
            transparent
            opacity={night ? 0.4 : 0.9}
            flatShading
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const trees = useMemo(() => computeTrees(tasks, monthKey), [tasks, monthKey])
  const stage = stageOfProsperity(prosperity)
  const night = theme === 'night'

  return (
    <Canvas
      camera={{ position: [0, 2.2, 6.2], fov: 42 }}
      dpr={[1, 2]}
      onPointerMissed={() => setSelectedId(null)}
    >
      <color attach="background" args={[night ? '#1B2440' : '#9FD1F5']} />
      {night && <Stars radius={40} depth={20} count={1200} factor={3} saturation={0} fade speed={0.5} />}
      <ambientLight intensity={night ? 0.45 : 0.75} color={night ? '#B9C4FF' : '#FFF4E0'} />
      <directionalLight position={[5, 4, 5]} intensity={night ? 1.1 : 1.6} color={night ? '#AAB6FF' : '#FFE9C4'} />
      {!night && <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#BFDCFF" />}
      <pointLight position={[-6, -3, -4]} intensity={broken ? 30 : night ? 18 : 6} color={broken ? '#FF5A5A' : '#7A86FF'} />

      <group>
        <PlanetSurface stage={stage} broken={broken} />
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
        autoRotate={!broken}
        autoRotateSpeed={idle ? 2.6 : 0.6}
      />
    </Canvas>
  )
}
