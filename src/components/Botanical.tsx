/** 植物系装饰组件：进入主页的藤蔓、飘叶、嫩芽 */

const LEAF_PATH = 'M0,0 C6,-2 12,-10 13,-21 C4,-15 0,-8 0,0 Z'

const LEAVES = [
  { x: 34, y: 300, r: -55, s: 1.05, o: 0.85 },
  { x: 45, y: 288, r: -12, s: 0.8, o: 0.65 },
  { x: 48, y: 244, r: -60, s: 0.95, o: 0.8 },
  { x: 56, y: 230, r: -8, s: 0.7, o: 0.6 },
  { x: 51, y: 182, r: -50, s: 0.9, o: 0.8 },
  { x: 59, y: 168, r: -2, s: 0.68, o: 0.6 },
  { x: 56, y: 120, r: -45, s: 0.78, o: 0.75 },
  { x: 65, y: 107, r: 2, s: 0.6, o: 0.55 },
  { x: 80, y: 64, r: -35, s: 0.66, o: 0.75 },
  { x: 91, y: 53, r: 6, s: 0.54, o: 0.6 },
]

/** 角落藤蔓：从底部长出的弯曲枝条 + 成对叶片，顶端一粒发光的花苞 */
export function Vine({ flip = false, className = '' }: { flip?: boolean; className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-0 ${flip ? 'right-0' : 'left-0'} ${className}`}
      style={{ transform: flip ? 'scaleX(-1)' : undefined, transformOrigin: 'bottom center' }}
    >
      <svg
        viewBox="0 0 140 350"
        className="h-[46vh] w-auto"
        style={{ transformOrigin: '40px 350px', animation: 'sway 8s ease-in-out infinite' }}
        fill="none"
      >
        <path
          d="M40,350 C15,270 68,222 50,148 C38,92 78,55 108,14"
          stroke="#6AB75E"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {LEAVES.map((l, i) => (
          <path
            key={i}
            d={LEAF_PATH}
            fill={i % 3 === 0 ? '#5FC46B' : i % 3 === 1 ? '#7BC96F' : '#A5E29B'}
            opacity={l.o}
            transform={`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`}
          />
        ))}
        {/* 顶端花苞 */}
        <circle cx="108" cy="14" r="5" fill="#FFD66B" style={{ animation: 'glowPulse 3s ease-in-out infinite' }} />
        <circle cx="108" cy="14" r="9" fill="#FFD66B" opacity="0.25" style={{ animation: 'glowPulse 3s ease-in-out infinite' }} />
      </svg>
    </div>
  )
}

/** 单个飘浮叶片 */
export function FloatingLeaf({
  style,
  size = 20,
  color = '#7BC96F',
  opacity = 0.55,
}: {
  style: React.CSSProperties
  size?: number
  color?: string
  opacity?: number
}) {
  return (
    <svg
      viewBox="0 0 24 32"
      width={size}
      height={size * 1.33}
      className="pointer-events-none absolute"
      style={{ opacity, ...style }}
      fill="none"
    >
      <path d="M12 2 C4 10 3 20 12 30 C21 20 20 10 12 2 Z" fill={color} />
      <path d="M12 5 L12 27" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
    </svg>
  )
}

/** 嫩芽图标（标题装饰 / 输入框前缀） */
export function Sprout({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} fill="none">
      <path d="M24 44 C24 34 24 26 24 20" stroke="#7BC96F" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 26 C16 26 10 20 9 11 C18 12 24 17 24 26 Z" fill="#7BC96F" />
      <path d="M24 22 C32 22 38 16 39 7 C30 8 24 13 24 22 Z" fill="#A5E29B" />
    </svg>
  )
}

/** 预设的飘叶布局 */
export function FloatingLeaves() {
  return (
    <>
      <FloatingLeaf size={22} color="#7BC96F" style={{ left: '12%', top: '18%', animation: 'floaty 9s ease-in-out infinite' }} />
      <FloatingLeaf size={16} color="#A5E29B" style={{ left: '22%', top: '64%', animation: 'floaty 11s ease-in-out 1.2s infinite' }} />
      <FloatingLeaf size={26} color="#5FC46B" style={{ left: '8%', top: '44%', animation: 'floaty 13s ease-in-out 0.6s infinite' }} />
      <FloatingLeaf size={18} color="#7BC96F" style={{ right: '16%', top: '22%', animation: 'floaty 10s ease-in-out 2s infinite' }} />
      <FloatingLeaf size={14} color="#A5E29B" style={{ right: '10%', top: '58%', animation: 'floaty 12s ease-in-out 0.3s infinite' }} />
      <FloatingLeaf size={24} color="#5FC46B" style={{ right: '24%', top: '72%', animation: 'floaty 14s ease-in-out 1.6s infinite' }} />
      <FloatingLeaf size={15} color="#7BC96F" style={{ left: '38%', top: '10%', animation: 'floaty 12s ease-in-out 2.4s infinite' }} />
    </>
  )
}
