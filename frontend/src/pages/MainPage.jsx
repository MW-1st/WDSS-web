import {Link} from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // 👈 AuthContext 훅 import


export default function MainPage() {
    // 실제 애플리케이션에서는 이 값을 로그인 시 API로부터 받아오거나
    // 전역 상태(Recoil, Redux 등)에 저장해두고 사용합니다.
    // const recentProjectId = 'project123'; // 예시 ID
    const { isAuthenticated } = useAuth();

    return (
        <section>
            <h1>Main Page</h1>
            <p>여기는 메인 페이지입니다. 상단 메뉴에서 Editor로 이동하세요.</p>

            <div style={{marginTop: '20px'}}>
                {isAuthenticated ? (
                    // isAuth가 true일 경우: 최근 프로젝트의 편집 화면으로 이동
                    <a href="/projects/recent">
                        <button>시작하기</button>
                    </a>
                ) : (
                    // isAuth가 false일 경우: 로그인 페이지로 이동
                    <Link to="/login">
                        <button>로그인하여 시작하기</button>
                    </Link>
                )}
            </div>
        </section>
    );
}
