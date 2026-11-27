import { useEffect, useState } from 'react'
import PlanetScene from './components/PlanetScene'
import TaskPanel from './components/TaskPanel'
import Landing from './components/Landing'
import { useIdle } from './hooks/useIdle'
import { usePlanetStore } from './store'
import { isOverdue } from './types'

export default function App() {
  const entered = usePlanetStore((s) => s.entered)
  const panelOpen = usePlanetStore((s) => s.panelOpen)
  const setPanelOpen = usePlanetStore((s) => s.setPanelOpen)
  const pendingCount = usePlanetStore((s) => s.tasks.filter((t) => t.status !== 'done').length)
  const placingItemId = usePlanetStore((s) => s.placingItemId)
  const broken = usePlanetStore((s) => s.prosperity <= 0 && s.tasks.some((t) => isOverdue(t)))
  const [landingGone, setLandingGone] = useState(false)
  const idle = useIdle(30000)
  const idleNow = idle && entered // 主页阶段不进入待机
  const uiHidden = idleNow || !entered
  const showPanel = entered && !idleNow && panelOpen
  const showTab = entered && !idleNow && !panelOpen

  // 周期性结算逾期惩罚（捕获"刚刚逾期"的瞬间，每月每件任务只扣一次）
  useEffect(() => {
    const t = window.setInterval(() => usePlanetStore.getState().penalizeOverdue(), 30000)
    return () => window.clearInterval(t)
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#1B2440]">
      <div className="absolute inset-0">
        <PlanetScene idle={idleNow} broken={entered && broken} />
      </div>

      {!landingGone && <Landing visible={!entered} onExited={() => setLandingGone(true)} />}

      {/* 破碎警告：红色脉冲视效边缘 */}
      <div
        className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-1000 ${
          entered && broken ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ boxShadow: 'inset 0 0 120px 30px rgba(226, 90, 90, 0.45)', animation: entered && broken ? 'glowPulse 2s ease-in-out infinite' : undefined }}
      />

      {/* 任务面板：收起 / 待机 / 主页时平滑淡出 */}
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center p-4 transition-all duration-500 ${
          showPanel ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
        }`}
      >
        <TaskPanel />
      </div>

      {/* 收起后的侧边标签：点击唤回面板 */}
      <div
        className={`absolute top-1/2 right-0 z-10 -translate-y-1/2 transition-all duration-500 ${
          showTab ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0'
        }`}
      >
        <button
          onClick={() => setPanelOpen(true)}
          aria-label="展开任务面板"
          className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-l-2xl border-y border-l border-white/40 bg-white/60 py-4 pr-2.5 pl-2 shadow-xl backdrop-blur-xl transition hover:bg-white/80"
        >
          <span className="text-sm">🌿</span>
          <span className="text-[11px] font-semibold tracking-widest text-[#2D3142]" style={{ writingMode: 'vertical-rl' }}>
            任务清单
          </span>
          {pendingCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E8975A] px-1 text-[10px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* 破碎警告横幅 */}
      <div
        className={`pointer-events-none absolute top-5 left-1/2 z-30 -translate-x-1/2 transition-all duration-1000 ${
          entered && broken ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
      >
        <div
          className="rounded-full bg-[#E26D6D]/90 px-5 py-2 text-xs font-bold whitespace-nowrap text-white shadow-lg backdrop-blur"
          style={{ animation: 'glowPulse 2s ease-in-out infinite' }}
        >
          ⚠️ 星球濒临破碎 —— 有任务逾期未完成，繁荣度已归零
        </div>
      </div>

      {/* 操作提示 ↔ 放置提示 ↔ 待机提示，交叉淡入淡出 */}
      <div
        className={`pointer-events-none absolute bottom-4 left-4 z-10 rounded-full bg-black/25 px-4 py-1.5 text-[11px] backdrop-blur transition-all duration-1000 ${
          uiHidden || placingItemId ? 'opacity-0' : 'text-white/70 opacity-100'
        }`}
      >
        拖拽旋转 · 滚轮缩放 · 点击树木查看任务
      </div>
      <div
        className={`pointer-events-none absolute bottom-4 left-4 z-10 rounded-full bg-[#7BC96F]/85 px-4 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition-all duration-500 ${
          placingItemId && !uiHidden ? 'opacity-100' : 'opacity-0'
        }`}
      >
        📍 移动选择落点 · 点击放置 · Esc / 点空白取消
      </div>
      <div
        className={`pointer-events-none absolute bottom-4 left-4 z-10 rounded-full bg-black/25 px-4 py-1.5 text-[11px] backdrop-blur transition-all duration-1000 ${
          idleNow ? 'text-white/60 opacity-100' : 'opacity-0'
        }`}
      >
        🌙 待机中 · 动一动鼠标回到星球
      </div>
    </div>
  )
}
