import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();

  // If we reach here, middleware didn't redirect (e.g. regular USER role)
  // For now, just show a welcome screen.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
        Platform v2.0
      </h1>
      <p className="text-muted-foreground mt-4 max-w-md">
        Welcome! You are logged in as <span className="text-primary font-semibold">{session?.role}</span>.
        Your dashboard is being prepared.
      </p>
    </div>
  );
}
