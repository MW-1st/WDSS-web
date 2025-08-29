import { Routes, Route, Link } from "react-router-dom";
import MainPage from "./pages/MainPage.jsx";
import EditorPage from "./pages/EditorPage.jsx";

export default function App() {
  return (
    <div style={{ padding: 16 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <Link to="/">Main</Link>
        <Link to="/editor">Editor</Link>
      </nav>

      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </div>
  );
}
