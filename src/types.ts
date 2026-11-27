export type TaskStatus = 'pending' | 'done'

/** 事件紧急程度（用户自定义，三级） */
export type Urgency = 0 | 1 | 2
export const URGENCY_LEVELS = [
  { label: '普通', emoji: '🌱' },
  { label: '紧急', emoji: '⚡' },
  { label: '特急', emoji: '🔥' },
] as const

/** AI 完成凭证的审核状态 */
export type VerifyStatus = 'pending' | 'passed' | 'failed'

/** 完成凭证：用户上传的图片 + AI 审核结果 */
export interface Proof {
  /** base64 图片（不带 data: 前缀，压缩后的 JPEG） */
  image: string
  status: VerifyStatus
  /** AI 评语（通过理由或不通过原因） */
  reason: string
  /** 已提交审核的次数（用于诚实声明保底） */
  retries: number
}

export interface Task {
  id: string
  title: string
  /** 历史字段（旧版本遗留），新任务不再强制分类 */
  tag: string
  dueDate: string | null
  /** 紧急程度：0 普通 / 1 紧急 / 2 特急 */
  urgency: Urgency
  status: TaskStatus
  completedAt: string | null
  /** 已因逾期扣除繁荣度的月份（YYYY-MM），每月只扣一次 */
  penaltyMonth: string | null
  /** AI 完成凭证（提交过审核才存在） */
  proof?: Proof
  /** 诚实声明完成（3 次审核未过后手动确认，半额奖励） */
  honestCompleted?: boolean
}

/** ===== 经济系统常量 ===== */
export const PROSPERITY_MAX = 1000 // 繁荣度上限 = 100%
export const OVERDUE_PENALTY = 5 // 逾期繁荣度惩罚（点）

export function prosperityPercent(p: number): number {
  return Math.round((p / PROSPERITY_MAX) * 100)
}

/** 完成难度（1-5 级）：完成时间越紧、紧急程度越高，难度越大 */
export const DIFF_NAMES = ['简单', '普通', '困难', '艰难', '史诗']
export const COINS_BY_DIFFICULTY = [6, 10, 15, 22, 30] // 各难度完成奖励（星球币）

export function difficultyOf(dueDate: string | null, urgency: Urgency): number {
  let base = 0
  if (dueDate) {
    const days = Math.ceil((new Date(dueDate + 'T23:59:59').getTime() - Date.now()) / 86400000)
    base = days <= 1 ? 3 : days <= 3 ? 2 : days <= 7 ? 1 : 0
  }
  return Math.min(5, Math.max(1, base + urgency + 1))
}

/** 繁荣度阶段阈值（点）：0 / >0 / 300 / 600 / 1000 */
export const STAGE_NAMES = ['荒芜之星', '萌芽之星', '葱郁之星', '繁华之星', '璀璨之星']

export function stageOfProsperity(p: number): number {
  if (p >= 1000) return 5
  if (p >= 600) return 4
  if (p >= 300) return 3
  if (p > 0) return 2
  return 1
}

/** 星球地表颜色随阶段从土黄渐变到葱绿 */
export function planetColorByStage(stage: number): string {
  const stops = ['#B99B6B', '#A8AC62', '#8DBD68', '#7BC96F', '#5FC46B']
  return stops[Math.max(0, stage - 1)]
}

/** 任务是否逾期（实时派生，不存库） */
export function isOverdue(task: Task): boolean {
  if (task.status === 'done' || !task.dueDate) return false
  return new Date(task.dueDate + 'T23:59:59') < new Date()
}

/** ===== 可放置物品 ===== */
export interface Item {
  id: string
  name: string
  emoji: string
  /** 放置后增加的繁荣度（点） */
  bonus: number
}

/** 商店货架：用星球币购买（购买后进入仓库） */
export interface ShopItem extends Item {
  price: number
}

export const SHOP_STOCK: ShopItem[] = [
  { id: 'flower', name: '小花丛', emoji: '🌷', bonus: 2, price: 10 },
  { id: 'lantern', name: '小灯笼', emoji: '🏮', bonus: 4, price: 30 },
  { id: 'windmill', name: '小风车', emoji: '🎡', bonus: 6, price: 60 },
  { id: 'rainbow', name: '彩虹桥', emoji: '🌈', bonus: 10, price: 100 },
  { id: 'crystal', name: '水晶塔', emoji: '💎', bonus: 15, price: 160 },
  { id: 'meteor', name: '许愿流星', emoji: '🌠', bonus: 25, price: 240 },
]

/** 图鉴：繁荣度达成阈值自动解锁，奖励专属物品 + 星球币 */
export interface AlbumEntry {
  id: string
  /** 解锁所需繁荣度（点） */
  threshold: number
  title: string
  desc: string
  reward: Item
  coins: number
}

export const ALBUM_ENTRIES: AlbumEntry[] = [
  { id: 'a10', threshold: 100, title: '初绽之月', desc: '繁荣度达到 10%', reward: { id: 'moon', name: '月牙泉', emoji: '🌙', bonus: 3 }, coins: 20 },
  { id: 'a30', threshold: 300, title: '绿意蔓延', desc: '繁荣度达到 30%', reward: { id: 'castle', name: '云端城堡', emoji: '🏰', bonus: 8 }, coins: 50 },
  { id: 'a50', threshold: 500, title: '生命涌动', desc: '繁荣度达到 50%', reward: { id: 'dragon', name: '星光幼龙', emoji: '🐉', bonus: 14 }, coins: 100 },
  { id: 'a70', threshold: 700, title: '极光之夜', desc: '繁荣度达到 70%', reward: { id: 'aurora', name: '极光帷幕', emoji: '🌌', bonus: 20 }, coins: 200 },
  { id: 'a100', threshold: 1000, title: '永恒璀璨', desc: '繁荣度达到 100%', reward: { id: 'sun', name: '永恒之日', emoji: '☀️', bonus: 40 }, coins: 500 },
]

export const ALL_ITEMS: Item[] = [...SHOP_STOCK, ...ALBUM_ENTRIES.map((e) => e.reward)]

export function itemById(id: string): Item | undefined {
  return ALL_ITEMS.find((i) => i.id === id)
}
