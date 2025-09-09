import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // 이미지 경로들도 프록시 추가
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/processed': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/originals': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    },
  },
})