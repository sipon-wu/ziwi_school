// 装饰素材库目录：把后端 /decor 接口返回的装饰元件缓存为 assetId → {url,name} 映射，
// 供模板渲染时把 DecorSlot.assetId 解析为素材库真实 URL（同源 SVG，视觉一致）。
//
// 设计原则（与 DecorSlot 约定一致）：
//   - 素材库是装饰的唯一真相源（seed 已按 STYLE_DECOR_MAP 的 assetId 入库）
//   - 模板 DecorSlot.snapshot 内联 SVG 仅作兜底（catalog 未加载/接口失败时不破图）
//   - resolveDecorUrl 永远回落到 snapshot fallback，零回归
import { decorAPI } from './api'
import type { MaterialItem } from './api'

interface CatalogEntry {
  url: string
  name: string
}

let catalog: Map<string, CatalogEntry> | null = null
let loading: Promise<void> | null = null

/** 拉取平台公共装饰元件库，建立 assetId → {url,name} 映射。幂等：已加载直接返回。 */
export function loadDecorCatalog(): Promise<void> {
  if (catalog) return Promise.resolve()
  if (loading) return loading
  loading = (async () => {
    try {
      const res = await decorAPI.list({ scope: 'public', kind: 'decor_element' })
      const map = new Map<string, CatalogEntry>()
      for (const it of (res?.items ?? []) as MaterialItem[]) {
        if (it.id && it.url) map.set(it.id, { url: it.url, name: it.name })
      }
      catalog = map
    } catch {
      // 加载失败不阻塞渲染：模板仍用 snapshot 兜底
      catalog = new Map<string, CatalogEntry>()
    }
  })()
  return loading
}

/** 按 assetId 取素材库真实 URL；解析不到则回落 fallback（通常为 DecorSlot.snapshot.url 内联 SVG）。 */
export function resolveDecorUrl(assetId: string, fallback: string): string {
  if (!catalog && !loading) loadDecorCatalog() // 懒触发：任意消费点首次解析时后台拉取，下次命中
  const e = catalog?.get(assetId)
  return e?.url || fallback
}
