import { usePlanetStore } from '../store'
import { ALBUM_ENTRIES, prosperityPercent } from '../types'

/** 图鉴：繁荣度达成阈值自动解锁，奖励专属物品与星球币 */
export default function Album() {
  const prosperity = usePlanetStore((s) => s.prosperity)
  const claimed = usePlanetStore((s) => s.albumClaimed)

  return (
    <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '52vh' }}>
      <p className="rounded-xl bg-white/60 px-3 py-2 text-[11px] leading-relaxed text-[#8A90A0]">
        繁荣度每达成一个里程碑，自动解锁对应图鉴并发放专属物品与星球币奖励。
      </p>
      <ul className="flex flex-col gap-2">
        {ALBUM_ENTRIES.map((entry) => {
          const got = claimed.includes(entry.id)
          const pct = prosperityPercent(prosperity)
          const targetPct = prosperityPercent(entry.threshold)
          return (
            <li
              key={entry.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                got ? 'border-[#FFD66B]/70 bg-white/80' : 'border-white/50 bg-white/40'
              }`}
            >
              <span className={`text-2xl ${got ? '' : 'opacity-30 grayscale'}`}>{entry.reward.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold ${got ? 'text-[#2D3142]' : 'text-[#8A90A0]'}`}>
                  {entry.title}
                  <span className="ml-1.5 font-normal text-[#A6ACBC]">{entry.desc}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-[#8A90A0]">
                  奖励：{entry.reward.name}（放置 +{entry.reward.bonus}） · 🪙 +{entry.coins}
                </p>
                {!got && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1F6]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FFD66B] to-[#7BC96F]"
                      style={{ width: `${Math.min(100, (pct / targetPct) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              {got ? (
                <span className="shrink-0 rounded-full bg-[#FFD66B]/25 px-2 py-0.5 text-[10px] font-bold text-[#B08A1E]">
                  已收录
                </span>
              ) : (
                <span className="shrink-0 text-[10px] font-semibold text-[#A6ACBC]">{pct}%</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
