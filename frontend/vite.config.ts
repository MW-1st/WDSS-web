import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // FastAPI 백엔드 서버 주소
        changeOrigin: true, // CORS 에러 방지를 위해 필요한 설정
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})