"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/history", label: "Lịch sử", icon: "📋" },
  { href: "/map", label: "Bản đồ", icon: "🗺️" },
  { href: "/settings", label: "Cài đặt", icon: "⚙️" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!session || pathname === "/login") return null;

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-white/[0.06] shadow-lg">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
              style={{ background: "linear-gradient(135deg, #10b981, #3b82f6)" }}>
              🌿
            </div>
            <span className="font-bold text-white text-lg tracking-tight hidden sm:block group-hover:text-emerald-400 transition-colors">
              AQI Station
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white/[0.12] text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right: User profile */}
          <div className="flex items-center gap-3">
            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full ring-2 ring-emerald-500/40"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                    {session.user?.name?.[0] || "U"}
                  </div>
                )}
                <span className="hidden lg:block text-sm text-slate-300 font-medium max-w-[120px] truncate">
                  {session.user?.name}
                </span>
                <svg className={`w-4 h-4 text-slate-500 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                    style={{ animation: "fadeSlideDown 0.15s ease-out" }}>
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <p className="text-sm font-semibold text-white truncate">{session.user?.name}</p>
                      <p className="text-xs text-slate-400 truncate">{session.user?.email}</p>
                    </div>
                    <div className="py-1">
                      <Link href="/settings" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] transition-colors">
                        <span>⚙️</span> Cài đặt cảnh báo
                      </Link>
                      <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <span>🚪</span> Đăng xuất
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-white/[0.06]">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/[0.12] text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </nav>
  );
}
