import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/** 所有镜面 GLB 资产 id（public/models/<id>.glb） */
export const MODEL_IDS = [
  'planet', 'seed', 'tree', 'dead',
  'flower', 'lantern', 'windmill', 'rainbow', 'crystal', 'meteor',
  'moon', 'castle', 'dragon', 'aurora', 'sun',
] as const

const urlOf = (id: string) => `${import.meta.env.BASE_URL}models/${id}.glb`

/** 加载 GLB 并归一化到目标高度 */
function GlbModel({ id, targetHeight = 0.55 }: { id: string; targetHeight?: number }) {
  const gltf = useGLTF(urlOf(id))
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true)
    const box = new THREE.Box3().setFromObject(o)
    const h = box.max.y - box.min.y
    const s = h > 1e-4 ? targetHeight / h : 1
    o.scale.setScalar(s)
    // 落地：最低点贴 y=0
    const b2 = new THREE.Box3().setFromObject(o)
    o.position.y -= b2.min.y
    return o
  }, [gltf, targetHeight])
  return <primitive object={obj} />
}

class GlbBoundary extends Component<
  { id: string; targetHeight?: number; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return this.props.fallback
    return <GlbModel id={this.props.id} targetHeight={this.props.targetHeight} />
  }
}

/** GLB 插槽：加载中/失败都优雅回退到 fallback */
export function GlbSlot({
  id,
  targetHeight,
  fallback,
}: {
  id: string
  targetHeight?: number
  fallback: ReactNode
}) {
  return (
    <Suspense fallback={fallback}>
      <GlbBoundary id={id} targetHeight={targetHeight} fallback={fallback} />
    </Suspense>
  )
}

// 预加载全部模型
MODEL_IDS.forEach((id) => useGLTF.preload(urlOf(id)))
