import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role === "SUPER_ADMIN" || session.role === "ADMIN") {
    redirect("/admin");
  }

  // Regular users redirect to their project slug if we had it,
  // but for now, just show a placeholder or dashboard.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold">Welcome to Platform v2.0</h1>
      <p className="text-muted-foreground mt-4 text-center">
        You are logged in as {session.role}.<br/>
        Project dashboard is coming soon for regular users.
      </p>
    </div>
  );
}
