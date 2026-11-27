import { useState } from 'react'
import { usePlanetStore } from '../store'
import { STAGE_NAMES, stageOfProsperity, isOverdue, prosperityPercent, URGENCY_LEVELS, DIFF_NAMES, COINS_BY_DIFFICULTY, difficultyOf } from '../types'
import type { Task, Urgency } from '../types'
import { playSeed, playUndo } from '../sound'
import StatsPanel from './StatsPanel'
import Warehouse from './Warehouse'
import Shop from './Shop'
import Album from './Album'
import ProofModal from './ProofModal'

function TaskRow({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const undoTask = usePlanetStore((s) => s.undoTask)
  const removeTask = usePlanetStore((s) => s.removeTask)
  const soundOn = usePlanetStore((s) => s.soundOn)
  const done = task.status === 'done'
  const overdue = isOverdue(task)
  const urgency = URGENCY_LEVELS[task.urgency]
  const diff = difficultyOf(task.dueDate, task.urgency)
  const reward = COINS_BY_DIFFICULTY[diff - 1]
  const urgencyColor = ['text-[#8A90A0]', 'text-[#E8975A]', 'text-[#E26D6D]'][task.urgency]

  return (
    <li className="group flex items-start gap-2.5 rounded-xl bg-white/70 px-3 py-2.5 transition hover:bg-white">
      <button
        onClick={() => (done ? (soundOn && playUndo(), undoTask(task.id)) : onComplete(task.id))}
        aria-label={done ? '标记为未完成' : '完成任务'}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] transition ${
          done ? 'border-[#7BC96F] bg-[#7BC96F] text-white' : 'border-[#C8CED9] bg-white hover:border-[#7BC96F]'
        }`}
      >
        {done ? '✓' : ''}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium text-[#2D3142] ${done ? 'line-through opacity-50' : ''}`}>
          <span className={`mr-1 ${urgencyColor}`} title={`紧急程度：${urgency.label}`}>
            {urgency.emoji}
          </span>
          {task.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[#8A90A0]">
          {task.dueDate && <span>截止 {task.dueDate.slice(5)}</span>}
          <span className="text-[#E8975A]" title={`完成难度：${DIFF_NAMES[diff - 1]}，奖励 ${reward} 星球币`}>
            {'★'.repeat(diff)}{'☆'.repeat(5 - diff)} +{reward}🪙
          </span>
          {overdue && <span className="font-semibold text-[#B07840]">· 已逾期 -5 繁荣度</span>}
        </p>
        {done && task.honestCompleted && (
          <p className="mt-0.5 text-[10px] text-[#B07840]">⚖️ 诚实声明完成（半额奖励）</p>
        )}
        {done && task.proof?.status === 'passed' && task.proof.reason && (
          <p className="mt-0.5 text-[10px] text-[#5FA854]">🤖 AI 审核：{task.proof.reason}</p>
        )}
      </div>
      <button
        onClick={() => removeTask(task.id)}
        aria-label="删除任务"
        title="删除任务（不影响数值）"
        className="mt-0.5 hidden shrink-0 text-[#C8CED9] transition hover:text-[#E26D6D] group-hover:block"
      >
        ✕
      </button>
    </li>
  )
}

export default function TaskPanel() {
  const tasks = usePlanetStore((s) => s.tasks)
  const planetName = usePlanetStore((s) => s.planetName)
  const soundOn = usePlanetStore((s) => s.soundOn)
  const theme = usePlanetStore((s) => s.theme)
  const prosperity = usePlanetStore((s) => s.prosperity)
  const coins = usePlanetStore((s) => s.coins)
  const monthKey = usePlanetStore((s) => s.monthKey)
  const broken = usePlanetStore(
    (s) => s.prosperity <= 0 && s.tasks.some((t) => isOverdue(t)),
  )
  const addTask = usePlanetStore((s) => s.addTask)
  const setSoundOn = usePlanetStore((s) => s.setSoundOn)
  const setTheme = usePlanetStore((s) => s.setTheme)
  const setPanelOpen = usePlanetStore((s) => s.setPanelOpen)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [urgency, setUrgency] = useState<Urgency>(0)
  const [view, setView] = useState<'tasks' | 'shop' | 'warehouse' | 'album' | 'stats'>(() => {
    const v = new URLSearchParams(window.location.search).get('view')
    return v === 'stats' || v === 'warehouse' || v === 'shop' || v === 'album' ? v : 'tasks'
  })

  const stage = stageOfProsperity(prosperity)
  const pending = tasks.filter((t) => t.status !== 'done')
  const monthLabel = `${Number(monthKey.slice(0, 4))}年${Number(monthKey.slice(5))}月`

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    if (soundOn) playSeed()
    addTask(trimmed, due || null, urgency)
    setTitle('')
    setDue('')
    setUrgency(0)
  }

  const [proofTaskId, setProofTaskId] = useState<string | null>(() => {
    // ?demo=proof 演示用：自动打开第一个待办任务的凭证审核弹窗
    if (new URLSearchParams(window.location.search).get('demo') === 'proof') {
      return tasks.find((t) => t.status !== 'done')?.id ?? null
    }
    return null
  })
  const proofTask = proofTaskId ? tasks.find((t) => t.id === proofTaskId) : undefined

  const handleComplete = (id: string) => {
    // 打开 AI 完成凭证审核弹窗，审核通过才计入完成
    setProofTaskId(id)
  }

  return (
    <aside className="pointer-events-auto relative flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-3 rounded-2xl border border-white/40 bg-white/60 p-4 shadow-2xl backdrop-blur-xl">
      {proofTask && <ProofModal task={proofTask} onClose={() => setProofTaskId(null)} />}
      <header>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-[#8A90A0]">
              {monthLabel} · {planetName}
            </p>
            <h1 className="mt-0.5 text-lg font-bold text-[#2D3142]">
              繁荣度 {prosperityPercent(prosperity)}%
              <span className="ml-2 text-sm font-semibold text-[#B07840]">🪙 {coins}</span>
            </h1>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPanelOpen(false)}
              aria-label="收起面板"
              title="收起面板，专注看星球"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-[#8A90A0] shadow-sm transition hover:bg-white hover:text-[#2D3142]"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <button
              onClick={() => setSoundOn(!soundOn)}
              aria-label="切换音效"
              title={soundOn ? '关闭音效' : '打开音效'}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm shadow-sm transition hover:bg-white"
            >
              {soundOn ? '🔊' : '🔇'}
            </button>
            <button
              onClick={() => setTheme(theme === 'night' ? 'day' : 'night')}
              aria-label="切换昼夜"
              title={theme === 'night' ? '切换到白天' : '切换到夜晚'}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm shadow-sm transition hover:bg-white"
            >
              {theme === 'night' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7BC96F] to-[#6EC6FF] transition-all duration-700"
              style={{ width: `${Math.min(100, prosperity / 10)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-[#2D3142]">{STAGE_NAMES[stage - 1]}</span>
        </div>
        {broken && (
          <p className="mt-2 rounded-lg bg-[#E26D6D]/15 px-2.5 py-1.5 text-[11px] font-semibold text-[#C94F4F]" style={{ animation: 'glowPulse 2s ease-in-out infinite' }}>
            ⚠️ 星球濒临破碎！完成逾期的任务让它复苏
          </p>
        )}
      </header>

      <nav className="flex rounded-xl bg-white/50 p-1 text-xs font-semibold">
        {(
          [
            ['tasks', '任务'],
            ['shop', '商店'],
            ['warehouse', '仓库'],
            ['album', '图鉴'],
            ['stats', '报告'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex-1 rounded-lg py-1.5 transition ${
              view === key ? 'bg-white text-[#2D3142] shadow' : 'text-[#8A90A0] hover:text-[#2D3142]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === 'tasks' && (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="写下一件要做的事…"
            className="w-full rounded-lg border border-white/70 bg-white/80 px-3 py-2 text-sm text-[#2D3142] outline-none placeholder:text-[#A6ACBC] focus:border-[#7BC96F]"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-white/70 bg-white/80 px-2 py-1.5 text-xs text-[#2D3142] outline-none"
            />
            <button
              onClick={submit}
              className="rounded-lg bg-[#7BC96F] px-4 py-1.5 text-xs font-bold text-white shadow transition hover:bg-[#6AB75E]"
            >
              种下
            </button>
          </div>

          {/* 紧急程度（三级，影响完成难度与星球币奖励） */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#8A90A0]">紧急程度</span>
            <div className="flex flex-1 gap-1">
              {URGENCY_LEVELS.map((u, i) => (
                <button
                  key={u.label}
                  onClick={() => setUrgency(i as Urgency)}
                  className={`flex-1 rounded-lg py-1 text-[11px] font-semibold transition ${
                    urgency === i
                      ? 'bg-[#E8975A]/20 text-[#B07840] ring-1 ring-[#E8975A]'
                      : 'bg-white/60 text-[#8A90A0] hover:bg-white'
                  }`}
                >
                  {u.emoji} {u.label}
                </button>
              ))}
            </div>
          </div>
          <p className="-mt-1 text-[10px] text-[#A6ACBC]">
            时间越紧、越紧急，完成难度越高，星球币越多（{DIFF_NAMES.join('/')}）
          </p>

          <ul className="flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: '38vh' }}>
            {[...pending, ...tasks.filter((t) => t.status === 'done')].map((t) => (
              <TaskRow key={t.id} task={t} onComplete={handleComplete} />
            ))}
            {tasks.length === 0 && (
              <li className="rounded-xl bg-white/60 px-3 py-6 text-center text-xs text-[#8A90A0]">
                星球还很荒芜，种下第一个任务吧 🌱
              </li>
            )}
          </ul>

          <p className="text-center text-[11px] text-[#8A90A0]">
            完成需上传凭证并通过 AI 审核 · 每月 1 日重置
          </p>
        </>
      )}
      {view === 'shop' && <Shop />}
      {view === 'warehouse' && <Warehouse />}
      {view === 'album' && <Album />}
      {view === 'stats' && <StatsPanel />}
    </aside>
  )
}
