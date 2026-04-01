"use client"

import * as React from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Shield, Plus, Key, Settings, LayoutDashboard, ClipboardList, Banknote, History, Trash2, X, Server, HardDrive, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GlobalSettingsPage() {
  const [me, setMe] = React.useState<any>(null);
  const [usersList, setUsersList] = React.useState<any[]>([]);
  const [projects, setProjects] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = React.useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const selectedUser = React.useMemo(() => 
    usersList.find(u => u.id === selectedUserId), 
    [usersList, selectedUserId]
  );
  const [isPlatformBackingUp, setIsPlatformBackingUp] = React.useState(false);

  // Form states
  const [newEmail, setNewEmail] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newRole, setNewRole] = React.useState("USER");

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [meRes, userRes, projRes] = await Promise.all([
        fetch("/api/admin/me").then(r => r.json()),
        fetch("/api/admin/users").then(r => r.json()),
        fetch("/api/projects").then(r => r.json()),
      ]);
      setMe(meRes);
      if (!userRes.error) setUsersList(userRes);
      if (!projRes.error) setProjects(projRes);
    } catch (e) {
      toast.error("Ошибка загрузки данных");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleAddUser = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });
      if (res.ok) {
        toast.success("Пользователь добавлен");
        setIsAddUserOpen(false);
        setNewEmail("");
        setNewPassword("");
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || "Ошибка при создании");
      }
    } catch (e) {
      toast.error("Ошибка сети");
    }
  };

  const handleUpdatePermission = async (userId: number, projectId: number, permissions: any, removeLink = false) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, projectId, permissions, removeLink }),
      });
      if (res.ok) {
        toast.success("Права обновлены");
        fetchData(true);
      } else {
        toast.error("Ошибка обновления прав");
      }
    } catch (e) {
      toast.error("Ошибка сети");
    }
  };

  const handlePlatformBackup = async () => {
    setIsPlatformBackingUp(true);
    try {
        const res = await fetch("/api/admin/backup/platform", { method: "POST" });
        const data = await res.json();
        if (res.ok) {
            toast.success(`Снимок платформы создан: ${data.fileName}`);
        } else {
            toast.error(data.error || "Ошибка создания бэкапа");
        }
    } catch (e) {
        toast.error("Ошибка сети");
    } finally {
        setIsPlatformBackingUp(false);
    }
  };

  if (isLoading) return (
    <div className="p-10 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-black uppercase text-[10px] tracking-widest animate-pulse">Загрузка...</p>
    </div>
  );
  
  if (me?.role !== "SUPER_ADMIN") return (
    <div className="p-10 flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <Shield className="h-16 w-16 text-destructive opacity-20" />
        <h2 className="text-2xl font-black tracking-tight text-destructive">Доступ ограничен</h2>
        <p className="text-muted-foreground font-medium">Только для Супер-администраторов.</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
           <div className="flex items-center gap-4 mb-2">
              <div className="p-3 glass-card rounded-2xl shadow-xl border-none">
                <Settings className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                Настройки
              </h1>
           </div>
           <p className="text-muted-foreground/60 font-black uppercase tracking-[0.2em] text-[10px] pl-1">Управление пользователями и правами</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Всего аккаунтов</CardTitle>
             <div className="p-2 bg-primary/10 rounded-xl"><Users className="h-5 w-5 text-primary" /></div>
           </CardHeader>
           <CardContent>
             <div className="text-5xl font-black tracking-tighter text-primary drop-shadow-sm">{usersList.length}</div>
             <p className="text-[9px] text-muted-foreground/40 mt-3 uppercase font-black tracking-[0.15em]">активных пользователей</p>
           </CardContent>
         </Card>
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Ваш статус</CardTitle>
             <div className="p-2 bg-primary/10 rounded-xl"><Shield className="h-5 w-5 text-primary" /></div>
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-black tracking-tighter uppercase text-primary drop-shadow-sm">{me?.role || "..."}</div>
             <p className="text-[9px] text-muted-foreground/40 mt-3 uppercase font-black tracking-[0.15em]">текущая роль в системе</p>
           </CardContent>
         </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 space-y-10">
          <Card className="glass-card border-none shadow-2xl p-0 overflow-hidden rounded-[2.5rem]">
            <CardHeader className="p-10 pb-8 border-b border-white/5 bg-white/5 dark:bg-black/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tighter uppercase">Пользователи</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-1">Доступ к платформе ({usersList.length})</CardDescription>
                </div>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-11 rounded-2xl bg-primary text-white hover:bg-primary/90 transition-all font-black uppercase text-[10px] tracking-widest px-6 shadow-xl shadow-primary/20">
                      <Plus className="mr-2 h-4 w-4" /> Добавить
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-card border-none shadow-2xl max-w-md p-8">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black tracking-tight">Новый пользователь</DialogTitle>
                      <DialogDescription className="text-sm font-medium">Введите почту и пароль для доступа</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-6 font-medium">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 focus:text-primary transition-colors">Email</Label>
                        <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-12 rounded-2xl glass-card border-none shadow-xl focus:ring-2 focus:ring-primary/20" placeholder="email@example.com" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Пароль</Label>
                        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-12 rounded-2xl glass-card border-none shadow-xl focus:ring-2 focus:ring-primary/20" placeholder="********" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Роль</Label>
                        <Select value={newRole} onValueChange={setNewRole}>
                          <SelectTrigger className="h-12 rounded-2xl glass-card border-none shadow-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="glass-card border-none shadow-2xl">
                            <SelectItem value="USER" className="font-black uppercase text-[10px] tracking-widest">Менеджер</SelectItem>
                            <SelectItem value="SUPER_ADMIN" className="font-black uppercase text-[10px] tracking-widest">Супер Админ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setIsAddUserOpen(false)} className="h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest">Отмена</Button>
                      <Button onClick={handleAddUser} className="h-12 rounded-2xl bg-primary text-white px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">Создать</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5 dark:bg-black/20">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] pl-8 h-14">Аккаунт</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] h-14">Роль</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-[0.2em] text-right pr-8 h-14">Управление</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList.map((user) => (
                    <TableRow key={user.id} className="border-white/5 hover:bg-primary/5 transition-colors group h-20">
                      <TableCell className="pl-10 py-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center border transition-all",
                              "bg-primary/5 border-primary/10 group-hover:bg-primary/20"
                          )}>
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-black text-sm text-foreground/80 truncate max-w-[200px]" title={user.email}>{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'} className={cn(
                            "uppercase text-[9px] font-black tracking-widest px-3 py-1 rounded-full border-none",
                            user.role === 'SUPER_ADMIN' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground/40"
                        )}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-10">
                        <div className="flex items-center justify-end gap-2">
                           <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 rounded-xl hover:bg-primary/10 text-primary px-4 text-[10px] font-black uppercase tracking-widest"
                              onClick={() => {
                                setSelectedUserId(user.id);
                                setIsPermissionsOpen(true);
                              }}
                            >
                              <Shield className="h-3.5 w-3.5 mr-2" />
                              Доступы
                            </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-10 w-10 rounded-xl hover:bg-destructive/10 text-destructive/40 hover:text-destructive"
                            onClick={async () => {
                              if (confirm('Удалить пользователя?')) {
                                  await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' });
                                  fetchData();
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
            <Card className="glass-card border-none shadow-2xl p-8 relative overflow-hidden rounded-[2.5rem]">
                <div className="p-3 bg-primary/10 rounded-2xl w-fit mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight mb-2">Безопасность</h3>
                <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/70 mb-6">
                    Используйте RBAC модель для ограничения доступа менеджеров только к их проектам.
                </p>
                <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5">
                        <div className="w-2 h-2 rounded-full bg-[#71D878] shadow-[0_0_10px_rgba(113,216,120,0.5)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Database Sync</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5">
                        <div className="w-2 h-2 rounded-full bg-[#71D878] shadow-[0_0_10px_rgba(113,216,120,0.5)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Redis Queue</span>
                    </div>
                </div>
            </Card>

            <div className="glass-card p-8 border-none bg-primary/5 rounded-[2.5rem] relative group cursor-default shadow-xl">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16 rounded-full group-hover:scale-150 transition-transform duration-1000" />
                 <Key className="h-8 w-8 text-primary mb-6 opacity-40" />
                 <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-2">Менеджмент</h4>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 leading-relaxed">
                    Глобальные настройки позволяют управлять ролями и привязками проектов в реальном времени.
                 </p>
            </div>

            <Card className="glass-card border-none shadow-2xl p-8 relative overflow-hidden bg-white/40 dark:bg-black/20 border border-white/5 rounded-[2.5rem]">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <HardDrive className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight">Платформа</h3>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Полный бэкап системы</p>
                    </div>
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/70 mb-8">
                    Создайте мгновенный снимок исходного кода всей платформы. Архив будет сохранен на сервере в папке <code>/root/backups/</code>.
                </p>
                <Button 
                    onClick={handlePlatformBackup} 
                    disabled={isPlatformBackingUp}
                    className="w-full h-14 rounded-2xl bg-white text-primary hover:bg-primary hover:text-white transition-all shadow-xl font-black uppercase text-[10px] tracking-widest border border-primary/10"
                >
                    {isPlatformBackingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Сохранить платформу
                </Button>
            </Card>
        </div>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="glass-card border-none shadow-2xl max-w-4xl max-h-[85vh] p-0 overflow-hidden flex flex-col rounded-[2.5rem]">
          <DialogHeader className="p-10 pb-6 border-b border-white/5">
            <div className="flex items-center justify-between">
                <div>
                   <DialogTitle className="text-3xl font-black tracking-tighter">Настройка доступа</DialogTitle>
                   <DialogDescription className="text-xs font-black uppercase tracking-[0.2em] text-primary mt-1">{selectedUser?.email}</DialogDescription>
                </div>
                <div className="p-4 glass-card rounded-[1.5rem] border-primary/20 shadow-xl shadow-primary/10">
                   <Shield className="h-7 w-7 text-primary" />
                </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-8">
              {projects.map((proj) => {
                const link = selectedUser?.links?.find((l: any) => l.projectId === proj.id);
                const hasLink = !!link;
                
                return (
                  <div key={proj.id} className={cn(
                      "p-8 rounded-[2rem] border transition-all duration-500",
                      hasLink ? "glass-card border-primary/20 bg-primary/5 shadow-2xl" : "border-white/5 bg-white/5 grayscale opacity-40 hover:grayscale-0 hover:opacity-100"
                  )}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "h-12 w-12 rounded-2xl flex items-center justify-center transition-all",
                                hasLink ? "bg-primary text-white shadow-xl shadow-primary/20 scale-110" : "bg-muted text-muted-foreground"
                            )}>
                                <LayoutDashboard className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-xl font-black tracking-tight">{proj.name}</h4>
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{proj.slug}</p>
                            </div>
                        </div>
                        <Button 
                            variant={hasLink ? "ghost" : "default"}
                            onClick={() => handleUpdatePermission(selectedUser.id, proj.id, {}, hasLink)}
                            className={cn(
                                "h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest",
                                hasLink ? "text-destructive hover:bg-destructive/10" : "bg-primary text-white shadow-lg shadow-primary/30"
                            )}
                        >
                            {hasLink ? <Trash2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            {hasLink ? "Отключить" : "Подключить"}
                        </Button>
                    </div>

                    {hasLink && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <PermissionToggle 
                                label="Дашборд" 
                                icon={LayoutDashboard} 
                                checked={link.canViewDashboard} 
                                onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, proj.id, { ...link, canViewDashboard: val })} 
                            />
                            <PermissionToggle 
                                label="Лиды" 
                                icon={ClipboardList} 
                                checked={link.canViewLeads} 
                                onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, proj.id, { ...link, canViewLeads: val })} 
                            />
                            <PermissionToggle 
                                label="Расходы" 
                                icon={Banknote} 
                                checked={link.canViewExpenses} 
                                onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, proj.id, { ...link, canViewExpenses: val })} 
                            />
                            <PermissionToggle 
                                label="Настройки" 
                                icon={Settings} 
                                checked={link.canViewSettings} 
                                onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, proj.id, { ...link, canViewSettings: val })} 
                            />
                        </div>
                    )}
                  </div>
                );
              })}
          </div>
          <DialogFooter className="p-10 border-t border-white/5 bg-white/5">
            <Button onClick={() => setIsPermissionsOpen(false)} className="h-14 rounded-2xl bg-primary text-white font-black uppercase text-[10px] tracking-widest px-12 shadow-xl shadow-primary/20">Готово</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermissionToggle({ label, icon: Icon, checked, onCheckedChange }: any) {
    return (
        <div 
            className={cn(
                "flex flex-col gap-3 p-5 rounded-2xl border transition-all duration-300 cursor-pointer group",
                checked ? "bg-white border-primary/20 shadow-xl shadow-primary/5" : "bg-white/5 border-transparent opacity-60 hover:opacity-100"
            )}
            onClick={() => onCheckedChange(!checked)}
        >
            <div className="flex items-center justify-between">
                <div className={cn(
                    "p-2.5 rounded-xl transition-all",
                    checked ? "bg-primary/10 text-primary" : "bg-muted/20 text-muted-foreground"
                )}>
                    <Icon className="h-4 w-4" />
                </div>
                <Checkbox checked={checked} onCheckedChange={onCheckedChange} className="w-5 h-5 rounded-lg border-primary/20 data-[state=checked]:bg-primary shadow-inner" />
            </div>
            <div>
                <div className={cn(
                    "text-[10px] font-black uppercase tracking-wider mb-0.5 transition-colors",
                    checked ? "text-primary" : "text-muted-foreground/60"
                )}>{label}</div>
                <div className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">{checked ? "Доступ есть" : "Нет доступа"}</div>
            </div>
        </div>
    );
}
