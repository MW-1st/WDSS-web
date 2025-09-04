// src/pages/LoginModal.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";

export default function LoginModal() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("login");
  const { login } = useAuth();

  const close = () => navigate(-1);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);
      const { data } = await client.post("/auth/login", body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (data?.user) {
        login(data.user);
        navigate("/dashboard", { replace: true });
      } else setError("Unexpected response from server.");
    } catch (err) {
      const msg = err?.response?.data?.detail || "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = { email, username, password };
      const { data: reg } = await client.post("/auth/register", payload, {
        headers: { "Content-Type": "application/json" },
      });
      if (!reg?.id) {
        setError("Registration failed. Try again.");
        setLoading(false);
        return;
      }
      // auto-login
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);
      const { data } = await client.post("/auth/login", body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (data?.user) {
        login(data.user);
        navigate("/dashboard", { replace: true });
      } else {
        setError("Registered, but auto-login failed. Please login.");
        setMode("login");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Registration failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/25 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      {/* 카드 */}
      <div className="w-full max-w-md md:max-w-lg rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden">
        {/* 헤더 (탭 + 닫기) */}
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("login")}
              disabled={mode === "login"}
              className={`px-3 py-1.5 rounded text-sm ${
                mode === "login"
                  ? "bg-gray-200 cursor-not-allowed"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode("register")}
              disabled={mode === "register"}
              className={`px-3 py-1.5 rounded text-sm ${
                mode === "register"
                  ? "bg-gray-200 cursor-not-allowed"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Register
            </button>
          </div>

          <button
            onClick={close}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* 본문: 높이 제한 + 스크롤 */}
        <div className="px-5 pb-5 overflow-y-auto max-h-[74vh]">
          {mode === "login" ? (
            <>
              <h2 className="mt-3 mb-3 text-xl font-bold font-yuniverse text-gray-900">
                Login
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-sm">Username</div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Password</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1.5 rounded bg-[#646cff] hover:bg-[#5c64ed] text-white py-2 font-yuniverse transition"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="mt-3 mb-3 text-xl font-bold font-yuniverse text-gray-900">
                Register
              </h2>
              <form onSubmit={handleRegister} className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-sm">Email</div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                    required
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Username</div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    required
                    minLength={3}
                    maxLength={32}
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-sm">Password</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    minLength={8}
                    maxLength={128}
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1.5 rounded bg-[#646cff] hover:bg-[#5c64ed] text-white py-2 font-yuniverse transition"
                >
                  {loading ? "Registering..." : "Create Account"}
                </button>
              </form>
            </>
          )}

          {error && (
            <div className="text-[#b00020] mt-3 text-sm" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
