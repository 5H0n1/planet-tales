import { useMemo } from 'react'
import { computeStats } from '../engine'
import { usePlanetStore } from '../store'
import { STAGE_NAMES, stageOfProsperity, itemById, prosperityPercent, PROSPERITY_MAX } from '../types'

export default function StatsPanel() {
  const tasks = usePlanetStore((s) => s.tasks)
  const prosperity = usePlanetStore((s) => s.prosperity)
  const placedItems = usePlanetStore((s) => s.placedItems)
  const monthKey = usePlanetStore((s) => s.monthKey)
  const monthHistory = usePlanetStore((s) => s.monthHistory)
  const monthStats = usePlanetStore((s) => s.monthStats)
  const stats = useMemo(() => computeStats(tasks), [tasks])
  const stage = stageOfProsperity(prosperity)
  const maxWeek = Math.max(1, ...stats.week.map((d) => d.count))

  // 本月放置物品分布
  const itemDist = useMemo(() => {
    const map = new Map<string, number>()
    placedItems.forEach((p) => map.set(p.itemId, (map.get(p.itemId) ?? 0) + 1))
    return [...map.entries()]
      .map(([id, count]) => ({ item: itemById(id), count }))
      .filter((d) => d.item)
  }, [placedItems])
  const maxItem = Math.max(1, ...itemDist.map((d) => d.count))
  const monthLabel = `${Number(monthKey.slice(0, 4))}年${Number(monthKey.slice(5))}月`

  // 年度月度繁荣度：当前年 12 个月，历史月取归档值，当前月取实时值
  const year = monthKey.slice(0, 4)
  const months = useMemo(() => {
    const valueOf = (key: string): number | null =>
      key === monthKey ? prosperity : (monthHistory[key]?.prosperity ?? null)
    const best = Math.max(0, ...Array.from({ length: 12 }, (_, i) => valueOf(`${year}-${String(i + 1).padStart(2, '0')}`) ?? 0))
    return Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`
      const v = valueOf(key)
      return { key, label: i + 1, value: v, isCurrent: key === monthKey, isBest: (v ?? 0) > 0 && v === best }
    })
  }, [monthHistory, monthKey, prosperity, year])

  // 月度统计明细：历史归档月 + 当前月（实时）
  const monthRows = useMemo(() => {
    const rows = Object.entries(monthHistory)
      .filter(([k]) => k.startsWith(year))
      .map(([k, r]) => ({ key: k, rec: r, isCurrent: false }))
    rows.push({ key: monthKey, rec: { ...monthStats, prosperity }, isCurrent: true })
    return rows.sort((a, b) => b.key.localeCompare(a.key))
  }, [monthHistory, monthStats, prosperity, monthKey, year])

  return (
    <div className="flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: '52vh' }}>
      {/* 本月繁荣度 */}
      <section className="flex items-center gap-4 rounded-xl bg-white/70 p-4">
        <div
          className="relative h-20 w-20 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(#7BC96F ${Math.min(100, prosperity / 10) * 3.6}deg, #E4E8F0 0deg)`,
          }}
        >
          <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-lg font-bold text-[#2D3142]">{prosperityPercent(prosperity)}%</span>
            <span className="text-[10px] text-[#8A90A0]">{prosperity} / {PROSPERITY_MAX}</span>
          </div>
        </div>
        <div className="text-sm">
          <p className="font-bold text-[#2D3142]">
            {monthLabel} · {STAGE_NAMES[stage - 1]}
          </p>
          <p className="mt-1 text-[#8A90A0]">
            完成 {stats.done} 件 · 待办 {stats.total - stats.done} 件
          </p>
          <p className="mt-0.5 text-[#8A90A0]">
            {stats.overdueCount > 0 ? (
              <span className="font-semibold text-[#B07840]">{stats.overdueCount} 件逾期（-5 繁荣度/件/月）</span>
            ) : (
              '没有逾期，星球很健康'
            )}
          </p>
        </div>
      </section>

      {/* 近 7 天完成数 */}
      <section className="rounded-xl bg-white/70 p-4">
        <h3 className="mb-3 text-xs font-bold tracking-wider text-[#8A90A0]">近 7 天完成数</h3>
        <div className="flex h-24 items-end justify-between gap-1.5">
          {stats.week.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-[#8A90A0]">{d.count || ''}</span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-[#7BC96F] to-[#A5E29B] transition-all duration-500"
                style={{ height: `${Math.max(6, (d.count / maxWeek) * 72)}px`, opacity: d.count ? 1 : 0.25 }}
              />
              <span className={`text-[10px] ${i === 6 ? 'font-bold text-[#2D3142]' : 'text-[#A6ACBC]'}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 连续完成 + 本月放置 */}
      <section className="rounded-xl bg-white/70 p-4">
        <h3 className="mb-2 text-xs font-bold tracking-wider text-[#8A90A0]">本月星球装扮</h3>
        <p className="mb-3 text-sm text-[#2D3142]">
          🔥 已连续完成 <span className="text-base font-bold text-[#E8975A]">{stats.streak}</span> 天
        </p>
        {itemDist.length === 0 ? (
          <p className="text-xs text-[#A6ACBC]">本月还没有放置物品，去仓库亲手放置一件吧</p>
        ) : (
          <div className="flex flex-col gap-2">
            {itemDist.map((d) => (
              <div key={d.item!.id} className="flex items-center gap-2 text-xs">
                <span className="w-12 shrink-0 font-medium text-[#2D3142]">
                  {d.item!.emoji} {d.item!.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F6]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#FFD66B] to-[#7BC96F] transition-all duration-500"
                    style={{ width: `${(d.count / maxItem) * 100}%` }}
                  />
                </div>
                <span className="w-4 shrink-0 text-right font-semibold text-[#8A90A0]">{d.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      {/* 月度繁荣度日历 */}
      <section className="rounded-xl bg-white/70 p-4">
        <h3 className="mb-3 text-xs font-bold tracking-wider text-[#8A90A0]">
          {year} 年月度繁荣度
        </h3>
        <div className="grid grid-cols-4 gap-1.5">
          {months.map((m) => (
            <div
              key={m.key}
              className={`flex flex-col items-center rounded-lg px-1 py-1.5 ${
                m.isCurrent
                  ? 'bg-[#7BC96F]/15 ring-1 ring-[#7BC96F]'
                  : m.value !== null
                    ? 'bg-[#EEF1F6]'
                    : 'bg-[#F6F8FB] opacity-60'
              }`}
            >
              <span className={`text-[10px] ${m.isCurrent ? 'font-bold text-[#7BC96F]' : 'text-[#A6ACBC]'}`}>
                {m.label}月{m.isCurrent ? ' · 进行中' : ''}
              </span>
              {m.value !== null ? (
                <>
                  <span className="text-xs font-bold text-[#2D3142]">
                    {m.value}
                    {m.isBest && <span className="ml-0.5">⭐</span>}
                  </span>
                  <span className="text-[9px] text-[#8A90A0]">{prosperityPercent(m.value)}%</span>
                </>
              ) : (
                <span className="text-[10px] text-[#C3C9D6]">—</span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-[#A6ACBC]">每月 1 日繁荣度清零重新积攒，⭐ 为该年最佳月份</p>
      </section>

      {/* 月度统计明细 */}
      <section className="rounded-xl bg-white/70 p-4">
        <h3 className="mb-3 text-xs font-bold tracking-wider text-[#8A90A0]">
          {year} 年月度统计
        </h3>
        <div className="flex flex-col gap-1.5">
          {monthRows.map(({ key, rec, isCurrent }) => (
            <div
              key={key}
              className={`rounded-lg px-2.5 py-2 text-[11px] ${
                isCurrent ? 'bg-[#7BC96F]/10 ring-1 ring-[#7BC96F]/60' : 'bg-[#F6F8FB]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-bold ${isCurrent ? 'text-[#5FA854]' : 'text-[#2D3142]'}`}>
                  {Number(key.slice(5))}月{isCurrent ? ' · 进行中' : ''}
                </span>
                <span className="font-semibold text-[#2D3142]">
                  繁荣度 {rec.prosperity}（{prosperityPercent(rec.prosperity)}%）
                </span>
              </div>
              <div className="mt-1 flex gap-3 text-[#8A90A0]">
                <span>✅ 完成 {rec.done} 件</span>
                <span>🪙 赚取 {rec.coins}</span>
                <span>🌷 放置 {rec.placed} 件</span>
              </div>
            </div>
          ))}
          {monthRows.length === 0 && (
            <p className="text-xs text-[#A6ACBC]">暂无月度记录，开始完成任务吧</p>
          )}
        </div>
      </section>
    </div>
  )
}
