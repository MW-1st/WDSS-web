import { Routes, Route, Link } from "react-router-dom";
import MainPage from "./pages/MainPage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";

export default function App() {
  return (
    <div style={{ padding: 16 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/">Main</Link>
        <Link to="/editor">Editor</Link>
        <Link to="/login">Login</Link>
        <Link to="/dashboard">Dashboard</Link>
      </nav>

      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </div>
  );
}
