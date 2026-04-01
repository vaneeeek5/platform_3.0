import { AdminNav } from "@/components/layout/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background relative selection:bg-primary selection:text-white">
      <AdminNav />
      {/* Main Content Area */}
      <main className="lg:pl-80 transition-all duration-700 ease-in-out">
        <div className="max-w-[1600px] mx-auto min-h-screen pb-20 p-6 lg:p-12">
          {children}
        </div>
      </main>
    </div>
  );
}
