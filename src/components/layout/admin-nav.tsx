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
  Banknote,
  Menu,
  X,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";

const navItems = [
  { title: "Дашборд", href: "/admin", icon: LayoutDashboard },
  { title: "Проекты", href: "/admin/projects", icon: FolderKanban },
  { title: "Лиды", href: "/admin/leads", icon: ClipboardList },
  { title: "Расходы", href: "/admin/expenses", icon: Banknote },
  { title: "Логи", href: "/admin/logs", icon: ClipboardList },
  { title: "Настройки", href: "/admin/settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

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
    if (loading || !user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    if (item.href === "/admin/settings" || item.href === "/admin/logs") return false;
    if (item.href === "/admin/projects") return true;

    return user.links?.some((l: any) => {
        if (item.href === "/admin") return l.canViewDashboard;
        if (item.href === "/admin/leads") return l.canViewLeads;
        if (item.href === "/admin/expenses") return l.canViewExpenses;
        return false;
    });
  });

  const NavLinks = ({ mobile = false }) => (
    <nav className={cn("space-y-1.5", mobile ? "mt-8" : "p-4")}>
      {filteredItems.map((item) => {
        const isActive = pathname === item.href || 
                         pathname === `${item.href}/` || 
                         (item.href !== "/admin" && pathname.startsWith(item.href));
        
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => mobile && setOpen(false)}
            className={cn(
              "group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 relative overflow-hidden",
              isActive 
                ? "bg-primary text-white shadow-[0_8px_30px_rgb(40,0,184,0.3)] font-medium" 
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground hover:translate-x-1"
            )}
          >
            <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-primary")} />
            <span className="text-sm">{item.title}</span>
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-r-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const Logo = () => (
    <div className="flex flex-col">
        <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-br from-primary via-primary/80 to-[#71D878] bg-clip-text text-transparent drop-shadow-sm">
          БЫТЬ
        </h1>
        <p className="text-[10px] text-muted-foreground/60 uppercase font-bold tracking-[0.2em] -mt-1 pl-0.5">платформа аналитики</p>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-16 glass-card flex items-center justify-between px-6 border-x-0 border-t-0 rounded-none">
        <Logo />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/10">
              <Menu className="h-5 w-5 text-primary" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="glass-card w-[280px] p-0 border-r border-white/10">
            <SheetHeader className="p-6 border-b border-white/5">
              <SheetTitle><Logo /></SheetTitle>
            </SheetHeader>
            <NavLinks mobile />
            <div className="absolute bottom-8 left-6 right-6 flex items-center justify-between">
                <ThemeToggle />
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                    Выйти <LogOut className="ml-2 h-4 w-4" />
                </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex fixed left-4 top-4 bottom-4 w-64 glass-card flex-col z-50",
        "animate-in fade-in slide-in-from-left-4 duration-1000"
      )}>
        <div className="p-8 border-b border-white/5">
          <Logo />
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar">
            <NavLinks />
        </div>

        <div className="p-6 border-t border-white/5 space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary/20 to-[#71D878]/20 flex items-center justify-center border border-white/10">
                <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Аккаунт</span>
                <span className="text-xs font-medium truncate">{user?.email || '...'}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-4">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              className="flex-1 justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Выход
            </Button>
          </div>
        </div>
      </aside>
      
      {/* Spacer to push content if sidebar was static, but it's fixed now */}
      <div className="hidden lg:block w-[18rem]" />
      <div className="lg:hidden h-16" />
    </>
  );
}
