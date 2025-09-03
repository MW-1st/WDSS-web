import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import MainPage from "./pages/MainPage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import { UnityProvider, useUnity } from "./contexts/UnityContext.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
//임시
import ProjectStart from "./pages/ProjectStart";

function AppContent() {
  const navigate = useNavigate();
  const { isUnityVisible, showUnity, hideUnity } = useUnity();
  const { isAuthenticated, logout, loading } = useAuth();

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isUnityVisible) {
        hideUnity();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isUnityVisible, hideUnity]);

  const handleLogout = async () => {
    await logout(); // 👈 Context에 있는 진짜 로그아웃 로직을 호출
    navigate("/");
  };

  const unityOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: isUnityVisible ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const unityContainerStyle = {
    position: 'relative',
    width: '90%',
    height: '90%',
    backgroundColor: 'white',
    borderRadius: '8px'
  };

  const closeButtonStyle = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: 1001,
    padding: '8px 12px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  };

  const iframeStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    borderRadius: '8px'
  };

  if (loading) {
    return <div>Loading...</div>;
  }


  return (
    <div style={{ padding: 16 }}>
     <nav className="relative w-full flex items-center justify-center py-3 mb-4 text-left ">
  {/* 중앙 메뉴 */}
  <div className="flex gap-40 font-yuniverse text-xl">
    <Link to="/" className="hover:text-[#5c64ed]">Main</Link>
    <Link to="/editor" className="hover:text-[#5c64ed]">Editor</Link>
    {!isAuthenticated && <Link to="/login" className="hover:text-[#5c64ed]">Login</Link>}
    {isAuthenticated && <Link to="/dashboard" className="hover:text-[#5c64ed]">Dashboard</Link>}
  </div>

  {/* 로그아웃: 우측 끝 + 수직 중앙 + 확실한 스타일 */}
  {isAuthenticated && (
    <button
      onClick={logout}
      className="
        absolute right-4 top-1/2 -translate-y-1/2
        px-4 py-2 rounded-md
        bg-[#646cff] text-white hover:bg-[#5c64ed]
        shadow-sm
        font-yuniverse
      "
    >
      Logout
    </button>
  )}
</nav>




      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/editor" element={<EditorPage />} />
        {/* 임시 */}
        <Route path="/" element={<ProjectStart />} />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />

      </Routes>

      {/* Persistent Unity iframe */}
      <div style={unityOverlayStyle}>
        <div style={unityContainerStyle}>
          <button style={closeButtonStyle} onClick={() => { hideUnity(); }}>
            ✕ 닫기
          </button>
          <iframe
            src="/unity-build/index.html"
            style={iframeStyle}
            title="Unity WebGL Simulator"
          />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
      <AuthProvider>
        <UnityProvider>
          <AppContent />
        </UnityProvider>
      </AuthProvider>
);
}

