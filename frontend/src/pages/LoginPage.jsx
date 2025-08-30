import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // OAuth2PasswordRequestForm expects x-www-form-urlencoded body
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);

      const { data } = await client.post("/auth/login", body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (data?.access_token) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("token_type", data.token_type || "bearer");
        navigate("/dashboard");
      } else {
        setError("Unexpected response from server.");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "48px auto", padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            <div>Username</div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <label>
            <div>Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              style={{ width: "100%", padding: 8 }}
            />
          </label>

          <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
      </form>
      {error && (
        <div style={{ color: "#b00020", marginTop: 12 }} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

