import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src'), '@shared': path.resolve(__dirname, '../shared') } },
  server: { port: 5173, proxy: { '/api': { target: 'https://school1.ziwi.cn', changeOrigin: true, secure: false } } },
  build: {
    // KnowledgeGraph(@antv/g6) 等重库体积大，拆独立 chunk 降低主包体积
    // 注意：vite v8 使用 rolldown，manualChunks 仅支持函数式（对象式会构建失败）
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('@antv')) return 'g6'
            if (id.includes('pptxgenjs') || id.includes('docx') || id.includes('mammoth') || id.includes('html-to-image') || id.includes('marked')) return 'office'
            if (id.includes('recharts')) return 'charts'
            if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/') || id.includes('scheduler')) return 'react-vendor'
          }
        },
      },
    },
  },
})
