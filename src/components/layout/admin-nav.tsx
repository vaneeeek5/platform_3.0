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

  const Logo = () => (
    <div className="flex flex-col">
        <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-br from-primary via-primary to-[#71D878] bg-clip-text text-transparent drop-shadow-xl">
          БЫТЬ
        </h1>
        <p className="text-[9px] text-muted-foreground/40 uppercase font-black tracking-[0.35em] -mt-1 pl-1">платформа аналитики</p>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-20 glass-card flex items-center justify-between px-8 border-none rounded-none shadow-xl">
        <Logo />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-primary/5 hover:bg-primary/10 border border-primary/10">
              <Menu className="h-6 w-6 text-primary" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="glass-card w-[300px] p-0 border-none shadow-2xl">
            <SheetHeader className="p-8 border-b border-white/5">
              <SheetTitle><Logo /></SheetTitle>
            </SheetHeader>
            <NavLinks mobile />
            <div className="absolute bottom-10 left-8 right-8 flex flex-col gap-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Тема</span>
                    <ThemeToggle />
                </div>
                <Button variant="ghost" className="h-14 rounded-2xl bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all font-black uppercase text-[10px] tracking-widest" onClick={handleLogout}>
                    Выйти <LogOut className="ml-2 h-4 w-4" />
                </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex fixed left-6 top-6 bottom-6 w-72 glass-card flex-col z-50",
        "animate-in fade-in slide-in-from-left-8 duration-1000"
      )}>
        <div className="p-10 pb-8">
          <Logo />
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <NavLinks />
        </div>

        <div className="p-8 space-y-8">
          <div className="p-5 rounded-[2rem] bg-white/5 border border-white/5 group hover:bg-white/10 transition-all duration-500">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-[#71D878] flex items-center justify-center shadow-lg shadow-primary/20">
                    <User className="h-6 w-6 text-white" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] leading-none mb-1.5">Администратор</span>
                    <span className="text-sm font-black truncate tracking-tight">{user?.email?.split('@')[0] || '...'}</span>
                </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-3">
            <div className="p-1 bg-white/5 rounded-2xl border border-white/5">
                 <ThemeToggle />
            </div>
            <Button 
              variant="ghost" 
              className="flex-1 h-12 justify-center gap-3 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest border border-transparent hover:border-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Выход
            </Button>
          </div>
        </div>
      </aside>
      
      <div className="hidden lg:block w-[22rem]" />
      <div className="lg:hidden h-20" />
    </>
  );
}
