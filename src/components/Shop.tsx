import { usePlanetStore } from '../store'
import { SHOP_STOCK } from '../types'

/** 星球商店：用星球币购买装饰物，购买的物品进入仓库 */
export default function Shop() {
  const coins = usePlanetStore((s) => s.coins)
  const inventory = usePlanetStore((s) => s.inventory)
  const buyItem = usePlanetStore((s) => s.buyItem)

  return (
    <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '52vh' }}>
      <p className="rounded-xl bg-white/60 px-3 py-2 text-[11px] leading-relaxed text-[#8A90A0]">
        完成任务赚取星球币 🪙，在这里购买装饰物。买到的物品存放在仓库，完成任务时放置到星球上可增加繁荣度。
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {SHOP_STOCK.map((item) => {
          const owned = inventory[item.id] ?? 0
          const affordable = coins >= item.price
          return (
            <li
              key={item.id}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                affordable ? 'border-[#FFD66B]/60 bg-white/75' : 'border-white/60 bg-white/45'
              }`}
            >
              <span className="text-2xl">{item.emoji}</span>
              <span className="text-xs font-semibold text-[#2D3142]">{item.name}</span>
              <span className="text-[10px] text-[#8A90A0]">放置 +{item.bonus} 繁荣度</span>
              {owned > 0 && (
                <span className="text-[10px] text-[#8A90A0]">仓库已有 ×{owned}</span>
              )}
              <button
                onClick={() => buyItem(item.id)}
                disabled={!affordable}
                className={`mt-0.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  affordable
                    ? 'bg-[#FFD66B] text-[#7A5B16] shadow hover:bg-[#F5C94C]'
                    : 'cursor-not-allowed bg-[#E4E8F0] text-[#A6ACBC]'
                }`}
              >
                🪙 {item.price} 购买
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
