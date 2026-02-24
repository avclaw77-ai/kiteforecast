import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    entry: 'electron/main.ts',
  },
  preload: {
    input: resolve(__dirname, 'electron/preload.ts'),
  },
  renderer: {
    root: 'src',
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/index.html'),
      },
    },
    plugins: [react()],
  },
})
