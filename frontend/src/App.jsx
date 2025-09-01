import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import MainPage from "./pages/MainPage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import { UnityProvider, useUnity } from "./contexts/UnityContext.jsx";

function AppContent() {
  const navigate = useNavigate();
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem("token"));
  const { isUnityVisible, showUnity, hideUnity } = useUnity();

  useEffect(() => {
    const handler = () => setIsAuth(!!localStorage.getItem("token"));
    window.addEventListener("auth-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("auth-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isUnityVisible) {
        hideUnity();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isUnityVisible, hideUnity]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("token_type");
    window.dispatchEvent(new Event("auth-change"));
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

  return (
    <div style={{ padding: 16 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <Link to="/">Main</Link>
        <Link to="/editor">Editor</Link>
        {!isAuth && <Link to="/login">Login</Link>}
        {isAuth && <Link to="/dashboard">Dashboard</Link>}
        
        {isAuth && (
          <button onClick={logout} style={{ marginLeft: "auto" }}>
            Logout
          </button>
        )}

      </nav>

      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route
          path="/login"
          element={isAuth ? <Navigate to="/dashboard" replace /> : <LoginPage />}
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
    <UnityProvider>
      <AppContent />
    </UnityProvider>

);
}

