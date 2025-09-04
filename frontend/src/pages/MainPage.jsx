import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";

export default function MainPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* 배경 */}
      <motion.div
        className="absolute inset-0 -z-20"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 20, ease: "easeInOut", repeat: Infinity }}
        style={{
          backgroundImage:
            "linear-gradient(270deg,#191970 0%,#483D8B 25%,#7B68EE 50%,#FF69B4 75%,#FFFFE0 100%)",
          backgroundSize: "400% 400%",
        }}
      />
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 40%, rgba(0,0,0,0.18), transparent 70%), rgba(0,0,0,0.06)",
        }}
      />

      {/* 메인 전용: 투명 + z-최상단 Navbar */}
      <Navbar transparent />

      {/* 본문 */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 text-center px-6 ">
        <h1 className="text-5xl md:text-6xl font-bold font-tway text-white mix-blend-difference drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          WDSS
        </h1>
        <p className="text-2xl font-yuniverse text-white/95 mix-blend-difference drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] font-bold">
          디자인 없이 이미지로 드론쇼 만들기
        </p>
        {isAuthenticated ? (
          <Link
          to="/dashboard"
            className="px-5 py-2.5 rounded-lg bg-white/85 text-black hover:bg-white transition font-yuniverse font-bold text-lg"
          >
            시작하기
          </Link>
        ) : (
          <Link
            to="/login"
            className="px-4.5 py-2.5 rounded-lg bg-white/85 text-black hover:bg-white transition font-yuniverse font-bold text-lg mt-3"
          >
            로그인하여 시작하기
          </Link>
        )}
      </main>
    </div>
  );
}
