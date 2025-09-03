// src/components/Navbar.jsx
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Navbar({ transparent = false }) {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  // 에디터에서 숨기고 싶으면 유지
  if (location.pathname.startsWith("/editor")) return null;

  const base = "w-full max-w-6xl mx-auto flex items-center justify-between px-6 py-3 font-yuniverse";
  const transparentNav =
    "fixed top-0 inset-x-0 z-50 bg-transparent text-white backdrop-blur-md text-white"; // ← 최상단 + 투명
  const solidNav =
    "sticky top-0 z-20 bg-white/80 backdrop-blur text-gray-900 shadow-sm";      // 일반 페이지

  const navWrap = transparent ? transparentNav : solidNav;

return (
  <div className={navWrap}>
    <nav className={`${base} relative flex items-center h-16 px-8`}>
      {/* 중앙 메뉴 */}
      <div className="absolute left-1/2 -translate-x-1/2 flex gap-40 text-xl pt-1">
        <Link to="/" className="hover:underline hover:underline-offset-4 decoration-2">
          Main
        </Link>
        <Link to="/editor" className="hover:underline hover:underline-offset-4 decoration-2">
          Editor
        </Link>
        {!isAuthenticated && (
          <Link to="/login" className="hover:underline hover:underline-offset-4 decoration-2">
            Login
          </Link>
        )}
        {isAuthenticated && (
          <Link to="/dashboard" className="hover:underline hover:underline-offset-4 decoration-2">
            Dashboard
          </Link>
        )}
      </div>

      {/* 우측 로그아웃 */}
      {isAuthenticated && (
        <div className="ml-auto">
          <button
            onClick={logout}
            className={
              transparent
                ? "px-5 py-2 text-xl font-extrabold rounded bg-white/80 hover:bg-white transition text-transparent bg-clip-text hover:decoration-1 hover:underline hover:decoration-white/80 hover:underline-offset-4"
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
