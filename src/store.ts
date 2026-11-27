import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, Urgency } from './types'
import { ALBUM_ENTRIES, ALL_ITEMS, COINS_BY_DIFFICULTY, OVERDUE_PENALTY, PROSPERITY_MAX, SHOP_STOCK, difficultyOf } from './types'
import { monthKeyNow } from './engine'

function today(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

/** 首次打开时的示例任务：让星球一出生就有故事（本月完成 3 件，无逾期） */
function seedTasks(): Task[] {
  const mk = (id: string, title: string, status: Task['status'], dueOffset: number, doneDaysAgo: number | null, urgency: Urgency = 0): Task => ({
    id,
    title,
    tag: '',
    dueDate: today(dueOffset),
    urgency,
    status,
    completedAt: doneDaysAgo === null ? null : today(-doneDaysAgo),
    penaltyMonth: null,
  })
  return [
    mk('seed-1', '完成开题报告', 'done', -3, 2, 1),
    mk('seed-2', '跑步 3 公里', 'done', -1, 1, 0),
    mk('seed-3', '整理毕设资料', 'done', 0, 0, 0),
    mk('seed-4', '读一章《设计心理学》', 'pending', 2, null, 0),
    mk('seed-5', '给导师发进度邮件', 'pending', 1, null, 2),
  ]
}

export interface PlacedItem {
  taskId: string
  itemId: string
  /** 自由放置的坐标（未设置时退回哈希派生位置） */
  lat?: number
  lng?: number
}

/** 月度统计记录：归档月份与当前月共用 */
export interface MonthRecord {
  /** 月末繁荣度（点） */
  prosperity: number
  /** 本月完成任务数 */
  done: number
  /** 本月赚取星球币 */
  coins: number
  /** 本月放置物品数 */
  placed: number
}

const EMPTY_MONTH: MonthRecord = { prosperity: 0, done: 0, coins: 0, placed: 0 }

interface PlanetState {
  planetName: string
  entered: boolean
  panelOpen: boolean
  tasks: Task[]
  /** 月度系统：当前月份键、本月繁荣度（0~1000，1000=100%）、本月放置物 */
  monthKey: string
  prosperity: number
  placedItems: PlacedItem[]
  /** 每月归档：月份键 → 该月完整统计（日历与月度统计用） */
  monthHistory: Record<string, MonthRecord>
  /** 本月实时统计（跨月时归档进 monthHistory 并清零） */
  monthStats: MonthRecord
  /** 星球币：完成任务的奖励（按难度），商店消费 */
  coins: number
  /** 仓库：用户拥有的物品及数量（购买/图鉴奖励进入这里） */
  inventory: Record<string, number>
  /** 已解锁（已领取奖励）的图鉴条目 */
  albumClaimed: string[]
  /** 演示模式：强制 AI 审核走本地模拟结果（答辩不依赖外部 API） */
  forceMockAI: boolean
  /** 自由放置模式：非空时显示网格辅助线，点击星球表面选择落点 */
  placingItemId: string | null
  soundOn: boolean
  theme: 'day' | 'night'
  addTask: (title: string, dueDate: string | null, urgency: Urgency) => void
  completeTask: (id: string, half?: boolean) => void
  /** 提交完成凭证：进入 AI 审核中状态 */
  submitProof: (id: string, image: string) => void
  /** AI 审核结果落库：通过则完成并发放星球币 */
  resolveProof: (id: string, passed: boolean, reason: string) => void
  /** 诚实声明：3 次审核未过后手动完成，半额奖励 */
  honestComplete: (id: string) => void
  undoTask: (id: string) => void
  removeTask: (id: string) => void
  penalizeOverdue: () => void
  buyItem: (itemId: string) => void
  /** 自由放置：在星球上点选位置后落位（lat/lng 为可选坐标） */
  placeItemAt: (itemId: string, lat?: number, lng?: number) => void
  setPlacingItem: (itemId: string | null) => void
  setSoundOn: (on: boolean) => void
  setTheme: (t: 'day' | 'night') => void
  setPlanetName: (name: string) => void
  setEntered: (v: boolean) => void
  setPanelOpen: (v: boolean) => void
}

/** 图鉴结算：繁荣度达成阈值的条目自动解锁并发放奖励 */
function settleAlbum(s: Pick<PlanetState, 'prosperity' | 'albumClaimed' | 'inventory' | 'coins'>) {
  const inventory = { ...s.inventory }
  let coins = s.coins
  const claimed = [...s.albumClaimed]
  let changed = false
  for (const entry of ALBUM_ENTRIES) {
    if (s.prosperity >= entry.threshold && !claimed.includes(entry.id)) {
      claimed.push(entry.id)
      inventory[entry.reward.id] = (inventory[entry.reward.id] ?? 0) + 1
      coins += entry.coins
      changed = true
    }
  }
  return changed ? { albumClaimed: claimed, inventory, coins } : {}
}

export const usePlanetStore = create<PlanetState>()(
  persist(
    (set) => ({
      planetName: '小绿的星球',
      entered: false,
      panelOpen: true,
      tasks: seedTasks(),
      monthKey: monthKeyNow(),
      prosperity: 0,
      placedItems: [],
      monthHistory: {},
      monthStats: { ...EMPTY_MONTH },
      coins: 30,
      inventory: { flower: 2 },
      albumClaimed: [],
      forceMockAI: false,
      soundOn: true,
      theme: 'night',

      addTask: (title, dueDate, urgency) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              title,
              tag: '',
              dueDate,
              urgency,
              status: 'pending',
              completedAt: null,
              penaltyMonth: null,
            },
          ],
        })),

      // 完成：星球币按完成难度发放（越紧急、时间越紧，奖励越多）；half 为诚实声明半额
      completeTask: (id, half = false) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id)
          if (!task || task.status === 'done') return s
          const full = COINS_BY_DIFFICULTY[difficultyOf(task.dueDate, task.urgency) - 1]
          const reward = half ? Math.ceil(full / 2) : full
          return {
            coins: s.coins + reward,
            monthStats: { ...s.monthStats, done: s.monthStats.done + 1, coins: s.monthStats.coins + reward },
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, status: 'done' as const, completedAt: new Date().toISOString() } : t,
            ),
          }
        }),

      // 提交凭证：图片入库存为审核中
      submitProof: (id, image) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, proof: { image, status: 'pending' as const, reason: '', retries: (t.proof?.retries ?? 0) + 1 } }
              : t,
          ),
        })),

      // AI 审核结果：通过 → 完成 + 评语；不通过 → 记录原因，可重试
      resolveProof: (id, passed, reason) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id)
          if (!task || task.status === 'done') return s
          const proof = task.proof ? { ...task.proof, status: passed ? ('passed' as const) : ('failed' as const), reason } : undefined
          if (!passed) return { tasks: s.tasks.map((t) => (t.id === id ? { ...t, proof } : t)) }
          const full = COINS_BY_DIFFICULTY[difficultyOf(task.dueDate, task.urgency) - 1]
          return {
            coins: s.coins + full,
            monthStats: { ...s.monthStats, done: s.monthStats.done + 1, coins: s.monthStats.coins + full },
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, status: 'done' as const, completedAt: new Date().toISOString(), proof } : t,
            ),
          }
        }),

      // 诚实声明：审核 3 次未过后手动完成，半额奖励
      honestComplete: (id) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id)
          if (!task || task.status === 'done') return s
          const full = COINS_BY_DIFFICULTY[difficultyOf(task.dueDate, task.urgency) - 1]
          const reward = Math.ceil(full / 2)
          return {
            coins: s.coins + reward,
            monthStats: { ...s.monthStats, done: s.monthStats.done + 1, coins: s.monthStats.coins + reward },
            tasks: s.tasks.map((t) =>
              t.id === id
                ? { ...t, status: 'done' as const, completedAt: new Date().toISOString(), honestCompleted: true }
                : t,
            ),
          }
        }),

      // 撤销完成：币与繁荣度均不回退，同时清除凭证记录
      undoTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t
            const { proof: _p, honestCompleted: _h, ...rest } = t
            return { ...rest, status: 'pending' as const, completedAt: null }
          }),
        })),

      // 删除任务：不影响任何数值
      removeTask: (id) =>
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          placedItems: s.placedItems.filter((p) => p.taskId !== id),
        })),

      penalizeOverdue: () =>
        set((s) => {
          let p = s.prosperity
          const tasks = s.tasks.map((t) => {
            const overdue =
              t.status === 'pending' &&
              !!t.dueDate &&
              new Date(t.dueDate + 'T23:59:59') < new Date()
            if (overdue && t.penaltyMonth !== s.monthKey) {
              p = Math.max(0, p - OVERDUE_PENALTY)
              return { ...t, penaltyMonth: s.monthKey }
            }
            return t
          })
          return { tasks, prosperity: p, ...settleAlbum({ ...s, prosperity: p }) }
        }),

      // 商店购买：花星球币，物品进仓库
      buyItem: (itemId) =>
        set((s) => {
          const stock = SHOP_STOCK.find((i) => i.id === itemId)
          if (!stock || s.coins < stock.price) return s
          return {
            coins: s.coins - stock.price,
            inventory: { ...s.inventory, [itemId]: (s.inventory[itemId] ?? 0) + 1 },
          }
        }),

      // 自由放置：从仓库消耗 1 件物品摆到星球上，坐标由用户在星球上点选，增加繁荣度（封顶 1000），并结算图鉴
      placeItemAt: (itemId, lat, lng) =>
        set((s) => {
          if ((s.inventory[itemId] ?? 0) <= 0) return s
          if (s.prosperity >= PROSPERITY_MAX) return s
          const item = SHOP_STOCK.find((i) => i.id === itemId) ??
            ALBUM_ENTRIES.map((e) => e.reward).find((i) => i.id === itemId)
          if (!item) return s
          const prosperity = Math.min(PROSPERITY_MAX, s.prosperity + item.bonus)
          const inventory = { ...s.inventory, [itemId]: s.inventory[itemId] - 1 }
          return {
            placedItems: [...s.placedItems, { taskId: `manual-${Date.now()}-${itemId}`, itemId, lat, lng }],
            prosperity,
            inventory,
            monthStats: { ...s.monthStats, placed: s.monthStats.placed + 1 },
            ...settleAlbum({ ...s, prosperity, inventory }),
          }
        }),

      placingItemId: null,
      setPlacingItem: (itemId) => set({ placingItemId: itemId }),
      setSoundOn: (on) => set({ soundOn: on }),
      setTheme: (t) => set({ theme: t }),
      setPlanetName: (name) => set({ planetName: name }),
      setEntered: (v) => set({ entered: v }),
      setPanelOpen: (v) => set({ panelOpen: v }),
    }),
    {
      name: 'planet-tales-v4',
      version: 4,
      migrate: (persisted) => {
        const s = persisted as any
        // v3 → v4：任务补 urgency 字段；monthHistory 从纯数字升级为完整月度统计
        s.tasks = (s.tasks ?? []).map((t: any) => ({ urgency: 0, ...t }))
        const hist: Record<string, MonthRecord> = {}
        for (const [k, v] of Object.entries(s.monthHistory ?? {})) {
          hist[k] = typeof v === 'number' ? { ...EMPTY_MONTH, prosperity: v as number } : (v as MonthRecord)
        }
        s.monthHistory = hist
        s.monthStats = { ...EMPTY_MONTH, ...(s.monthStats ?? {}) }
        return s
      },
    },
  ),
)

// ===== 启动时结算 =====
const nowMonth = monthKeyNow()
const st = usePlanetStore.getState()

// 跨月：归档上月完整统计 → 繁荣度归零、星球清空（仓库/图鉴/币保留，任务保留）
if (st.monthKey !== nowMonth) {
  usePlanetStore.setState({
    monthHistory: { ...st.monthHistory, [st.monthKey]: { ...st.monthStats, prosperity: st.prosperity } },
    monthKey: nowMonth,
    prosperity: 0,
    placedItems: [],
    monthStats: { ...EMPTY_MONTH },
  })
}

// 立即结算一次逾期惩罚，并周期性结算（捕获"刚刚逾期"的瞬间）
usePlanetStore.getState().penalizeOverdue()

// 支持 URL 参数直达：?theme=day / ?theme=night（方便演示与分享）
// ?skipLanding=1 直接进入主界面；?panel=0 收起面板
// ?view=stats|shop|warehouse|album 直达对应模块；?demo=broken 演示破碎状态
const params = new URLSearchParams(window.location.search)
const urlTheme = params.get('theme')
if (urlTheme === 'day' || urlTheme === 'night') {
  usePlanetStore.setState({ theme: urlTheme })
}
if (params.get('skipLanding')) {
  usePlanetStore.setState({ entered: true })
}
if (params.get('panel') === '0') {
  usePlanetStore.setState({ panelOpen: false })
}
// ?place=<itemId> 直达放置模式（演示网格辅助线用）
const urlPlace = params.get('place')
if (urlPlace) {
  usePlanetStore.setState({ placingItemId: urlPlace })
}
if (params.get('demo') === 'mock') {
  usePlanetStore.setState({ forceMockAI: true })
}
// ?demo=allitems 调试模式：全部物品已解锁，每件可放置 3 个
if (params.get('demo') === 'allitems') {
  const allInventory: Record<string, number> = {}
  for (const it of ALL_ITEMS) allInventory[it.id] = 3
  usePlanetStore.setState({
    inventory: allInventory,
    coins: 999,
    prosperity: 0,
  })
}
// ?demo=maxprosperity 调试模式：繁荣度拉满 100%，一键结算图鉴奖励
if (params.get('demo') === 'maxprosperity') {
  const s = usePlanetStore.getState()
  const prosperity = PROSPERITY_MAX
  usePlanetStore.setState({
    prosperity,
    ...settleAlbum({ ...s, prosperity }),
  })
}
// ?demo=showcase 满配星球：11 件装饰全部摆上星球（答辩封面图用）
if (params.get('demo') === 'showcase') {
  const SHOWCASE: Array<[string, number, number]> = [
    // [itemId, lat, lng] 均匀铺满朝向镜头的半球
    ['castle',   35, -90],
    ['rainbow',   8, -95],
    ['dragon',  -22, -85],
    ['sun',      48, -125],
    ['aurora',   42, -55],
    ['meteor',  -38, -120],
    ['moon',    -35, -60],
    ['crystal',  15, -140],
    ['windmill', -8, -50],
    ['lantern',  -5, -128],
    ['flower',   22, -65],
  ]
  const placedItems = SHOWCASE.map(([itemId, lat, lng], i) => ({
    taskId: `showcase-${i}-${itemId}`,
    itemId,
    lat,
    lng,
  }))
  const s = usePlanetStore.getState()
  usePlanetStore.setState({
    placedItems,
    prosperity: PROSPERITY_MAX,
    ...settleAlbum({ ...s, prosperity: PROSPERITY_MAX }),
  })
}
if (params.get('demo') === 'broken') {
  usePlanetStore.setState({
    prosperity: 0,
    tasks: [
      ...usePlanetStore.getState().tasks,
      {
        id: 'demo-broken-1',
        title: '逾期的演示任务',
        tag: '',
        dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        urgency: 2,
        status: 'pending',
        completedAt: null,
        penaltyMonth: null,
      },
    ],
  })
  usePlanetStore.getState().penalizeOverdue()
}
