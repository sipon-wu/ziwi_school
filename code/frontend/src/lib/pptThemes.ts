/**
 * 官方 PPT 风格模板库（课堂适用）
 * 覆盖 K12 全学段与学科场景，按 10 组 · 56 风格组织。
 * 每个风格一套完整配色：主色 / 文字 / 封面 / 页脚 / 列表符号 / 字体。
 *
 * 语义标签（2026-07-31 新增，支撑「按学科 + 年级观感推荐」，推荐不强制）：
 *  - subjects  适配学科（空 = 通用，任意学科可用）
 *  - grades    适配学段（空 = 全学段通用）
 *    分级：low = 小学低段(1-3) / mid = 小学中高段(4-6) / high = 初高中段(7+)
 *
 * 字段含义：
 *  - primary      内容页标题色带 + 列表符号基准色
 *  - onPrimary    主色上的文字（标题带、封面标题）
 *  - coverBg      封面背景（纯色，PPTX 导出用）
 *  - coverGradient 封面渐变（仅 Web 预览 CSS；导出回退 coverBg）
 *  - lightText    封面副标题文字
 *  - footer       浅底页脚文字
 *  - body         正文颜色
 *  - subtle       占位/次要文字
 *  - bullet       列表符号颜色
 *  - font         中文字体（默认微软雅黑，跨平台稳定）
 */

export type GradeBand = 'low' | 'mid' | 'high'

export interface CwTheme {
  id: string
  name: string
  group: string
  groupId: string
  primary: string
  onPrimary: string
  coverBg: string
  coverGradient?: string
  lightText: string
  footer: string
  body: string
  subtle: string
  bullet: string
  font: string
  /** 适配学科（空 = 通用） */
  subjects?: string[]
  /** 适配学段（空 = 全学段） */
  grades?: GradeBand[]
}

const F = 'Microsoft YaHei'

const THEMES: CwTheme[] = [
  // ── A. 中国风（语文 / 历史 / 传统文化） ──
  { id: 'zgf-ink-wash', name: '水墨丹青', group: '中国风', groupId: 'zhongguofeng', primary: '2B2B2B', onPrimary: 'FFFFFF', coverBg: '2B2B2B', coverGradient: 'linear-gradient(135deg,#2B2B2B,#4A4A4A)', lightText: 'C9C9C9', footer: '9A9A9A', body: '333333', subtle: '777777', bullet: '8A8A8A', font: F, subjects: ['语文', '历史', '美术', '政治'], grades: ['mid', 'high'] },
  { id: 'zgf-guochao', name: '国潮新中式', group: '中国风', groupId: 'zhongguofeng', primary: 'C0392B', onPrimary: 'FFFFFF', coverBg: 'C0392B', coverGradient: 'linear-gradient(135deg,#C0392B,#9E2B25)', lightText: 'F6D9C0', footer: 'C97E7E', body: '333333', subtle: '777777', bullet: 'D4AF37', font: F, subjects: ['语文', '历史', '美术'], grades: ['mid', 'high'] },
  { id: 'zgf-classic-red', name: '古典朱红', group: '中国风', groupId: 'zhongguofeng', primary: '9E2B25', onPrimary: 'FFF8F0', coverBg: '9E2B25', lightText: 'F2D9C0', footer: 'C08880', body: '3A2A22', subtle: '8A7A6A', bullet: 'C8A06A', font: F, subjects: ['语文', '历史'], grades: ['mid', 'high'] },
  { id: 'zgf-shanshui', name: '山水青绿', group: '中国风', groupId: 'zhongguofeng', primary: '2F6B5E', onPrimary: 'FFFFFF', coverBg: '2F6B5E', coverGradient: 'linear-gradient(135deg,#2F6B5E,#3E8B77)', lightText: 'D6E5DC', footer: '8FAE9E', body: '2E3A33', subtle: '7A8A80', bullet: '5A9A86', font: F, subjects: ['语文', '美术', '地理'], grades: ['low', 'mid', 'high'] },
  { id: 'zgf-song-qing', name: '宋韵天青', group: '中国风', groupId: 'zhongguofeng', primary: '5B8C9E', onPrimary: 'FFFFFF', coverBg: '5B8C9E', lightText: 'DCE9EE', footer: '9CB6C0', body: '33403F', subtle: '7E9197', bullet: '3F6E7E', font: F, subjects: ['语文', '历史', '美术'], grades: ['mid', 'high'] },
  { id: 'zgf-zen', name: '禅意留白', group: '中国风', groupId: 'zhongguofeng', primary: 'B08D57', onPrimary: 'FFFFFF', coverBg: 'F5F1E8', coverGradient: 'linear-gradient(135deg,#F5F1E8,#EBE4D4)', lightText: '8A8377', footer: 'A99E8A', body: '3A3A3A', subtle: '9A9A8A', bullet: 'B08D57', font: F, subjects: ['语文', '美术', '政治'], grades: ['mid', 'high'] },

  // ── B. 简约商务（通用专业） ──
  { id: 'min-classic-blue', name: '经典深蓝', group: '简约商务', groupId: 'minimal', primary: '1A3A6B', onPrimary: 'FFFFFF', coverBg: '1A3A6B', lightText: 'CADCFC', footer: '8FA8D6', body: '333333', subtle: '666666', bullet: '1A3A6B', font: F, subjects: [], grades: ['mid', 'high'] },
  { id: 'min-geo', name: '几何极简', group: '简约商务', groupId: 'minimal', primary: '2C3E50', onPrimary: 'FFFFFF', coverBg: '2C3E50', lightText: 'AEBFD0', footer: '95A6B8', body: '333333', subtle: '666666', bullet: '2C3E50', font: F, subjects: ['数学', '信息技术'], grades: ['low', 'mid', 'high'] },
  { id: 'min-gray-premium', name: '高级灰', group: '简约商务', groupId: 'minimal', primary: '4A4A4A', onPrimary: 'FFFFFF', coverBg: '4A4A4A', lightText: 'CFCFCF', footer: 'A0A0A0', body: '333333', subtle: '777777', bullet: '4A4A4A', font: F, subjects: [], grades: ['mid', 'high'] },
  { id: 'min-pure-white', name: '纯净白', group: '简约商务', groupId: 'minimal', primary: '1A3A6B', onPrimary: 'FFFFFF', coverBg: 'FFFFFF', coverGradient: 'linear-gradient(135deg,#FFFFFF,#F0F2F7)', lightText: '5A6B85', footer: '9AA6B8', body: '333333', subtle: '777777', bullet: '1A3A6B', font: F, subjects: [], grades: ['low', 'mid', 'high'] },
  { id: 'min-modern-line', name: '现代线条', group: '简约商务', groupId: 'minimal', primary: '34495E', onPrimary: 'FFFFFF', coverBg: '34495E', lightText: 'BFD3E0', footer: '9AAEBE', body: '333333', subtle: '777777', bullet: '5DADE2', font: F, subjects: ['数学'], grades: ['mid', 'high'] },
  { id: 'min-navy-intellectual', name: '知性藏青', group: '简约商务', groupId: 'minimal', primary: '14304F', onPrimary: 'FFFFFF', coverBg: '14304F', lightText: 'C2D6E4', footer: '8BA6BE', body: '333333', subtle: '777777', bullet: '6FA8C7', font: F, subjects: [], grades: ['mid', 'high'] },

  // ── C. 学术教研（课堂严谨） ──
  { id: 'aca-edu-blue', name: '教研蓝', group: '学术教研', groupId: 'academic', primary: '1F4E79', onPrimary: 'FFFFFF', coverBg: '1F4E79', lightText: 'C5DBEE', footer: '93B0CC', body: '333333', subtle: '777777', bullet: '1F4E79', font: F, subjects: [], grades: ['low', 'mid', 'high'] },
  { id: 'aca-black-gold', name: '学术黑金', group: '学术教研', groupId: 'academic', primary: '1C1C1C', onPrimary: 'D4AF37', coverBg: '1C1C1C', lightText: 'C9B98A', footer: 'B8A878', body: '333333', subtle: '777777', bullet: 'D4AF37', font: F, subjects: [], grades: ['high'] },
  { id: 'aca-rational', name: '理性灰蓝', group: '学术教研', groupId: 'academic', primary: '3B5168', onPrimary: 'FFFFFF', coverBg: '3B5168', lightText: 'C2D0DC', footer: '97A8B8', body: '333333', subtle: '777777', bullet: '5A7C97', font: F, subjects: ['数学', '化学'], grades: ['mid', 'high'] },
  { id: 'aca-cream', name: '知性米白', group: '学术教研', groupId: 'academic', primary: '8C7A5A', onPrimary: 'FFFFFF', coverBg: 'F3EEE2', lightText: '6A5A3E', footer: 'B0A080', body: '3A3328', subtle: '8A8070', bullet: '8C7A5A', font: F, subjects: [], grades: ['mid', 'high'] },
  { id: 'aca-deep-green', name: '沉稳墨绿', group: '学术教研', groupId: 'academic', primary: '1E4036', onPrimary: 'FFFFFF', coverBg: '1E4036', lightText: 'BFD6C9', footer: '8AA898', body: '333333', subtle: '777777', bullet: '3E6E58', font: F, subjects: ['生物', '地理'], grades: ['mid', 'high'] },

  // ── D. 清新活力（小学 / 低龄） ──
  { id: 'fr-macaron-pink', name: '马卡龙粉', group: '清新活力', groupId: 'fresh', primary: 'F4A6C0', onPrimary: 'FFFFFF', coverBg: 'F4A6C0', lightText: 'FFE3EC', footer: 'D79FB4', body: '5A3A45', subtle: '9A7A85', bullet: 'F1789C', font: F, subjects: ['美术', '音乐'], grades: ['low', 'mid'] },
  { id: 'fr-mint', name: '薄荷绿', group: '清新活力', groupId: 'fresh', primary: '3FA776', onPrimary: 'FFFFFF', coverBg: '6FCF97', coverGradient: 'linear-gradient(135deg,#6FCF97,#3FA776)', lightText: 'E6F7EE', footer: '86C2A4', body: '2E4A3A', subtle: '7A8A80', bullet: '3FA776', font: F, subjects: ['生物', '科学'], grades: ['low', 'mid'] },
  { id: 'fr-sky-blue', name: '天蓝童趣', group: '清新活力', groupId: 'fresh', primary: '2F8FC4', onPrimary: 'FFFFFF', coverBg: '56B4E9', lightText: 'EAF6FE', footer: '8FC3E0', body: '2E3A45', subtle: '7A8590', bullet: '2F8FC4', font: F, subjects: ['科学', '英语'], grades: ['low', 'mid'] },
  { id: 'fr-warm-orange', name: '暖橙阳光', group: '清新活力', groupId: 'fresh', primary: 'D97A2B', onPrimary: 'FFFFFF', coverBg: 'F2994A', lightText: 'FDEBDD', footer: 'E0A472', body: '4A3526', subtle: '8A7A6A', bullet: 'D97A2B', font: F, subjects: ['体育', '英语'], grades: ['low', 'mid'] },
  { id: 'fr-lemon', name: '柠檬黄', group: '清新活力', groupId: 'fresh', primary: 'D9A92B', onPrimary: '5A4A12', coverBg: 'F2C94C', lightText: '7A6A22', footer: 'C2B06A', body: '4A4220', subtle: '8A8060', bullet: 'D9A92B', font: F, subjects: ['英语', '美术'], grades: ['low', 'mid'] },
  { id: 'fr-sakura', name: '樱花粉', group: '清新活力', groupId: 'fresh', primary: 'E89BB4', onPrimary: '8A4A5E', coverBg: 'F8C8D8', lightText: '9A5A6E', footer: 'D9A8BC', body: '5A3A45', subtle: '9A7A85', bullet: 'E89BB4', font: F, subjects: ['美术', '音乐'], grades: ['low', 'mid'] },

  // ── E. 莫兰迪（柔和知性） ──
  { id: 'mo-haze-blue', name: '雾霾蓝', group: '莫兰迪', groupId: 'morandi', primary: '7C93A6', onPrimary: 'FFFFFF', coverBg: '7C93A6', lightText: 'E2E8ED', footer: 'AEBECB', body: '4A4A4A', subtle: '8A8A8A', bullet: '5E7689', font: F, subjects: [], grades: ['mid', 'high'] },
  { id: 'mo-gray-purple', name: '灰紫', group: '莫兰迪', groupId: 'morandi', primary: '8A7E95', onPrimary: 'FFFFFF', coverBg: '8A7E95', lightText: 'E6E1EA', footer: 'B2A8BC', body: '4A4A4A', subtle: '8A8A8A', bullet: '6E6280', font: F, subjects: ['美术', '音乐'], grades: ['mid', 'high'] },
  { id: 'mo-milktea', name: '奶茶色', group: '莫兰迪', groupId: 'morandi', primary: 'B89B82', onPrimary: 'FFF8F0', coverBg: 'B89B82', lightText: 'F3E9DC', footer: 'D2BCA6', body: '4A4238', subtle: '8A8070', bullet: '9A7E66', font: F, subjects: [], grades: ['mid', 'high'] },
  { id: 'mo-bean-green', name: '豆沙绿', group: '莫兰迪', groupId: 'morandi', primary: '7E8B6E', onPrimary: 'FFFFFF', coverBg: '7E8B6E', lightText: 'E4E9DD', footer: 'AAB49C', body: '444A3C', subtle: '8A8A7A', bullet: '62705A', font: F, subjects: ['生物', '地理'], grades: ['mid', 'high'] },
  { id: 'mo-rose-gray', name: '玫瑰灰', group: '莫兰迪', groupId: 'morandi', primary: 'A88A8A', onPrimary: 'FFFFFF', coverBg: 'A88A8A', lightText: 'F0E892', footer: 'C6AEAE', body: '4A4444', subtle: '8A8A8A', bullet: '8C6E6E', font: F, subjects: ['美术'], grades: ['mid', 'high'] },
  { id: 'mo-oat', name: '燕麦米', group: '莫兰迪', groupId: 'morandi', primary: 'BBAE92', onPrimary: '5A4A33', coverBg: 'D8C9B0', lightText: '6A5A40', footer: 'CBBE9E', body: '4A4233', subtle: '8A8068', bullet: 'BBAE92', font: F, subjects: [], grades: ['mid', 'high'] },

  // ── F. 科技未来（理化生 / 信息） ──
  { id: 'te-tech-navy', name: '科技深蓝', group: '科技未来', groupId: 'tech', primary: '0B2545', onPrimary: '4DA8DA', coverBg: '0B2545', coverGradient: 'linear-gradient(135deg,#0B2545,#13315C)', lightText: '8FC1E0', footer: '6E96BE', body: '2B3A4A', subtle: '6A7A8A', bullet: '4DA8DA', font: F, subjects: ['物理', '化学', '信息技术'], grades: ['mid', 'high'] },
  { id: 'te-cyber-purple', name: '赛博紫', group: '科技未来', groupId: 'tech', primary: '2D1B4E', onPrimary: 'B388FF', coverBg: '2D1B4E', coverGradient: 'linear-gradient(135deg,#2D1B4E,#3B2360)', lightText: 'C9B6F0', footer: '9E86C8', body: '332B45', subtle: '7A6E8A', bullet: 'B388FF', font: F, subjects: ['信息技术', '物理'], grades: ['mid', 'high'] },
  { id: 'te-aurora-green', name: '极光绿', group: '科技未来', groupId: 'tech', primary: '0E3B33', onPrimary: '4CE0B3', coverBg: '0E3B33', lightText: 'A6EEDD', footer: '6EBBA8', body: '2B3A36', subtle: '6A7A74', bullet: '4CE0B3', font: F, subjects: ['生物', '化学', '信息技术'], grades: ['mid', 'high'] },
  { id: 'te-starry', name: '星空黑', group: '科技未来', groupId: 'tech', primary: '121212', onPrimary: '7FD1FF', coverBg: '121212', coverGradient: 'linear-gradient(135deg,#121212,#1F2937)', lightText: 'A9C9E0', footer: '6E8AA0', body: '2B3138', subtle: '6A7480', bullet: '7FD1FF', font: F, subjects: ['物理', '地理', '信息技术'], grades: ['mid', 'high'] },
  { id: 'te-quantum-blue', name: '量子蓝', group: '科技未来', groupId: 'tech', primary: '102A54', onPrimary: '5BC0EB', coverBg: '102A54', lightText: 'A6D6EE', footer: '6E9CC0', body: '2B374A', subtle: '6A7488', bullet: '5BC0EB', font: F, subjects: ['物理', '数学', '信息技术'], grades: ['mid', 'high'] },
  { id: 'te-digital-cyan', name: '数码青', group: '科技未来', groupId: 'tech', primary: '0A3A40', onPrimary: '3DD6C4', coverBg: '0A3A40', lightText: 'A0E8DF', footer: '6EB8B0', body: '2B3A3A', subtle: '6A7A78', bullet: '3DD6C4', font: F, subjects: ['信息技术', '物理', '化学'], grades: ['mid', 'high'] },

  // ── G. 自然生机（生物 / 地理 / 环保） ──
  { id: 'na-forest', name: '森林绿', group: '自然生机', groupId: 'nature', primary: '1E5631', onPrimary: 'FFFFFF', coverBg: '1E5631', lightText: 'C2DCC9', footer: '8AAE96', body: '2E3A30', subtle: '7A8A7C', bullet: '3E7A4E', font: F, subjects: ['生物', '地理'], grades: ['low', 'mid', 'high'] },
  { id: 'na-ocean', name: '海洋蓝', group: '自然生机', groupId: 'nature', primary: '0E5A8A', onPrimary: 'FFFFFF', coverBg: '0E5A8A', lightText: 'C2DCEF', footer: '8AAEC8', body: '2E3A45', subtle: '7A8A95', bullet: '2F8FC4', font: F, subjects: ['生物', '地理', '科学'], grades: ['low', 'mid', 'high'] },
  { id: 'na-earth', name: '大地棕', group: '自然生机', groupId: 'nature', primary: '6B4226', onPrimary: 'F3E5D0', coverBg: '6B4226', lightText: 'E2CDB0', footer: 'B08A66', body: '3A2E20', subtle: '8A7A66', bullet: '9C6B47', font: F, subjects: ['地理', '历史'], grades: ['mid', 'high'] },
  { id: 'na-dawn', name: '晨曦橙', group: '自然生机', groupId: 'nature', primary: 'C25A18', onPrimary: 'FFFFFF', coverBg: 'E8772E', coverGradient: 'linear-gradient(135deg,#E8772E,#C25A18)', lightText: 'FDEBDD', footer: 'E0A472', body: '4A3526', subtle: '8A7A66', bullet: 'C25A18', font: F, subjects: ['体育', '科学'], grades: ['low', 'mid'] },
  { id: 'na-grass', name: '草木青', group: '自然生机', groupId: 'nature', primary: '5A8A3C', onPrimary: 'FFFFFF', coverBg: '5A8A3C', lightText: 'E2EED6', footer: '9AB87E', body: '2E3A2C', subtle: '7A8A74', bullet: '7FB14E', font: F, subjects: ['生物', '科学'], grades: ['low', 'mid', 'high'] },

  // ── H. 典雅暖调（人文 / 艺术） ──
  { id: 'wa-elegant-purple', name: '典雅紫', group: '典雅暖调', groupId: 'warm', primary: '5B3A78', onPrimary: 'FFFFFF', coverBg: '5B3A78', lightText: 'D9C9E8', footer: 'A98CC0', body: '3A2E45', subtle: '7A6E8A', bullet: '8E6CB0', font: F, subjects: ['美术', '音乐', '语文'], grades: ['mid', 'high'] },
  { id: 'wa-wine', name: '酒红', group: '典雅暖调', groupId: 'warm', primary: '6E1F2A', onPrimary: 'F3D9C0', coverBg: '6E1F2A', lightText: 'E2C2BC', footer: 'B07A78', body: '3A2622', subtle: '8A6E6A', bullet: 'A85762', font: F, subjects: ['语文', '历史'], grades: ['high'] },
  { id: 'wa-caramel', name: '焦糖棕', group: '典雅暖调', groupId: 'warm', primary: '8A5A2B', onPrimary: 'FFF3E0', coverBg: '8A5A2B', lightText: 'E6CDB0', footer: 'C09A66', body: '3A2E20', subtle: '8A7A66', bullet: 'B07A45', font: F, subjects: ['美术', '历史'], grades: ['mid', 'high'] },
  { id: 'wa-rosegold', name: '玫瑰金', group: '典雅暖调', groupId: 'warm', primary: 'B76E79', onPrimary: 'FFF8F0', coverBg: 'B76E79', lightText: 'F3D9DE', footer: 'D6A0A8', body: '4A383C', subtle: '8A7A7A', bullet: 'D69AA0', font: F, subjects: ['美术', '音乐'], grades: ['mid', 'high'] },
  { id: 'wa-warm-peach', name: '暖橘粉', group: '典雅暖调', groupId: 'warm', primary: 'E08A6B', onPrimary: 'FFFFFF', coverBg: 'E08A6B', lightText: 'FCE4DB', footer: 'E0A98A', body: '4A342E', subtle: '8A746A', bullet: 'C56A4B', font: F, subjects: ['美术', '音乐', '英语'], grades: ['low', 'mid', 'high'] },

  // ── I. 渐变现代（吸睛通用） ──
  { id: 'gr-blue-purple', name: '蓝紫渐变', group: '渐变现代', groupId: 'gradient', primary: '3B49C9', onPrimary: 'FFFFFF', coverBg: '3B49C9', coverGradient: 'linear-gradient(135deg,#3B49C9,#8E44EC)', lightText: 'E0E2FB', footer: '9A9EF0', body: '33333F', subtle: '777787', bullet: '8E44EC', font: F, subjects: ['信息技术', '美术'], grades: ['mid', 'high'] },
  { id: 'gr-orange-pink', name: '橙粉渐变', group: '渐变现代', groupId: 'gradient', primary: 'FF6B6B', onPrimary: 'FFFFFF', coverBg: 'FF6B6B', coverGradient: 'linear-gradient(135deg,#FF8A5B,#FF5C8A)', lightText: 'FFE6EC', footer: 'FFA0AE', body: '4A3036', subtle: '8A7A80', bullet: 'FF5C8A', font: F, subjects: ['美术', '音乐'], grades: ['low', 'mid', 'high'] },
  { id: 'gr-cyan-green', name: '青绿渐变', group: '渐变现代', groupId: 'gradient', primary: '12B8A6', onPrimary: 'FFFFFF', coverBg: '12B8A6', coverGradient: 'linear-gradient(135deg,#12B8A6,#3FA776)', lightText: 'E0F7F2', footer: '8AD0C4', body: '2E3A36', subtle: '7A8A80', bullet: '3FA776', font: F, subjects: ['生物', '科学'], grades: ['low', 'mid', 'high'] },
  { id: 'gr-purple-pink', name: '紫粉渐变', group: '渐变现代', groupId: 'gradient', primary: '8E44EC', onPrimary: 'FFFFFF', coverBg: '8E44EC', coverGradient: 'linear-gradient(135deg,#8E44EC,#8E44EC)', lightText: 'F2E2F8', footer: 'C79AE0', body: '3A2E45', subtle: '7A6E8A', bullet: 'E85FB0', font: F, subjects: ['美术', '音乐'], grades: ['low', 'mid'] },
  { id: 'gr-gold-orange', name: '金橙渐变', group: '渐变现代', groupId: 'gradient', primary: 'F2994A', onPrimary: 'FFFFFF', coverBg: 'F2C94C', coverGradient: 'linear-gradient(135deg,#F2C94C,#F2994A)', lightText: '5A4A12', footer: 'E0B072', body: '4A3E22', subtle: '8A8060', bullet: 'F2994A', font: F, subjects: ['美术', '体育'], grades: ['low', 'mid', 'high'] },
  { id: 'gr-aurora', name: '极光渐变', group: '渐变现代', groupId: 'gradient', primary: '2D9CDB', onPrimary: 'FFFFFF', coverBg: '2D9CDB', coverGradient: 'linear-gradient(135deg,#2D9CDB,#9B51E0,#4CE0B3)', lightText: 'E2F2FB', footer: '9AB8E0', body: '2E3A45', subtle: '7A8A95', bullet: '9B51E0', font: F, subjects: ['信息技术', '物理'], grades: ['mid', 'high'] },

  // ── J. 专项主题（学科定制） ──
  { id: 'sp-party-red', name: '党政红', group: '专项主题', groupId: 'special', primary: 'C0271E', onPrimary: 'FFFFFF', coverBg: 'C0271E', lightText: 'F5D2CE', footer: 'E09A92', body: '333333', subtle: '777777', bullet: 'F2C94C', font: F, subjects: ['政治'], grades: ['mid', 'high'] },
  { id: 'sp-festive', name: '节日红金', group: '专项主题', groupId: 'special', primary: 'B5121B', onPrimary: 'FFE9A8', coverBg: 'B5121B', coverGradient: 'linear-gradient(135deg,#B5121B,#8A0E16)', lightText: 'F5E2AC', footer: 'D9A878', body: '4A2A22', subtle: '8A6A5A', bullet: 'D4AF37', font: F, subjects: ['语文', '政治', '英语'], grades: ['low', 'mid', 'high'] },
  { id: 'sp-cartoon', name: '卡通插画', group: '专项主题', groupId: 'special', primary: '4FB0E5', onPrimary: 'FFFFFF', coverBg: '4FB0E5', coverGradient: 'linear-gradient(135deg,#4FB0E5,#5FD0C0)', lightText: 'EAF7FE', footer: '9CCDE8', body: '2E3A45', subtle: '7A8A95', bullet: 'FF9F43', font: F, subjects: ['英语', '美术', '音乐'], grades: ['low', 'mid'] },
  { id: 'sp-chalkboard', name: '黑板粉笔', group: '专项主题', groupId: 'special', primary: '1B2A1B', onPrimary: 'F5F5F0', coverBg: '1B2A1B', coverGradient: 'linear-gradient(135deg,#1B2A1B,#26331F)', lightText: 'D8E0D0', footer: '9AB08A', body: '2E3A2E', subtle: '6A7A6A', bullet: 'FFE08A', font: F, subjects: ['数学', '物理', '化学', '英语'], grades: ['low', 'mid', 'high'] },
  { id: 'sp-doodle', name: '手绘涂鸦', group: '专项主题', groupId: 'special', primary: 'F4C430', onPrimary: '3A3A3A', coverBg: 'FFD166', coverGradient: 'linear-gradient(135deg,#FFD166,#FFB85C)', lightText: '5A4A12', footer: 'D9B050', body: '3A3A3A', subtle: '8A8A6A', bullet: 'EF476F', font: F, subjects: ['美术', '英语'], grades: ['low', 'mid'] },
]

export const DEFAULT_THEME: CwTheme = THEMES.find(t => t.id === 'min-classic-blue')!

const _byId = new Map(THEMES.map(t => [t.id, t]))
export function getTheme(id: string | undefined): CwTheme {
  if (!id) return DEFAULT_THEME
  return _byId.get(id) || DEFAULT_THEME
}

// ── 学段分级与推荐（按学科 + 年级观感，推荐不强制） ──

export const GRADE_BAND_LABEL: Record<GradeBand, string> = {
  low: '小学低段',
  mid: '小学中高段',
  high: '初高中段',
}

/** 年级数字 → 学段档（1-3 低 / 4-6 中高 / 7+ 初高中） */
export function bandFromGrade(grade: number): GradeBand {
  if (grade <= 3) return 'low'
  if (grade <= 6) return 'mid'
  return 'high'
}

export interface ThemeRecommendation {
  themeId: string
  band: GradeBand
}

/**
 * 按学科 + 年级推荐最贴合的模板（仅推荐，不强制套用）。
 * 打分：学科命中 +3、通用学科 +1；学段命中 +2、全学段 +1；
 * 学科与学段同时命中再 +1（优先精确匹配）。同分时保持稳定顺序。
 */
export function recommendTheme(subject: string, grade: number): ThemeRecommendation {
  const band = bandFromGrade(grade)
  let best: CwTheme = DEFAULT_THEME
  let bestScore = -1
  let bestSubjLen = Infinity
  for (const t of THEMES) {
    const subjHit = !!t.subjects?.length && t.subjects.includes(subject)
    const gradeHit = !!t.grades?.length && t.grades.includes(band)
    let score = 0
    score += subjHit ? 3 : (t.subjects?.length ? 0 : 1)
    score += gradeHit ? 2 : (t.grades?.length ? 0 : 1)
    if (subjHit && gradeHit) score += 1
    // 同分时优先「学科更专一」的主题（subjects 更少 = 更对口），再保数组顺序稳定
    const subjLen = t.subjects?.length ?? 0
    if (score > bestScore || (score === bestScore && subjLen < bestSubjLen)) {
      bestScore = score
      bestSubjLen = subjLen
      best = t
    }
  }
  return { themeId: best.id, band }
}

export interface ThemeGroup {
  id: string
  name: string
  themes: CwTheme[]
}

export const THEME_GROUPS: ThemeGroup[] = (() => {
  const order: string[] = []
  const map = new Map<string, ThemeGroup>()
  for (const t of THEMES) {
    if (!map.has(t.groupId)) {
      map.set(t.groupId, { id: t.groupId, name: t.group, themes: [] })
      order.push(t.groupId)
    }
    map.get(t.groupId)!.themes.push(t)
  }
  return order.map(id => map.get(id)!)
})()

export { THEMES }

// ── 风格标签 → 代表性 themeId 映射（与 cwTemplate.ts 的 StyleTag 对齐） ──
// 仅取每风格下的一个代表配色作为模板默认色；素材积累后可由具体 CwTemplate 覆盖 themeId。
export const DEFAULT_THEME_ID = DEFAULT_THEME.id

export const THEME_BY_STYLE: Partial<Record<string, string>> = {
  china: 'zgf-ink-wash',         // 中国风 → 水墨丹青
  minimal: 'min-classic-blue',   // 简约 → 经典深蓝（= DEFAULT_THEME）
  tech: 'te-quantum-blue',       // 科技风 → 量子蓝
  fresh: 'fr-mint',              // 小清新 → 薄荷绿
  academic: 'aca-edu-blue',      // 学术 → 教研蓝
  cartoon: 'sp-cartoon',         // 卡通 → 卡通插画（专项主题）
  flat: 'min-geo',               // 扁平 → 几何极简（近似）
  business: 'min-navy-intellectual', // 商务 → 知性藏青（近似）
}
