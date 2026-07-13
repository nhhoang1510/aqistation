"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f4c75 70%, #1b262c 100%)"
      }}>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }} />
        <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }} />
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <div key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full"
            style={{
              top: `${15 + i * 15}%`,
              left: `${10 + i * 14}%`,
              animation: `float ${3 + i * 0.5}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.3}s`
            }}
          />
        ))}
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Glassmorphism Card */}
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-3xl shadow-2xl p-8 md:p-10"
          style={{ boxShadow: "0 8px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}>

          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
                boxShadow: "0 8px 32px rgba(16,185,129,0.3)"
              }}>
              <span className="text-4xl">🌿</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">AQI Station</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Hệ thống quan trắc chất lượng không khí<br />
              <span className="text-slate-500">Air Quality Monitoring Dashboard</span>
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Đăng nhập</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-[15px] transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: loading
                ? "rgba(255,255,255,0.05)"
                : "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
              boxShadow: "0 2px 16px rgba(0,0,0,0.2)"
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.3)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 16px rgba(0,0,0,0.2)";
              }
            }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span>{loading ? "Đang đăng nhập..." : "Đăng nhập với Google"}</span>
          </button>

          {/* Info text */}
          <p className="text-center text-slate-500 text-xs mt-6 leading-relaxed">
            Đăng nhập lần đầu sẽ tự động tạo tài khoản.<br />
            Hỗ trợ nhận cảnh báo AQI qua email.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          © 2026 AQI Station — Nhóm 22, HUST
        </p>
      </div>

      <style jsx>{`
        @keyframes float {
          from { transform: translateY(0px) scale(1); opacity: 0.3; }
          to { transform: translateY(-20px) scale(1.5); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
