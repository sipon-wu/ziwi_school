/** 统一的语音朗读（Web Speech API）—— **单一事实源**
 *
 * 为什么收口成一个模块：此前**三处各写一份**，结果长出三种不同的 bug：
 *   1. `components/PptxPreview.tsx` 跟读组件：`u.lang` 硬编码 `'en-US'`
 *      → 中文内容用英文语音朗读（用户反馈"音频还是纯英文"的根因）。
 *   2. `lib/courseware-h5/renderer.ts` 点读：语言自适应做对了，但**没有停止/暂停**
 *      → 用户"没有播放器，不知道怎么暂停与关闭"。
 *   3. `pages/CoursewareList.tsx`：`u.lang` 硬编码 `'zh-CN'` → 英文内容也被中文读。
 * 同一件事写三份必然各自腐化（与代码里"两套 _SKILL_REFS"是同一类错误）。
 *
 * 另一个容易漏的点：**只设 `u.lang` 不够**。若系统没有对应语言的音色，浏览器会回落到
 * 默认音色（常见是英文）——这正是"明明设了 zh-CN 却还是英文"的常见原因。
 * 所以这里按 lang **显式挑音色**。
 */

/** 按文本内容判定语言：含汉字 → 中文，否则英文 */
export function pickLang(text: string): string {
  return /[\u4e00-\u9fa5]/.test(text || '') ? 'zh-CN' : 'en-US'
}

let voices: SpeechSynthesisVoice[] = []

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  try {
    const list = window.speechSynthesis.getVoices() || []
    if (list.length) voices = list
  } catch { /* noop */ }
  return voices
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  refreshVoices()
  // 多数浏览器的音色列表是**异步**就绪的：不监听该事件，首次朗读会挑不到音色
  try {
    window.speechSynthesis.onvoiceschanged = () => refreshVoices()
  } catch { /* noop */ }
}

/** 为该语言挑一个音色（挑不到返回 undefined，交给浏览器默认行为） */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const list = refreshVoices()
  if (!list.length) return undefined
  const base = lang.split('-')[0].toLowerCase()
  return (
    list.find(v => (v.lang || '').toLowerCase() === lang.toLowerCase()) ||
    list.find(v => (v.lang || '').toLowerCase().startsWith(base)) ||
    undefined
  )
}

interface Handlers {
  onEnd?: () => void
  onError?: () => void
}

export const tts = {
  supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  },

  /** 朗读一段文本（会先打断上一段）。语言与音色都按文本自动适配。 */
  speak(text: string, h: Handlers = {}): void {
    if (!text || !this.supported()) { h.onError?.(); return }
    try {
      const u = new SpeechSynthesisUtterance(text)
      const lang = pickLang(text)
      const v = pickVoice(lang)
      u.lang = (v && v.lang) || lang
      if (v) u.voice = v
      u.rate = 0.9
      u.onend = () => h.onEnd?.()
      u.onerror = () => h.onError?.()
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch { h.onError?.() }
  },

  /** 暂停（部分浏览器不支持，调用后请以 `isPaused()` 的实际状态为准） */
  pause(): void { try { window.speechSynthesis?.pause() } catch { /* noop */ } },
  resume(): void { try { window.speechSynthesis?.resume() } catch { /* noop */ } },
  /** 停止并清空队列（"关闭"用这个） */
  stop(): void { try { window.speechSynthesis?.cancel() } catch { /* noop */ } },
  isPaused(): boolean { try { return !!window.speechSynthesis?.paused } catch { return false } },
}
