import axios from "axios";

const client = axios.create({
  // 👇 [수정] baseURL을 '/api'로 변경하여 Vite 프록시를 통하도록 합니다.
  baseURL: "/api",

  // 👇 쿠키 기반 인증을 위해 이 옵션은 반드시 필요합니다.
  withCredentials: true,
});

// 👇 [삭제] localStorage에서 토큰을 읽어 헤더에 추가하던 인터셉터는
// 쿠키 방식에서는 더 이상 필요 없으므로 완전히 삭제합니다.

export default client;