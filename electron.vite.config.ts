import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('src/shared') }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { '@shared': resolve('src/shared'), '@': resolve('src/renderer/src') }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          popup: resolve('src/renderer/src/popup/index.html'),
          settings: resolve('src/renderer/src/settings/index.html'),
          agent: resolve('src/renderer/src/agent/index.html'),
          browser: resolve('src/renderer/src/browser/index.html')
        }
      }
    }
  }
})
