import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import MainPage from "./pages/MainPage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SimulatorPage from "./pages/SimulatorPage.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";

//임시
import ProjectStart from "./pages/ProjectStart";

export default function App() {
  const navigate = useNavigate();
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    const handler = () => setIsAuth(!!localStorage.getItem("token"));
    window.addEventListener("auth-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("auth-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("token_type");
    window.dispatchEvent(new Event("auth-change"));
    navigate("/");
  };

  return (
    <div style={{ padding: 16 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/">Main</Link>
        <Link to="/editor">Editor</Link>
        {!isAuth && <Link to="/login">Login</Link>}
        {isAuth && <Link to="/dashboard">Dashboard</Link>}
        {isAuth && <Link to="/simulator">Simulator</Link>}
        {isAuth && (
          <button onClick={logout} style={{ marginLeft: "auto" }}>
            Logout
          </button>
        )}

      </nav>

      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        {/* 임시 */}
        <Route path="/" element={<ProjectStart />} />
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
    </div>
  );
}

