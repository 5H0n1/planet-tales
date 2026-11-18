/** 用 Web Audio API 现场合成提示音，无需任何音频文件 */
let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, delay: number, dur: number, type: OscillatorType, vol: number) {
  const ac = audio()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = ac.currentTime + delay
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

/** 完成任务：C-E-G 轻柔琶音 */
export function playComplete() {
  ;[523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.35, 'triangle', 0.1))
}

/** 种下一颗种子：一声轻叮 */
export function playSeed() {
  tone(880, 0, 0.18, 'sine', 0.07)
}

/** 切换为未完成：低音回落 */
export function playUndo() {
  tone(392, 0, 0.2, 'sine', 0.06)
}
