// src/components/Navbar.jsx
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Navbar({ transparent: propTransparent = false }) {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  // 라우트 기반으로 자동 투명 처리할 페이지들
  const routeTransparent =
    location.pathname === "/" || location.pathname === "/login";

  // props와 route 기반 판단을 합쳐서 최종 결정
  const transparent = propTransparent || routeTransparent;

  // /editor 페이지에서는 nav 숨김
  if (location.pathname.startsWith("/editor")) return null;

  const base =
    "w-full max-w-6xl mx-auto flex items-center justify-between px-6 py-3 font-yuniverse";

  const transparentNav =
    "fixed top-0 inset-x-0 z-50 bg-transparent backdrop-blur-md text-white";

  const solidNav =
    "sticky top-0 z-20 bg-white/80 backdrop-blur text-gray-900 shadow-sm";

  const navWrap = transparent ? transparentNav : solidNav;

  return (
    <div className={navWrap}>
      <nav className={`${base} relative flex items-center h-16 px-8 font-bold`}>
        {/* 중앙 메뉴 */}
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-40 text-xl pt-1">
          <Link className="hover:underline underline-offset-4 decoration-2" to="/">
            Main
          </Link>
          <Link
            className="hover:underline underline-offset-4 decoration-2"
            to="/editor"
          >
            Editor
          </Link>
          {!isAuthenticated && (
            <Link
              className="hover:underline underline-offset-4 decoration-2"
              to="/login"
              state={{ background: location }} // ← 메인 위 모달 띄우기용
            >
              Login
            </Link>
          )}
          {isAuthenticated && (
            <Link
              className="hover:underline underline-offset-4 decoration-2"
              to="/dashboard"
            >
              Dashboard
            </Link>
          )}
        </div>

        {/* 우측 로그아웃 */}
        {isAuthenticated && (
          <div className="ml-auto" >
            <button
              onClick={logout}
              className={
                transparent
                  ? "px-5 py-2 text-xl font-extrabold rounded bg-white/80 hover:bg-white transition text-transparent bg-clip-text hover:underline underline-offset-4 decoration-2 decoration-white"
                  : "px-5 py-2 text-lg rounded bg-gray-900 hover:bg-black text-white transition"
              }
            >
              Logout
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
