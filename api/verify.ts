/**
 * AI 完成凭证审核（Vercel Serverless Function）
 *
 * 部署后在 Vercel 项目设置 → Environment Variables 添加：
 *   MOONSHOT_API_KEY = 你的 Kimi（Moonshot）API Key
 *   MOONSHOT_MODEL   = 可选，默认 moonshot-v1-8k-vision-preview
 *
 * 前端 POST /api/verify { image: base64, taskTitle: string }
 * 返回 { passed: boolean, reason: string }
 */

const SYSTEM_PROMPT = `你是「星球物语」任务管理应用的完成凭证审核员。
用户声称完成了待办任务，并上传了一张凭证图片。
请判断这张图片是否足以作为该任务已完成的合理证据。
要求：
- 宽容但审慎：图片内容与任务主题明显相关（直接证据或强间接证据）即判通过。
- 完全无关、空白、模糊到无法辨认、明显与任务主题矛盾时判不通过。
- reason 用一句简短中文说明判断依据（20 字以内）。
- 只输出 JSON，不要输出其他内容：{"passed": true/false, "reason": "..."}`

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const apiKey = process.env.MOONSHOT_API_KEY
  if (!apiKey) {
    // 未配置 Key：前端会自动降级为本地演示模式
    res.status(503).json({ error: 'AI service not configured' })
    return
  }

  const { image, taskTitle } = req.body ?? {}
  if (typeof image !== 'string' || image.length < 100 || image.length > 4_000_000) {
    res.status(400).json({ error: 'Invalid image payload' })
    return
  }
  if (typeof taskTitle !== 'string' || !taskTitle.trim()) {
    res.status(400).json({ error: 'Missing taskTitle' })
    return
  }

  const model = process.env.MOONSHOT_MODEL || 'moonshot-v1-8k-vision-preview'

  try {
    const upstream = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: `任务：「${taskTitle.slice(0, 80)}」。请审核这张完成凭证图片。` },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
            ],
          },
        ],
      }),
    })

    if (!upstream.ok) {
      res.status(502).json({ error: `AI upstream error: ${upstream.status}` })
      return
    }

    const data = await upstream.json()
    const content: string = data.choices?.[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      res.status(502).json({ error: 'AI response not parseable' })
      return
    }

    let verdict: { passed?: boolean; reason?: string }
    try {
      verdict = JSON.parse(jsonMatch[0])
    } catch {
      res.status(502).json({ error: 'AI response not parseable' })
      return
    }

    res.status(200).json({
      passed: verdict.passed === true,
      reason: typeof verdict.reason === 'string' ? verdict.reason.slice(0, 60) : '',
    })
  } catch (e) {
    res.status(502).json({ error: `AI request failed: ${String(e)}` })
  }
}
