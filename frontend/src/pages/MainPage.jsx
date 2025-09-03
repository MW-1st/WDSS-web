import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";

export default function MainPage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
      {/* 1) 애니메이션 배경 */}
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

      {/* 2) 가독성용 스크림(배경 살짝 눌러주기) */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 40%, rgba(0,0,0,0.18), transparent 70%), rgba(0,0,0,0.06)",
        }}
      />

      {/* 3) 실제 콘텐츠 */}
      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        {/* mix-blend-difference: 배경에 따라 자동 반전 + drop-shadow로 윤곽 강화 */}
        <h1 className="text-5xl md:text-6xl font-bold font-tway text-white mix-blend-difference drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
          WDSS
        </h1>

        <p className="text-2xl font-yuniverse text-white/95 mix-blend-difference drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
          디자인 없이 이미지로 드론쇼 만들기
        </p>

        {isAuthenticated ? (
          <Link
            to="/projects/recent"
            className="px-5 py-2.5 rounded-lg bg-white/85 text-black hover:bg-white font-yuniverse transition"
          >
            시작하기
          </Link>
        ) : (
          <Link
            to="/login"
            className="px-5 py-2.5 rounded-lg bg-white/85 text-black hover:bg-white font-yuniverse transition"
          >
            로그인하여 시작하기
          </Link>
        )}
      </div>
    </main>
  );
}
