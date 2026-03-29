"use client"

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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="w-64 border-r bg-card h-screen flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
          БЫТЬ
        </h1>
        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">платформа аналитики</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-all hover:bg-accent cursor-pointer z-10",
              (pathname === item.href || 
               pathname === `${item.href}/` || 
               (item.href !== "/admin" && pathname.startsWith(item.href)))
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t pb-12">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </div>
  );
}
