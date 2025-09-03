import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import MainPage from "./pages/MainPage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import { UnityProvider, useUnity } from "./contexts/UnityContext.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";

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
        <nav className="flex items-center justify-between px-4 py-2 mb-4">
  {/* 메뉴: 중앙 정렬 */}
  <div className="flex-1 flex justify-center gap-40 font-yuniverse">
    <Link to="/" >Main</Link>
    <Link to="/editor">Editor</Link>
    {!isAuthenticated && <Link to="/login">Login</Link>}
    {isAuthenticated && <Link to="/dashboard">Dashboard</Link>}
  </div>

  {/* 오른쪽 끝 로그아웃 */}
  {isAuthenticated && (
    <button onClick={logout} className="ml-4 font-yuniverse">
      Logout
    </button>
  )}
</nav>


      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/editor" element={<EditorPage />} />
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

