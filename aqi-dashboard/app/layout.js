import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import AuthProvider from "./components/AuthProvider";
import Navbar from "./components/Navbar";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "AQI Station Dashboard",
  description: "Hệ thống quan trắc chất lượng không khí đa thông số — Nhóm 22, HUST",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body
        className="min-h-full bg-[#f6f7f9]"
        style={{ fontFamily: "var(--font-be-vietnam), 'Be Vietnam Pro', system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        <AuthProvider>
          <Navbar />
          <main className="md:ml-[240px] pt-14 md:pt-0 min-h-screen transition-all duration-300">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
