import {
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useEffect, useState } from "react";
import MainPage from "./pages/MainPage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import LoginModal from "./pages/LoginModal.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import Navbar from "./components/Navbar";
import { UnityProvider, useUnity } from "./contexts/UnityContext.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
//임시
import ProjectStart from "./pages/ProjectStart";


function AppContent() {
  const location = useLocation();
  const background = location.state && location.state.background;
  const navigate = useNavigate();
  const { isUnityVisible, showUnity, hideUnity } = useUnity();
  const { isAuthenticated, logout, loading } = useAuth();

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isUnityVisible) {
        hideUnity();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isUnityVisible, hideUnity]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const unityOverlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 1000,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: isUnityVisible ? "flex" : "none",
    alignItems: "center",
    justifyContent: "center",
  };

  const unityContainerStyle = {
    position: "relative",
    width: "90%",
    height: "90%",
    backgroundColor: "white",
    borderRadius: "8px",
  };

  const closeButtonStyle = {
    position: "absolute",
    top: "10px",
    right: "10px",
    zIndex: 1001,
    padding: "8px 12px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  };

  const iframeStyle = {
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: "8px",
  };

  if (loading) {
    return <div>Loading...</div>;
  }

return (
  <div style={{ padding: 0 }}>
    {/* 메인에서는 전역 Navbar를 숨기고, 다른 페이지에서만 보이게 */}
    {location.pathname !== "/" && <Navbar />}

      <Routes location={background || location}>
      <Route path="/" element={<MainPage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/" element={<ProjectStart />} />
         {!background && (
          <Route
            path="/login"
            element={
              <>
                <MainPage />
                <LoginModal />
              </>
            }
          />
        )}

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
      </Routes>
      {background && (
        <Routes>
          <Route path="/login" element={<LoginModal />} />
        </Routes>
      )}
      <div style={unityOverlayStyle}>
        <div style={unityContainerStyle}>
          <button
            style={closeButtonStyle}
            onClick={() => {
              hideUnity();
            }}
          >
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
