"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

const navItems = [
  {
    href: "/", label: "Trang chủ",
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>
  },
  {
    href: "/history", label: "Lịch sử dữ liệu",
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
  },
  {
    href: "/map", label: "Bản đồ trạm",
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  },
  {
    href: "/settings", label: "Cài đặt cảnh báo",
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
  },
];

// ── Auth Modal ──────────────────────────────────────────────────
function AuthModal({ onClose }) {
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setLoading(false); return; }
        // Auto login after register
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(tab === "login" ? "Email hoặc mật khẩu không đúng." : "Đăng ký thất bại.");
      } else {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-gray-900">
                {tab === "login" ? "Đăng nhập" : "Đăng ký"}
              </h2>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {["login", "register"].map((t) => (
                <button key={t} onClick={() => { setTab(t); setError(""); }}
                  className={`flex-1 py-1.5 text-[12.5px] font-medium rounded-md transition-all cursor-pointer ${
                    tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t === "login" ? "Đăng nhập" : "Đăng ký"}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-5 space-y-3">
            {/* Google */}
            <button onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Tiếp tục với Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400">hoặc</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Form */}
            <form onSubmit={handleCredentials} className="space-y-3">
              {tab === "register" && (
                <input
                  type="text" placeholder="Họ và tên" required
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
                />
              )}
              <input
                type="email" placeholder="Email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
              />
              <input
                type="password" placeholder="Mật khẩu" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-[13px] text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 transition-all"
              />

              {error && <p className="text-[12px] text-red-500">{error}</p>}

              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-medium rounded-xl transition-colors disabled:opacity-50 cursor-pointer">
                {loading ? "Đang xử lý..." : tab === "login" ? "Đăng nhập" : "Tạo tài khoản"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Navbar ──────────────────────────────────────────────────
export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authModal, setAuthModal]     = useState(false);

  const UserSection = () => {
    if (status === "loading") return <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse" />;

    if (status === "authenticated" && session?.user) return (
      <div className="relative">
        <button onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1.5 rounded-lg transition-colors cursor-pointer">
          {session.user.image
            ? <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
            : <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-semibold">
                {session.user.name?.[0]?.toUpperCase()}
              </div>
          }
          <span className="text-[13px] font-medium text-gray-700 max-w-[120px] truncate hidden sm:block">{session.user.name}</span>
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {profileOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-gray-100">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{session.user.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{session.user.email}</p>
              </div>
              <button onClick={() => { signOut(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-[12.5px] text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Đăng xuất
              </button>
            </div>
          </>
        )}
      </div>
    );

    return (
      <button onClick={() => setAuthModal(true)}
        className="flex items-center gap-2 px-3.5 py-1.5 border border-gray-200 rounded-lg text-[12.5px] font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer bg-white shadow-sm">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Đăng nhập
      </button>
    );
  };

  return (
    <>
      {/* ─── Top header bar ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-white border-b border-gray-200 flex items-center px-4 md:pl-[256px]">
        <button onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-1.5 mr-2 rounded-lg hover:bg-gray-100 cursor-pointer text-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
        <span className="md:hidden text-[13px] font-semibold text-gray-800 mr-auto">AQI Station</span>
        <div className="hidden md:block flex-1" />
        <UserSection />
      </header>

      {/* Mobile overlay */}
      {mobileOpen && <div className="md:hidden fixed inset-0 bg-black/20 z-40 top-12" onClick={() => setMobileOpen(false)} />}

      {/* ─── Sidebar ─── */}
      <aside className={`fixed top-12 left-0 h-[calc(100vh-48px)] z-40 w-[240px] bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-gray-900 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-[14px] tracking-tight">AQI Station</span>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2.5">Điều hướng</p>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}>
                <span className={isActive ? "text-white" : "text-gray-400"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ─── Auth Modal ─── */}
      {authModal && <AuthModal onClose={() => setAuthModal(false)} />}
    </>
  );
}
