import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',   // 외부 접속 허용
    port: 5173,        // 개발 서버 포트 (변경 가능)
    allowedHosts: [
      'wdss.store',    // 도메인 허용
    ],
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
      },
      '/thumbnails': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    },
  },
})