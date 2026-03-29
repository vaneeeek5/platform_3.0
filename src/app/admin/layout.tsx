import { AdminNav } from "@/components/layout/admin-nav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminNav />
      <main className="flex-1 p-8 bg-background overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
