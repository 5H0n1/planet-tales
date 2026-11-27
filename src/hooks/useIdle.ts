import { useEffect, useState } from 'react'

const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'] as const

/** 无操作检测：超过 ms 毫秒没有任何输入即视为待机 */
export function useIdle(ms = 30000): boolean {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    let timer: number | undefined

    const reset = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), ms)
    }

    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, reset))
      window.clearTimeout(timer)
    }
  }, [ms])

  return idle
}
