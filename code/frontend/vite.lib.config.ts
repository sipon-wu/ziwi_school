import { defineConfig } from 'vite'
import { resolve } from 'path'

// 临时：把绘本 H5 工具库打包成可 Node import 的 ESM（用于本地生成《购物》H5）
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib/courseware-h5/index.ts'),
      formats: ['es'],
      fileName: () => 'courseware-h5.mjs',
    },
    outDir: resolve(__dirname, '../../qa/dist-h5'),
    emptyOutDir: true,
    minify: false,
  },
})
