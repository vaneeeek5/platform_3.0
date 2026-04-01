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
    <nav className={cn("space-y-2", mobile ? "mt-8" : "px-4 py-2")}>
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
              "group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 relative overflow-hidden",
              isActive 
                ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]" 
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground translate-x-0 hover:translate-x-1"
            )}
          >
            <item.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-primary/60 group-hover:text-primary")} />
            <span className={cn("text-sm font-medium tracking-tight", isActive ? "font-black" : "")}>{item.title}</span>
            {isActive && (
                <div className="absolute right-3 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const Logo = ({ mobile = false }: { mobile?: boolean }) => (
    <Link 
      href="/admin" 
      className={cn(
        "flex flex-col group transition-transform active:scale-95",
        mobile ? "" : "hover:translate-x-1"
      )}
    >
        <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-br from-primary via-primary to-[#71D878] bg-clip-text text-transparent drop-shadow-xl">
          БЫТЬ
        </h1>
        <p className="text-[9px] text-muted-foreground/40 uppercase font-black tracking-[0.35em] -mt-1 pl-1">платформа аналитики</p>
    </Link>
  );

  return (
    <>
      {/* Mobile Floating Header */}
      <header className="lg:hidden fixed top-4 left-4 right-4 z-40 h-16 glass-card flex items-center justify-between px-6 border-none shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700">
        <Logo mobile />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-all active:scale-95">
              <Menu className="h-5 w-5 text-primary" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="glass-card w-[300px] p-0 border-none shadow-2xl backdrop-blur-3xl">
            <div className="flex flex-col h-full">
                <SheetHeader className="p-8 border-b border-white/5">
                    <SheetTitle aria-label="Logo"><Logo mobile /></SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 py-8">
                    <NavLinks mobile />
                </div>
                <div className="p-8 border-t border-white/5 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Тема</span>
                        <ThemeToggle />
                    </div>
                    <Button variant="ghost" className="w-full h-14 rounded-2xl bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all font-black uppercase text-[10px] tracking-widest gap-3" onClick={handleLogout}>
                        Выйти из системы <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex fixed left-6 top-6 bottom-6 w-64 glass-card flex-col z-50 shadow-[0_32px_64px_-12px_rgba(40,0,184,0.12)]",
        "animate-in fade-in slide-in-from-left-8 duration-1000 ease-out"
      )}>
        <div className="p-8 pb-6 text-center lg:text-left">
          <Logo />
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <NavLinks />
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all duration-500">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-[#71D878] flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                    <User className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] leading-none mb-1">Администратор</span>
                    <span className="text-xs font-black truncate tracking-tight">{user?.email?.split('@')[0] || '...'}</span>
                </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <div className="p-1 bg-white/5 rounded-xl border border-white/5">
                 <ThemeToggle />
            </div>
            <Button 
              variant="ghost" 
              className="flex-1 h-11 justify-center gap-2 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all font-black uppercase text-[9px] tracking-widest border border-transparent hover:border-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Выход
            </Button>
          </div>
        </div>
      </aside>
      
      <div className="hidden lg:block w-[280px] shrink-0" />
      <div className="lg:hidden h-24" />
    </>
  );
}
