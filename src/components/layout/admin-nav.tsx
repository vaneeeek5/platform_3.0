"use client"

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FolderKanban, 
  ClipboardList, 
  Settings, 
  LogOut,
  Banknote
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  {
    title: "Дашборд",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Проекты",
    href: "/admin/projects",
    icon: FolderKanban,
  },
  {
    title: "Лиды",
    href: "/admin/leads",
    icon: ClipboardList,
  },
  {
    title: "Расходы",
    href: "/admin/expenses",
    icon: Banknote,
  },
  {
    title: "Логи",
    href: "/admin/logs",
    icon: ClipboardList,
  },
  {
    title: "Настройки",
    href: "/admin/settings",
    icon: Settings,
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/admin/me")
      .then(res => res.json())
      .then(data => {
        if (!data.error) setUser(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const filteredItems = navItems.filter(item => {
    if (loading) return false;
    if (!user) return false;

    // Super Admin sees everything
    if (user.role === "SUPER_ADMIN") return true;

    // Admin-only sections
    if (item.href === "/admin/settings" || item.href === "/admin/logs") {
      return false; 
    }

    // Projects list always visible for everyone
    if (item.href === "/admin/projects") return true;

    // Sections inside projects (Dashboard, Leads, Expenses)
    // For now, if the user has a projectLink, keep the item enabled in sidebar
    // Detailed checking happens inside pages.
    const hasAnyAccess = user.links?.some((l: any) => {
        if (item.href === "/admin") return l.canViewDashboard;
        if (item.href === "/admin/leads") return l.canViewLeads;
        if (item.href === "/admin/expenses") return l.canViewExpenses;
        return false;
    });

    return hasAnyAccess;
  });

  return (
    <div className="w-64 border-r bg-card h-screen flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
          БЫТЬ
        </h1>
        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">платформа аналитики</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {loading ? (
             <div className="space-y-2 px-3 py-4">
                {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
             </div>
        ) : filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-all hover:bg-accent cursor-pointer z-10 text-sm",
              (pathname === item.href || 
               pathname === `${item.href}/` || 
               (item.href !== "/admin" && pathname.startsWith(item.href)))
                ? "bg-accent text-accent-foreground font-medium shadow-sm"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t pb-8">
        <div className="mb-4 px-3 flex flex-col gap-1 overflow-hidden">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Профиль</span>
            <span className="text-xs font-medium text-slate-600 truncate">{user?.email || 'Загрузка...'}</span>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </div>
  );
}
