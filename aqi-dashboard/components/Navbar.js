"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "Trang chủ" },
  { href: "/history", label: "Lịch sử dữ liệu" },
  { href: "/map", label: "Bản đồ trạm" },
  { href: "/settings", label: "Cài đặt cảnh báo" },
];

// ── Auth Modal ──────────────────────────────────────────────────
function AuthModal({ onClose }) {
  const [tab, setTab] = useState("login");
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
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
          <div className="px-6 pt-6 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-gray-900">
                {tab === "login" ? "Đăng nhập" : "Đăng ký"}
              </h2>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {["login", "register"].map((t) => (
                <button key={t} onClick={() => { setTab(t); setError(""); }}
                  className={`flex-1 py-1.5 text-[12.5px] font-semibold rounded-md transition-all cursor-pointer ${
                    tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t === "login" ? "Đăng nhập" : "Đăng ký"}
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 py-5 space-y-3">
            <button onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 border border-gray-200 rounded-xl text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer shadow-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Tiếp tục với Google
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[11px] text-gray-400 font-medium">hoặc dùng email</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {error && <p className="text-[12px] text-red-500 font-medium bg-red-50 p-2.5 rounded-lg border border-red-100 text-center">{error}</p>}

            <form onSubmit={handleCredentials} className="space-y-3">
              {tab === "register" && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Họ và tên</label>
                  <input type="text" placeholder="Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} required
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-gray-900 transition-colors" />
                </div>
              )}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-gray-900 transition-colors" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Mật khẩu</label>
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-gray-900 transition-colors" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-[13px] font-bold rounded-xl transition-colors cursor-pointer shadow-md shadow-gray-900/10">
                {loading ? "Đang xử lý..." : tab === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authModal, setAuthModal] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertLogs, setAlertLogs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAlertLogs = async () => {
    try {
      const res = await fetch('/api/alert/history?limit=20');
      const data = await res.json();
      if (data.success) {
        setAlertLogs(data.logs || []);
        setUnreadCount((data.logs || []).length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAlertLogs();
    const interval = setInterval(fetchAlertLogs, 15000);
    return () => clearInterval(interval);
  }, []);

  const NotificationBell = () => (
    <div className="relative">
      <button
        onClick={() => {
          setAlertOpen(!alertOpen);
          if (!alertOpen) setUnreadCount(0);
        }}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer relative"
        title="Lịch sử thông báo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
        )}
      </button>

      {alertOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAlertOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-gray-900">LỊCH SỬ CẢNH BÁO</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-600 rounded-full">
                  {alertLogs.length}
                </span>
              </div>
              <button onClick={() => fetchAlertLogs()} className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                Làm mới
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {alertLogs.length > 0 ? (
                alertLogs.map((log, index) => {
                  const timeStr = new Date(log.timestamp).toLocaleString("vi-VN", {
                    hour: "2-digit", minute: "2-digit", second: "2-digit",
                    day: "2-digit", month: "2-digit", year: "numeric"
                  });
                  return (
                    <div key={log._id || index} className="p-3.5 hover:bg-gray-50/80 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-[13px] font-bold text-gray-900">AQI: {log.aqi}</span>
                          <span className="px-2 py-0.5 text-[10.5px] font-bold rounded-md bg-red-100 text-red-700">
                            {log.level}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-gray-400 font-medium">{timeStr}</span>
                      </div>
                      <p className="text-[12px] text-gray-600 leading-snug">{log.message}</p>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-[12.5px] text-gray-400 font-medium">
                  Chưa có lịch sử cảnh báo nào
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const UserSection = () => {
    if (status === "loading") return <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />;

    if (status === "authenticated" && session?.user) return (
      <div className="relative">
        <button onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 hover:bg-gray-100 p-1.5 rounded-xl transition-colors cursor-pointer">
          {session.user.image
            ? <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
            : <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-[11px] font-bold">
                {session.user.name?.[0]?.toUpperCase() || "U"}
              </div>
          }
          <span className="text-[13px] font-bold text-gray-800 max-w-[100px] truncate hidden md:block">{session.user.name}</span>
        </button>
        {profileOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-gray-100">
                <p className="text-[12px] font-semibold text-gray-800 truncate">{session.user.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{session.user.email}</p>
              </div>
              <button onClick={() => { signOut(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-[12.5px] text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                Đăng xuất
              </button>
            </div>
          </>
        )}
      </div>
    );

    return (
      <button onClick={() => setAuthModal(true)}
        className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-[12.5px] font-bold transition-all cursor-pointer shadow-sm">
        Đăng nhập
      </button>
    );
  };

  return (
    <>
      {/* Outlier-style Full-width Top Horizontal Header */}
      <header className="fixed top-0 left-0 right-0 z-40 h-[64px] bg-white border-b border-gray-200/80 shadow-xs flex items-center justify-between px-4 sm:px-8">
        
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center text-white shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-extrabold text-gray-900 text-[16px] tracking-tight uppercase">
              AQISTATION
            </span>
          </Link>

          {/* Desktop Links (Center/Left) */}
          <nav className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[13.5px] font-medium transition-colors ${
                    isActive
                      ? "text-gray-900 font-bold border-b-2 border-gray-900 py-5"
                      : "text-gray-500 hover:text-gray-800 py-5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* App Grid Icon */}
          <button className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer" title="Ứng dụng">
            <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 10a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zM6 16a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4z"/>
            </svg>
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* User Section */}
          <UserSection />

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-white">
          <div className="h-[64px] px-4 flex items-center justify-between border-b border-gray-200">
            <span className="font-bold text-gray-900 text-[15px]">AQISTATION</span>
            <button onClick={() => setMobileOpen(false)} className="p-2 text-gray-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="p-6 space-y-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block text-[16px] font-semibold py-2 ${
                  pathname === item.href ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Auth Modal */}
      {authModal && <AuthModal onClose={() => setAuthModal(false)} />}
    </>
  );
}
