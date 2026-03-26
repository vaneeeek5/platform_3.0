import { AdminNav } from "@/components/layout/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex bg-background">
      <AdminNav />
      <main className="flex-1 min-h-screen p-8 bg-background overflow-auto">
        {children}
      </main>
    </div>
  );
}
