import {Link} from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // 👈 AuthContext 훅 import


export default function MainPage() {
    // 실제 애플리케이션에서는 이 값을 로그인 시 API로부터 받아오거나
    // 전역 상태(Recoil, Redux 등)에 저장해두고 사용합니다.
    // const recentProjectId = 'project123'; // 예시 ID
    const { isAuthenticated } = useAuth();

    return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-5xl md:text-6xl font-bold text-white font-tway">WDSS</h1>
      <p className="text-gray-300 text-2xl font-bold text-center font-yuniverse">
        디자인 없이 이미지로 드론쇼 만들기
      </p>

      {isAuthenticated ? (
        <Link 
          to="/projects/recent"
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition font-yuniverse"
        >
          시작하기
        </Link>
      ) : (
        <Link
          to="/login"
          className="px-5 py-2.5 rounded-lg bg-zinc-700 text-white hover:bg-zinc-600 transition font-yuniverse"
        >
          로그인하여 시작하기
        </Link>
      )}
    </main>
    );
}
