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
  title: "Trạm quan trắc chất lượng không khí đa thông số",
  description: "Hệ thống giám sát và cảnh báo chất lượng không khí đa thông số theo thời gian thực",
  openGraph: {
    title: "Trạm quan trắc chất lượng không khí đa thông số",
    description: "Giám sát chất lượng không khí thời gian thực",
    url: "https://aqi-dashboard.vercel.app", // Adjust with your actual domain
    siteName: "AQI Station",
    images: [
      {
        url: "/og-image.png", // Assuming an image will be added in public/
        width: 1200,
        height: 630,
        alt: "AQI Station Dashboard",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      <head>
        <link rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin="" />
      </head>
      <body
        className="min-h-full bg-[#f6f7f9]"
        style={{ fontFamily: "var(--font-be-vietnam), 'Be Vietnam Pro', system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        <AuthProvider>
          <Navbar />
          {/* top-[60px] = header height, md:ml-[240px] = sidebar width */}
          <main className="pt-[60px] md:ml-[240px] min-h-screen transition-all duration-300">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
