import { useEffect, useState } from 'react'
import { usePlanetStore } from '../store'
import { Sprout, Vine, FloatingLeaves } from './Botanical'

/**
 * 进入主页（Landing Page）
 * 植物系仪式入口：命名星球 → Enter → 平滑过场进入主界面
 */
export default function Landing({ visible, onExited }: { visible: boolean; onExited: () => void }) {
  const planetName = usePlanetStore((s) => s.planetName)
  const setPlanetName = usePlanetStore((s) => s.setPlanetName)
  const setEntered = usePlanetStore((s) => s.setEntered)
  const [name, setName] = useState(planetName)

  // 退出动画播完后卸载组件
  useEffect(() => {
    if (!visible) {
      const t = window.setTimeout(onExited, 850)
      return () => window.clearTimeout(t)
    }
  }, [visible, onExited])

  const enter = () => {
    const trimmed = name.trim()
    setPlanetName(trimmed || planetName)
    setEntered(true)
  }

  return (
    <div
      className={`absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#141D36]/92 via-[#1B2440]/88 to-[#25345C]/92 backdrop-blur-md transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* 背景装饰 */}
      <Vine />
      <Vine flip />
      <FloatingLeaves />

      {/* 中央内容 */}
      <div
        className={`relative flex flex-col items-center gap-5 px-8 text-center transition-all duration-700 ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
        }`}
      >
        <div style={{ animation: 'fadeUp 0.8s ease both' }}>
          <Sprout size={52} className="mx-auto" />
        </div>

        <div style={{ animation: 'fadeUp 0.8s ease 0.12s both' }}>
          <h1 className="text-5xl font-bold tracking-[0.15em] text-white">星球物语</h1>
          <p className="mt-2 text-xs font-medium tracking-[0.55em] text-[#A5E29B]">PLANET TALES</p>
        </div>

        <div className="flex items-center gap-3 text-[#7BC96F]" style={{ animation: 'fadeUp 0.8s ease 0.22s both' }}>
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#7BC96F]" />
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 2C7 8 5 13 12 22C19 13 17 8 12 2Z" />
          </svg>
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#7BC96F]" />
        </div>

        <div style={{ animation: 'fadeUp 0.8s ease 0.32s both' }} className="w-72">
          <label className="mb-2 block text-xs tracking-widest text-white/55">给你的星球起个名字</label>
          <div className="relative">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 text-[#A5E29B]">
              <Sprout size={18} />
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enter()}
              placeholder="小绿的星球"
              maxLength={12}
              className="w-full rounded-full border border-white/25 bg-white/10 py-3 pr-5 pl-11 text-center text-sm font-medium text-white outline-none backdrop-blur transition placeholder:text-white/35 focus:border-[#7BC96F] focus:bg-white/15"
            />
          </div>
        </div>

        <button
          onClick={enter}
          style={{ animation: 'fadeUp 0.8s ease 0.44s both' }}
          className="group relative mt-1 rounded-full bg-gradient-to-r from-[#7BC96F] to-[#5FC46B] px-14 py-3.5 text-sm font-bold tracking-[0.35em] text-white uppercase shadow-lg shadow-[#7BC96F]/30 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#7BC96F]/45 active:scale-98"
        >
          Enter
          <span className="absolute -top-1 -right-2 transition-transform duration-300 group-hover:rotate-12">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#A5E29B">
              <path d="M12 2C7 8 5 13 12 22C19 13 17 8 12 2Z" />
            </svg>
          </span>
        </button>

        <p className="text-[11px] tracking-wider text-white/35" style={{ animation: 'fadeUp 0.8s ease 0.56s both' }}>
          每完成一件任务，星球都会替你记住
        </p>
      </div>
    </div>
  )
}
