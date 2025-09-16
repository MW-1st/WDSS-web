import axios from "axios";

let isRedirecting = false;

const client = axios.create({
  // baseURL을 '/api'로 변경하여 Vite 프록시를 통하도록 합니다.
  baseURL: "/api",

  // 쿠키 기반 인증을 위해 이 옵션은 반드시 필요합니다.
  withCredentials: true,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      const currentPath = window.location.pathname;

      // 이미 메인페이지이거나 로그인 모달이 열려있으면 리디렉션 안함
      if (currentPath === '/' || currentPath === '/login') {
        // 대신 전역 상태나 이벤트로 로그인 필요함을 알림
        window.dispatchEvent(new CustomEvent('auth-required'));
        return Promise.reject(error);
      }

      isRedirecting = true;
      window.location.href = '/';
      setTimeout(() => { isRedirecting = false; }, 1000);
    }
    return Promise.reject(error);
  }
);

export default client;