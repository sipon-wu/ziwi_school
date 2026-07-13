// 捕获小微会话中用户的输入，供出题/教案/组卷生成时作为 chat_context 融入。
// 这样老师先和小微聊过需求，再点「AI 生成」时，对话里的诉求会被带进产出。
let lastPrompts: string[] = []
const STORAGE_KEY = 'xiaowei_last_prompts'

export function pushXiaoweiPrompt(text: string) {
  const t = (text || '').trim()
  if (!t) return
  lastPrompts = [...lastPrompts, t].slice(-6)
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lastPrompts))
  } catch {
    /* ignore */
  }
}

export function getXiaoweiContext(): string {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) lastPrompts = JSON.parse(raw) || lastPrompts
  } catch {
    /* ignore */
  }
  return lastPrompts.join('；')
}

export function clearXiaoweiContext() {
  lastPrompts = []
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
