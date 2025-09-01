import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 👇 이 server.proxy 설정을 추가합니다.
  server: {
    proxy: {
      // '/api'로 시작하는 요청은 전부 target으로 전달합니다.
      '/api': {
        target: 'http://localhost:8000', // FastAPI 백엔드 서버 주소
        changeOrigin: true, // CORS 에러 방지를 위해 필요한 설정
        // target으로 요청을 보낼 때 '/api' 부분을 제거합니다.
        // 예: /api/auth/login -> http://localhost:8000/auth/login
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})