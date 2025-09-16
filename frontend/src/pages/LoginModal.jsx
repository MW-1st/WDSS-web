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
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState("login");
  const [verificationToken, setVerificationToken] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { login } = useAuth();

  // SSE 연결 관리
  useEffect(() => {
    let eventSource = null;

    if (emailSent && email && !tokenValidated) {
      eventSource = new EventSource(`/api/auth/verification-stream/${encodeURIComponent(email)}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.status === 'verified') {
            setVerificationToken(data.token);
            setTokenValidated(true);
            setSuccess('✅ Email verified! Please complete your registration.');
            setResendCooldown(0); // 인증 완료 시 쿨다운 초기화
            eventSource.close();
          }
        } catch (e) {
          console.error('Error parsing SSE data:', e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [emailSent, email, tokenValidated]);

  const close = () => navigate(-1);

  // 재발송 쿨다운 타이머
  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

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

  // 이메일 인증 발송
  const handleSendVerification = async () => {
    if (!email) {
      setError("Please enter your email first");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const { data } = await client.post("/auth/send-verification", { email });
      setSuccess(data.message);
      setEmailSent(true);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  // 이메일 재발송
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const { data } = await client.post("/auth/resend-verification", { email });
      setSuccess(data.message);
      setResendCooldown(60); // 60초 쿨다운
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 429) {
        // 429 상태코드는 재발송 제한
        setError(detail || "Please wait before resending");
        // 에러 메시지에서 남은 시간 추출
        const match = detail?.match(/(\d+) seconds/);
        if (match) {
          setResendCooldown(parseInt(match[1]));
        }
      } else {
        setError(typeof detail === "string" ? detail : "Failed to resend verification email.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // 이메일 인증이 필요한지 확인
    if (!tokenValidated) {
      setError("Please verify your email first");
      return;
    }

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
      <div className="w-full max-w-md md:max-w-lg rounded-2xl bg-white/70 shadow-xl ring-1 ring-black/5 overflow-hidden">
        {/* 헤더 (탭 + 닫기) */}
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex gap-2 font-yuniverse">
      <button
        onClick={() => {
          setMode("login");
          setError("");
          setSuccess("");
        }}
        className={`px-3 py-1.5 rounded text-sm transition ${
          mode === "login"
            ? "bg-white shadow font-bold text-gray-900"
            : "bg-transparent hover:bg-gray-100 text-gray-600"
        }`}
      >
        Login
      </button>
      <button
        onClick={() => {
          setMode("register");
          setError("");
          setSuccess("");
          setEmailSent(false);
          setVerificationToken("");
          setTokenValidated(false);
          setResendCooldown(0);
        }}
        className={`px-3 py-1.5 rounded text-sm transition ${
          mode === "register"
            ? "bg-white shadow font-bold text-gray-900"
            : "bg-transparent hover:bg-gray-100 text-gray-600"
        }`}
      >
      Register
      </button>
    </div>

          <button
            onClick={close}
            aria-label="Close"
            className="rounded py-0.5 px-2 text-gray-500 hover:bg-gray-100 "
          >
            ✕
          </button>
        </div>

        {/* 본문: 높이 제한 + 스크롤 */}
        <div className="px-5 pb-5 overflow-y-auto max-h-[74vh] font-yuniverse">
          {mode === "login" ? (
            <>
              <h2 className="mt-3 mb-3 text-3xl font-black  text-gray-900">
                Login
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-lg font-bold">Username</div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    className="w-full rounded border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-lg font-bold">Password</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full rounded border border-gray-200 px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-1.5 rounded bg-[#646cff] hover:bg-[#5c64ed] text-white py-1.5 font-yuniverse transition font-bold text-lg"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="mt-3 mb-3 text-3xl font-bold font-yuniverse text-gray-900">
                Register
              </h2>
              <form onSubmit={handleRegister} className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-lg font-bold flex items-center justify-between">
                    Email
                    {!emailSent && !tokenValidated && (
                      <button
                        type="button"
                        onClick={handleSendVerification}
                        disabled={loading || !email}
                        className="px-2 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white transition"
                      >
                        Send Verification
                      </button>
                    )}
                    {tokenValidated && (
                      <span className="text-xs text-green-600 font-bold">✅ Verified</span>
                    )}
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                    required
                    disabled={tokenValidated}
                    className={`w-full rounded border px-3 py-2 ${
                      tokenValidated
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200"
                    }`}
                  />
                </label>

                {emailSent && !tokenValidated && (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-blue-800 text-sm font-medium mb-1">
                        📧 Verification email sent!
                      </div>
                      <div className="text-blue-600 text-xs mb-2">
                        Click the link in your email to verify automatically.
                      </div>

                      {/* 재발송 버튼 */}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Didn't receive it?
                        </div>
                        <button
                          type="button"
                          onClick={handleResendVerification}
                          disabled={loading || resendCooldown > 0}
                          className="px-3 py-1 text-xs rounded bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white transition font-medium"
                        >
                          {resendCooldown > 0
                            ? `Resend in ${resendCooldown}s`
                            : loading
                              ? "Sending..."
                              : "Resend Email"
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {tokenValidated && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-green-800 text-sm font-medium">
                      ✅ Email verification completed!
                    </div>
                  </div>
                )}

                <label className="block">
                  <div className="mb-1 text-lg font-bold">Username</div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    required
                    minLength={3}
                    maxLength={32}
                    className="w-full rounded border border-gray-200 px-3 py-2"
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-lg font-bold">Password</div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    minLength={8}
                    maxLength={128}
                    className="w-full rounded border border-gray-200 px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || !tokenValidated}
                  className="w-full mt-1.5 rounded bg-[#646cff] hover:bg-[#5c64ed] disabled:bg-gray-400 text-white py-1.5 font-yuniverse transition font-bold text-lg"
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

          {success && (
            <div className="text-green-600 mt-3 text-sm" role="alert">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
