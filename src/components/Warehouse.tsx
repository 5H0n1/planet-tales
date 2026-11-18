import { useState } from 'react'
import { usePlanetStore } from '../store'
import { ALL_ITEMS, PROSPERITY_MAX } from '../types'

/** 仓库：存放已拥有物品（商店购买 + 图鉴奖励），用户可随时手动放置到星球 */
export default function Warehouse() {
  const inventory = usePlanetStore((s) => s.inventory)
  const prosperity = usePlanetStore((s) => s.prosperity)
  const placeItem = usePlanetStore((s) => s.placeItem)
  const [placedId, setPlacedId] = useState<string | null>(null)
  const full = prosperity >= PROSPERITY_MAX

  const handlePlace = (itemId: string) => {
    placeItem(itemId)
    setPlacedId(itemId)
    window.setTimeout(() => setPlacedId((cur) => (cur === itemId ? null : cur)), 1200)
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '52vh' }}>
      <p className="rounded-xl bg-white/60 px-3 py-2 text-[11px] leading-relaxed text-[#8A90A0]">
        这里存放你拥有的全部物品。点击「放置」亲手把它摆到星球上（消耗 1 件，增加对应繁荣度）。
      </p>
      {full && (
        <p className="rounded-lg bg-[#E8975A]/15 px-2.5 py-1.5 text-[11px] font-semibold text-[#B07840]">
          ✨ 本月繁荣度已达 100%，物品留到下个月再摆吧
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {ALL_ITEMS.map((item) => {
          const count = inventory[item.id] ?? 0
          const has = count > 0
          return (
            <li
              key={item.id}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                has ? 'border-[#7BC96F]/50 bg-white/75' : 'border-white/50 bg-white/35 opacity-45'
              }`}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-xs font-semibold text-[#2D3142]">{item.name}</span>
              <span className="text-[10px] text-[#8A90A0]">放置 +{item.bonus} 繁荣度</span>
              <span
                className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  has ? 'bg-[#7BC96F]/15 text-[#5FA854]' : 'bg-[#E4E8F0] text-[#A6ACBC]'
                }`}
              >
                {has ? `× ${count}` : '未拥有'}
              </span>
              {has && (
                <button
                  onClick={() => handlePlace(item.id)}
                  disabled={full}
                  className={`mt-1 w-full rounded-lg py-1 text-[11px] font-bold transition ${
                    placedId === item.id
                      ? 'bg-[#7BC96F] text-white'
                      : full
                        ? 'bg-[#E4E8F0] text-[#A6ACBC]'
                        : 'bg-[#7BC96F]/15 text-[#5FA854] hover:bg-[#7BC96F] hover:text-white'
                  }`}
                >
                  {placedId === item.id ? '已放置 ✓' : '放置到星球'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
