import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Navbar() {
  const location = useLocation();
  const { isAuthenticated, logout } = useAuth();

  if (location.pathname.startsWith("/editor")) {
    return null;
  }

  return (
    <nav className="flex items-center justify-between px-4 py-2 mb-4">
      <div className="flex-1 flex justify-center gap-40 font-yuniverse">
        <Link to="/">Main</Link>
        <Link to="/editor">Editor</Link>
        {!isAuthenticated && <Link to="/login">Login</Link>}
        {isAuthenticated && <Link to="/dashboard">Dashboard</Link>}
      </div>

      {isAuthenticated && (
        <button onClick={logout} className="ml-4 font-yuniverse">
          Logout
        </button>
      )}
    </nav>
  );
}
