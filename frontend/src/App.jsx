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
import Navbar from "./components/Navbar";
import { UnityProvider, useUnity } from "./contexts/UnityContext.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";

import PrivateRoute from "./routes/PrivateRoute.jsx";
import PublicRoute from "./routes/PublicRoute.jsx";
import ProjectOwnerRoute from "./routes/ProjectOwnerRoute.jsx";

function AppContent() {
  const location = useLocation();
  const background = location.state && location.state.background;
  const navigate = useNavigate();
  const { isUnityVisible, showUnity, hideUnity } = useUnity();
  const { isAuthenticated, logout, loading } = useAuth();
  const showGlobalNav = location.pathname !== "/" && location.pathname !== "/login";
  const isEditorRoute = location.pathname.startsWith("/projects/");
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
    top: "9px",
    right: "9px",
    zIndex: 1001,
    padding: "8px 12px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "extra bold",
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
  <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    {/* 메인에서는 전역 Navbar를 숨기고, 다른 페이지에서만 보이게 */}
    {showGlobalNav && <Navbar />}  
      
  <div style={{ flex: '1 1 auto', position: 'relative', display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: isEditorRoute ? 'hidden' : 'auto' }}>
        <Routes location={background || location}>
          <Route path="/" element={<MainPage />} />
          <Route path="/dashboard" element={<PrivateRoute> <DashboardPage /> </PrivateRoute> }/>
          <Route path="/projects" element={<Navigate to="/dashboard" replace />}/>
          <Route path="/projects/:project_id" element={<ProjectOwnerRoute> <EditorPage /> </ProjectOwnerRoute>}/>
           {!background && (
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <MainPage />
                  <LoginModal />
                </PublicRoute>
              }
            />
          )}
        </Routes>
        {background && (
          <Routes>
            <Route path="/login" element={<LoginModal />} />
          </Routes>
        )}
      </div>

      <div style={unityOverlayStyle}>
        <div style={unityContainerStyle}>
          <button
            style={closeButtonStyle}
            onClick={() => {
              hideUnity();
            }}
          >
            ✕
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
