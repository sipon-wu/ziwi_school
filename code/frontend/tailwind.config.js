/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1A3A6B',
          hover: '#2B5DA8',
          dark: '#1E3A5F',
          light: 'rgba(26,58,107,0.08)',
        },
        sidebar: '#212529',
        page: '#F0F2F5',
        border: '#E4E7ED',
        // 语义色 Token（小艺建议）
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#6366F1',
        // 标签颜色体系
        label: {
          // 学科标签色
          subject: {
            chinese: { bg: '#EFF6FF', text: '#2563EB' },
            math: { bg: '#FFF7ED', text: '#EA580C' },
            english: { bg: '#F0FDF4', text: '#16A34A' },
          },
          // 状态标签（统一草稿为黄色）
          status: {
            final: { dot: '#10B981', bg: '#ECFDF5', text: '#059669' },
            draft: { dot: '#F59E0B', bg: '#FFFBEB', text: '#B45309' },
            review: { dot: '#6366F1', bg: '#EEF2FF', text: '#4F46E5' },
          },
          // 难度标签
          difficulty: {
            L1: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
            L2: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
            L3: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
          },
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
