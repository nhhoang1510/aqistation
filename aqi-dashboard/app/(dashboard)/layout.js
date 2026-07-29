import Navbar from "@/components/Navbar";

export default function DashboardLayout({ children }) {
  return (
    <>
      <Navbar />
      {/* top-[60px] = header height, md:ml-[240px] = sidebar width */}
      <main className="pt-[60px] md:ml-[240px] min-h-screen transition-all duration-300">
        {children}
      </main>
    </>
  );
}
