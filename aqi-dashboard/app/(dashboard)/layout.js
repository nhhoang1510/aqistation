import Navbar from "@/components/Navbar";

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50/60 flex flex-col font-sans">
      <Navbar />
      <main className="pt-[64px] flex-1 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
