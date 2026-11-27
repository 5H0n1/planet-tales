import type { Task } from './types'
import { isOverdue } from './types'

/** 稳定哈希：同一任务 id 永远得到同一位置 */
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296 // 0~1
}

/** id → 球面坐标（纬度避开两极，让树长在"温带"） */
export function taskLatLng(id: string): { lat: number; lng: number } {
  return { lat: hash(id + '#lat') * 100 - 50, lng: hash(id + '#lng') * 360 - 180 }
}

export function latLngToXYZ(lat: number, lng: number, r: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ]
}

/** 确定性伪噪声（与星球表面起伏一致，供落位计算） */
function bump(v: { x: number; y: number; z: number }): number {
  return (
    Math.sin(v.x * 2.1) * Math.sin(v.y * 2.3) * Math.sin(v.z * 1.9) * 0.6 +
    Math.sin(v.x * 5.2 + v.y * 3.7) * 0.4
  )
}

/** 星球表面起伏幅度（与 PlanetScene 中几何位移同步修改） */
export const SURFACE_BUMP = 0.008

/** 某经纬度处、含地形起伏的真实表面半径（R=星球基准半径） */
export function surfaceR(lat: number, lng: number, R: number): number {
  const [x, y, z] = latLngToXYZ(lat, lng, 1)
  return R * (1 + bump({ x, y, z }) * SURFACE_BUMP)
}

/** XYZ 方向 → 经纬度 */
export function xyzToLatLng(x: number, y: number, z: number): { lat: number; lng: number } {
  const r = Math.sqrt(x * x + y * y + z * z) || 1
  const phi = Math.acos(y / r) // 0=北极
  const theta = Math.atan2(z, -x)
  let lng = (theta * 180) / Math.PI - 180
  if (lng < -180) lng += 360
  if (lng > 180) lng -= 360
  return { lat: 90 - (phi * 180) / Math.PI, lng }
}

/** 当前月份键（本地时区 YYYY-MM），月度系统的结算单位 */
export function monthKeyNow(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface TreeLike {
  id: string
  lat: number
  lng: number
  color: string
  /** 0=种子 1=大树 2=枯萎 */
  form: 0 | 1 | 2
}

/**
 * 核心映射引擎：任务列表 → 星球上应该长什么
 * 只看"本月"完成的树——每月开始时星球回到空无一物
 * 设定待办任务后星球上无任何呈现；只有"本月完成"长树、"逾期未完成"枯萎
 */
export function computeTrees(tasks: Task[], monthKey: string): TreeLike[] {
  return tasks.flatMap((t): TreeLike[] => {
    const { lat, lng } = taskLatLng(t.id)
    const doneThisMonth = t.status === 'done' && !!t.completedAt && t.completedAt.slice(0, 7) === monthKey
    if (doneThisMonth) {
      // 树颜色：按完成顺序在绿系里轮换（旧标签字段不再强制使用）
      const hue = 100 + Math.round(hash(t.id + '#hue') * 30) // 100~130 绿系
      return [{ id: t.id, lat, lng, color: `hsl(${hue}, 52%, 58%)`, form: 1 }]
    }
    if (isOverdue(t)) return [{ id: t.id, lat, lng, color: '#C9A27E', form: 2 }]
    // 待办（未逾期）任务：星球上无任何事物呈现
    return []
  })
}

export interface DayCount {
  label: string
  count: number
}

export interface PlanetStats {
  total: number
  done: number
  overdueCount: number
  streak: number
  week: DayCount[]
}

function dateOf(iso: string): string {
  return iso.slice(0, 10)
}

/** 统计引擎：近 7 天完成数 + 连续完成天数 */
export function computeStats(tasks: Task[]): PlanetStats {
  const doneTasks = tasks.filter((t) => t.status === 'done' && t.completedAt)
  const doneDates = new Set(doneTasks.map((t) => dateOf(t.completedAt!)))

  const week: DayCount[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    week.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, count: doneDates.has(key) ? 1 : 0 })
  }

  let streak = 0
  const cursor = new Date()
  if (!doneDates.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1)
  while (doneDates.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return {
    total: tasks.length,
    done: doneTasks.length,
    overdueCount: tasks.filter((t) => isOverdue(t)).length,
    streak,
    week,
  }
}
