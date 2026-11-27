import { useRef, useState } from 'react'
import { usePlanetStore } from '../store'
import type { Task } from '../types'
import { playComplete } from '../sound'

type Phase = 'pick' | 'preview' | 'checking' | 'passed' | 'failed'

const MAX_RETRIES = 3

/** 图片压缩：最长边 1024px 的 JPEG，返回不带前缀的 base64 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1])
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image load failed'))
    }
    img.src = url
  })
}

/** 演示模式：未配置 AI 服务时的本地模拟审核 */
function mockVerdict(task: Task): { passed: boolean; reason: string } {
  return { passed: true, reason: `演示模式：「${task.title.slice(0, 12)}」凭证已确认 ✓` }
}

export default function ProofModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const submitProof = usePlanetStore((s) => s.submitProof)
  const resolveProof = usePlanetStore((s) => s.resolveProof)
  const honestComplete = usePlanetStore((s) => s.honestComplete)
  const forceMockAI = usePlanetStore((s) => s.forceMockAI)
  const soundOn = usePlanetStore((s) => s.soundOn)
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>(task.proof ? 'preview' : 'pick')
  const [image, setImage] = useState<string | null>(task.proof?.image ?? null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    task.proof ? `data:image/jpeg;base64,${task.proof.image}` : null,
  )
  const [reason, setReason] = useState(task.proof?.status === 'failed' ? task.proof.reason : '')
  const [notice, setNotice] = useState('')
  const retries = task.proof?.retries ?? 0

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setNotice('')
    setReason('')
    try {
      const base64 = await compressImage(file)
      setImage(base64)
      setPreviewUrl(`data:image/jpeg;base64,${base64}`)
      setPhase('preview')
    } catch {
      setNotice('图片读取失败，请换一张试试')
    }
  }

  const submit = async () => {
    if (!image || phase === 'checking') return
    setPhase('checking')
    submitProof(task.id, image)

    let verdict: { passed: boolean; reason: string }
    if (forceMockAI) {
      await new Promise((r) => setTimeout(r, 1400))
      verdict = mockVerdict(task)
    } else {
      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, taskTitle: task.title }),
        })
        if (res.status === 503) {
          await new Promise((r) => setTimeout(r, 900))
          setNotice('未配置 AI 服务（MOONSHOT_API_KEY），已使用演示模式')
          verdict = mockVerdict(task)
        } else if (!res.ok) {
          setPhase('preview')
          setNotice('AI 服务暂时不可用，请稍后重试')
          return
        } else {
          verdict = await res.json()
        }
      } catch {
        setPhase('preview')
        setNotice('网络异常，请检查连接后重试')
        return
      }
    }

    resolveProof(task.id, verdict.passed, verdict.reason)
    if (verdict.passed) {
      if (soundOn) playComplete()
      setPhase('passed')
      window.setTimeout(onClose, 1400)
    } else {
      setReason(verdict.reason || '凭证与任务不符')
      setPhase('failed')
    }
  }

  const honest = () => {
    honestComplete(task.id)
    if (soundOn) playComplete()
    onClose()
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[#2D3142]/45 p-4 backdrop-blur-sm">
      <div className="flex w-full flex-col gap-3 rounded-xl bg-white/95 p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#2D3142]">完成凭证 · AI 审核</h3>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[#8A90A0]">任务：{task.title}</p>
          </div>
          {phase !== 'checking' && (
            <button onClick={onClose} aria-label="关闭" className="text-[#C8CED9] transition hover:text-[#2D3142]">✕</button>
          )}
        </div>

        {phase === 'pick' && (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-[#C8CED9] bg-white/60 px-4 py-8 text-[#8A90A0] transition hover:border-[#7BC96F] hover:text-[#5FA854]"
          >
            <span className="text-3xl">📷</span>
            <span className="text-xs font-semibold">拍照或上传完成凭证</span>
            <span className="text-[10px]">照片、截图都可以，AI 会帮你确认</span>
          </button>
        )}

        {phase === 'preview' && previewUrl && (
          <img src={previewUrl} alt="完成凭证预览" className="max-h-44 w-full rounded-lg object-contain" />
        )}

        {phase === 'checking' && (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-3xl" style={{ animation: 'glowPulse 1.2s ease-in-out infinite' }}>🤖</span>
            <p className="text-xs font-semibold text-[#8A90A0]">AI 正在审核凭证…</p>
          </div>
        )}

        {phase === 'passed' && (
          <div className="flex flex-col items-center gap-1.5 rounded-lg bg-[#7BC96F]/15 px-3 py-4 text-center">
            <span className="text-2xl">✅</span>
            <p className="text-xs font-bold text-[#5FA854]">审核通过，星球币已到账！</p>
            <p className="text-[10px] text-[#8A90A0]">{reason}</p>
          </div>
        )}

        {phase === 'failed' && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-[#E8975A]/15 px-3 py-3">
            <p className="text-xs font-bold text-[#B07840]">未通过：{reason}</p>
            <p className="text-[10px] text-[#8A90A0]">
              本次审核算 1 次提交（已用 {retries}/{MAX_RETRIES} 次），可换一张更直接的凭证重试
            </p>
          </div>
        )}

        {notice && <p className="text-center text-[10px] text-[#A6ACBC]">{notice}</p>}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        {(phase === 'pick' || phase === 'preview') && (
          <div className="flex gap-2">
            {phase === 'preview' && (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-[#8A90A0] shadow-sm transition hover:bg-white"
              >
                换一张
              </button>
            )}
            <button
              onClick={phase === 'pick' ? () => fileRef.current?.click() : submit}
              disabled={phase === 'preview' && !image}
              className={`rounded-lg px-4 py-2 text-xs font-bold text-white shadow transition ${
                phase === 'pick' || image ? 'bg-[#7BC96F] hover:bg-[#6AB75E]' : 'bg-[#C8CED9]'
              }`}
            >
              {phase === 'pick' ? '选择图片' : '提交 AI 审核'}
            </button>
          </div>
        )}

        {phase === 'failed' && (
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 rounded-lg bg-[#7BC96F] px-3 py-2 text-xs font-bold text-white shadow transition hover:bg-[#6AB75E]"
            >
              重新上传（剩 {MAX_RETRIES - retries} 次）
            </button>
            {retries >= MAX_RETRIES && (
              <button
                onClick={honest}
                title="以诚信担保完成，星球币减半"
                className="rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-[#B07840] shadow-sm transition hover:bg-white"
              >
                ⚖️ 诚实声明（半额）
              </button>
            )}
          </div>
        )}

        {phase === 'pick' && (
          <p className="text-center text-[10px] text-[#A6ACBC]">
            每张任务每月可提交 {MAX_RETRIES} 次；始终无法通过可诚实声明完成（半额奖励）
          </p>
        )}
      </div>
    </div>
  )
}
