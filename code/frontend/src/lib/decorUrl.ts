/**
 * 装饰 data URL 归一化（零依赖，PPT 预览/导出与 H5 渲染共用）。
 *
 * 2026-10-01 修：**装饰全破图** 的根因 —— 库里装饰素材（及内容页 CW-DECOR / 封面 CW-COVER 快照）
 * 的 url 形如 `data:image/svg+xml;utf8,%3Csvg+xmlns%3D%22...`，空格被编成了 **`+`**
 * （Go `url.QueryEscape` 的产物）。而 data: URL 里 `+` 是**字面量**、不会被解成空格 → SVG 变成
 * `<svg+xmlns=...`（非法）→ `<img>` 加载失败 → **破图**（每页角落/浮动装饰都挂上）。
 * 浏览器实测：percent 编码形式渲染不出，**只有 `;base64` 稳定可用** → 统一解码后转 base64。
 * 非 `data:image/svg+xml`（http / 已是 base64）原样返回，零影响。
 */
export function normalizeDecorUrl(u?: string | null): string {
  if (!u || !u.startsWith('data:image/svg+xml')) return u || ''
  const comma = u.indexOf(',')
  if (comma < 0) return u
  if (/;base64/i.test(u.slice(0, comma))) return u // 已是 base64
  try {
    const svg = decodeURIComponent(u.slice(comma + 1).replace(/\+/g, ' '))
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
  } catch {
    return u // 解码失败不阻断渲染
  }
}

/** 归一化一个装饰槽对象里的全部 url（内容页 CW-DECOR / 封面 CW-COVER 通用）。
 *  注：泛型故意**不加 `Record<string, unknown>` 约束**——`DecorSlots` 等具名接口没有索引签名，
 *  加了会在 `tsc` 报 TS2345（vite/esbuild 不做类型校验，只有 pre-commit 的 tsc 门禁能拦到）。 */
export function normalizeDecorSlots<T>(d: T): T {
  if (!d || typeof d !== 'object') return d
  const out: Record<string, unknown> = { ...(d as unknown as Record<string, unknown>) }
  for (const k of Object.keys(out)) {
    const v = out[k]
    if (typeof v === 'string') out[k] = normalizeDecorUrl(v) // background（字符串）
    else if (Array.isArray(v)) {
      out[k] = v.map((it: any) => (it && typeof it === 'object' && 'url' in it ? { ...it, url: normalizeDecorUrl(it.url) } : it))
    }
  }
  return out as unknown as T
}
