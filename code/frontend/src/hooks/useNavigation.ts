import { useState, useCallback } from 'react'
import {
  LayoutDashboard, FileText, PenLine, FileSearch,
  BookOpen, CheckSquare, UserCheck,
  BarChart3, TrendingUp, Settings, Shield,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

export interface NavGroup {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
}

/**
 * 导航分组定义
 * 工作台固定顶部不参与分组，个人设置固定底部
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'teaching-prep',
    label: '教学备课',
    icon: FileText,
    items: [
      { to: '/dashboard/lesson-plans', icon: FileText, label: '教案备课' },
      { to: '/dashboard/compositions', icon: PenLine, label: '习作指导' },
      { to: '/dashboard/reviews', icon: FileSearch, label: '教案互审' },
    ],
  },
  {
    id: 'homework',
    label: '作业练习',
    icon: BookOpen,
    items: [
      { to: '/dashboard/exercises', icon: BookOpen, label: '出题组卷' },
      { to: '/dashboard/question-bank', icon: BookOpen, label: '题库管理' },
      { to: '/dashboard/grading', icon: CheckSquare, label: '批阅管理' },
    ],
  },
  {
    id: 'data',
    label: '教学数据',
    icon: BarChart3,
    items: [
      { to: '/dashboard/analytics', icon: BarChart3, label: '班级学情' },
      { to: '/dashboard/principal', icon: TrendingUp, label: '校长仪表盘' },
    ],
  },
  {
    id: 'family',
    label: '家校沟通',
    icon: UserCheck,
    items: [
      { to: '/dashboard/parent-sign', icon: UserCheck, label: '家长签字' },
      { to: '/dashboard/admin', icon: Shield, label: '系统管理' },
    ],
  },
]

/** 工作台 - 固定顶部，不参与分组 */
export const WORKBENCH_ITEM: NavItem = {
  to: '/dashboard',
  icon: LayoutDashboard,
  label: '工作台',
}

/** 个人设置 - 固定底部，不参与分组 */
export const SETTINGS_ITEM: NavItem = {
  to: '/dashboard/settings',
  icon: Settings,
  label: '个人设置',
}

/**
 * useNavigation — 统一管理导航分组数据与手风琴状态
 * SideBar 和 HamburgerSheet 共享同一份数据源
 */
export function useNavigation() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(NAV_GROUPS.map(g => g.id)))

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const isExpanded = useCallback((groupId: string) => expandedGroups.has(groupId), [expandedGroups])

  /** 判断某个路径是否在某个分组中（路由匹配用） */
  const isPathInGroup = useCallback((pathname: string, group: NavGroup): boolean => {
    return group.items.some(item => pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to)))
  }, [])

  return {
    groups: NAV_GROUPS,
    workbench: WORKBENCH_ITEM,
    settings: SETTINGS_ITEM,
    expandedGroups,
    toggleGroup,
    isExpanded,
    isPathInGroup,
  }
}
