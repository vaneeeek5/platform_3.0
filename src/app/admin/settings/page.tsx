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
import { Users, Shield, Plus, Key, Settings, LayoutDashboard, ClipboardList, Banknote, History, Trash2, X } from "lucide-react";

export default function GlobalSettingsPage() {
  const [me, setMe] = React.useState<any>(null);
  const [usersList, setUsersList] = React.useState<any[]>([]);
  const [projects, setProjects] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = React.useState(false);
  const [isPermissionsOpen, setIsPermissionsOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<any>(null);

  // Form states
  const [newEmail, setNewEmail] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newRole, setNewRole] = React.useState("USER");

  const fetchData = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
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
        fetchData();
      }
    } catch (e) {
      toast.error("Ошибка сети");
    }
  };

  if (isLoading) return (
    <div className="p-10 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Загрузка настроек...</p>
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
    <div className="p-4 md:p-8 space-y-10 max-w-7xl mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground flex items-center gap-4">
             Настройки
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Управление пользователями, проектами и глобальной безопасностью.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
           <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
                <Button className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 flex-1 md:flex-none">
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить пользователя
                </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/20 shadow-2xl rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight">Новый пользователь</DialogTitle>
                    <DialogDescription className="font-medium">Создайте учетную запись для доступа к платформе.</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email</Label>
                        <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" className="h-11 glass-card border-white/10 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Пароль</Label>
                        <div className="relative group">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-30 group-focus-within:opacity-100 transition-opacity" />
                            <Input className="pl-11 h-11 glass-card border-white/10 rounded-xl" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Глобальная роль</Label>
                        <Select value={newRole} onValueChange={setNewRole}>
                            <SelectTrigger className="h-11 glass-card border-white/10 rounded-xl font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="glass-card border-white/10">
                                <SelectItem value="USER" className="font-bold">Обычный пользователь</SelectItem>
                                <SelectItem value="SUPER_ADMIN" className="font-bold">Супер-админ</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground font-medium pl-1 italic">Супер-админы имеют доступ ко ВСЕМ проектам.</p>
                    </div>
                </div>
                <DialogFooter className="gap-3">
                    <Button variant="outline" className="rounded-xl h-11 px-6 font-bold" onClick={() => setIsAddUserOpen(false)}>Отмена</Button>
                    <Button onClick={handleAddUser} className="rounded-xl h-11 px-8 font-black uppercase text-[10px] tracking-widest">Создать</Button>
                </DialogFooter>
            </DialogContent>
           </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Users Table */}
        <div className="xl:col-span-2 space-y-6">
            <Card className="border-none shadow-2xl p-0 overflow-hidden ring-1 ring-white/10">
              <CardHeader className="bg-muted/30 border-b border-white/5 pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-xl font-black uppercase tracking-widest">Пользователи</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                            {usersList.length} учётных записей в системе
                        </CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10 h-14">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="pl-8 text-[10px] font-black uppercase tracking-widest">Email</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Роль</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Доступ</TableHead>
                      <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersList.map((user) => (
                      <TableRow key={user.id} className="border-white/5 hover:bg-primary/5 transition-all h-16 group">
                        <TableCell className="pl-8 font-black text-foreground/80">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'} className={cn(
                              "uppercase text-[9px] font-black tracking-widest px-3 py-1 rounded-full",
                              user.role === 'SUPER_ADMIN' ? "bg-primary text-white" : "bg-muted/10 text-muted-foreground"
                          )}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.role === 'SUPER_ADMIN' ? (
                            <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">Полный доступ</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {user.links.length === 0 ? (
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/60 italic">Нет привязок</span>
                              ) : user.links.map((link: any) => {
                                const p = projects.find(proj => proj.id === link.projectId);
                                return (
                                    <Badge key={link.id} variant="outline" className="bg-white/5 text-[9px] font-black uppercase tracking-wider border-white/10 text-muted-foreground">
                                        {p?.name || 'Unknown'}
                                    </Badge>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          {user.role !== 'SUPER_ADMIN' && (
                              <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/10 text-primary hover:bg-primary/10" onClick={() => { setSelectedUser(user); setIsPermissionsOpen(true); }}>
                                Настроить
                              </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
        </div>

        {/* System Sidebar Info */}
        <div className="space-y-8">
            <Card className="border-none shadow-2xl overflow-hidden ring-1 ring-white/10">
                 <CardHeader className="bg-muted/30 border-b border-white/5 pb-4">
                    <CardTitle className="text-xs font-black uppercase tracking-widest">Статус системы</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Воркер синхронизации</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black bg-amber-500/10 text-amber-500 border-amber-500/20 uppercase tracking-widest">Ожидание</Badge>
                    </div>
                    <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#71D878]" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Очередь BullMQ</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black bg-[#71D878]/10 text-[#71D878] border-[#71D878]/20 uppercase tracking-widest">Активен (Redis)</Badge>
                    </div>
                    <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#71D878]" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">База данных</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-black bg-primary/10 text-primary border-primary/20 uppercase tracking-widest">Подключено</Badge>
                    </div>
                </CardContent>
            </Card>

            <div className="glass-card p-6 border-white/10 bg-primary/5 text-primary rounded-[2rem] space-y-4">
                <div className="p-3 bg-primary/10 rounded-2xl w-fit">
                    <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Безопасность</h3>
                <p className="text-[11px] font-medium leading-relaxed opacity-70">
                    Управление доступом осуществляется на уровне RBAC (Role Based Access Control). 
                    Для предоставления доступа к новым модулям используйте окно настройки прав.
                </p>
            </div>
        </div>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-3xl glass-card border-white/20 shadow-2xl rounded-[2.5rem] overflow-hidden p-0">
          <div className="p-8 border-b border-white/5 bg-muted/30">
            <DialogHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-3xl font-black tracking-tight">Управление доступом</DialogTitle>
                        <DialogDescription className="text-sm font-bold uppercase tracking-widest text-primary mt-1">{selectedUser?.email}</DialogDescription>
                    </div>
                    <div className="p-3 bg-primary rounded-2xl shadow-xl shadow-primary/20 text-white">
                        <Key className="h-6 w-6" />
                    </div>
                </div>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
             {projects.map(project => {
                const link = selectedUser?.links?.find((l: any) => l.projectId === project.id);
                const hasAccess = !!link;
                
                return (
                    <div key={project.id} className={cn(
                        "p-6 rounded-[1.5rem] border transition-all duration-500",
                        hasAccess ? "glass-card border-primary/30 bg-primary/5 shadow-lg shadow-primary/5" : "border-white/5 bg-white/5 grayscale opacity-60"
                    )}>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "p-3 rounded-2xl transition-all",
                                    hasAccess ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30" : "bg-muted text-muted-foreground"
                                )}>
                                    <Shield className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black tracking-tight">{project.name}</h4>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{project.slug}</p>
                                </div>
                            </div>
                            <Button 
                                variant={hasAccess ? "ghost" : "default"} 
                                size="sm" 
                                className={cn(
                                    "h-10 rounded-xl px-6 font-black uppercase text-[10px] tracking-widest",
                                    hasAccess ? "text-destructive hover:bg-destructive/10" : "shadow-lg shadow-primary/20"
                                )}
                                onClick={() => handleUpdatePermission(selectedUser.id, project.id, {}, hasAccess)}
                            >
                                {hasAccess ? <Trash2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                {hasAccess ? "Отозвать" : "Добавить"}
                            </Button>
                        </div>

                        {hasAccess && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 xl:pl-4">
                                <PermissionToggle 
                                    label="Дашборд" 
                                    icon={LayoutDashboard} 
                                    checked={link.canViewDashboard} 
                                    onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, project.id, { ...link, canViewDashboard: val })} 
                                />
                                <PermissionToggle 
                                    label="Лиды" 
                                    icon={ClipboardList} 
                                    checked={link.canViewLeads} 
                                    onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, project.id, { ...link, canViewLeads: val })} 
                                />
                                <PermissionToggle 
                                    label="Расходы" 
                                    icon={Banknote} 
                                    checked={link.canViewExpenses} 
                                    onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, project.id, { ...link, canViewExpenses: val })} 
                                />
                                <PermissionToggle 
                                    label="Логи" 
                                    icon={History} 
                                    checked={link.canViewLogs} 
                                    onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, project.id, { ...link, canViewLogs: val })} 
                                />
                                <PermissionToggle 
                                    label="Настройки" 
                                    icon={Settings} 
                                    checked={link.canViewSettings} 
                                    onCheckedChange={(val: boolean) => handleUpdatePermission(selectedUser.id, project.id, { ...link, canViewSettings: val })} 
                                />
                            </div>
                        )}
                    </div>
                );
             })}
          </div>

          <div className="p-8 border-t border-white/5 bg-muted/20 flex justify-end">
            <Button size="lg" className="rounded-xl h-14 px-10 font-black uppercase text-[10px] tracking-widest" onClick={() => setIsPermissionsOpen(false)}>Готово</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermissionToggle({ label, icon: Icon, checked, onCheckedChange }: any) {
    return (
        <div className={cn(
            "flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 border cursor-pointer select-none group",
            checked ? "bg-white border-primary/20 shadow-xl shadow-primary/5 ring-1 ring-primary/5" : "bg-white/5 border-transparent opacity-60 hover:opacity-100 hover:bg-white/10"
        )} onClick={() => onCheckedChange(!checked)}>
            <div className={cn(
                "p-2.5 rounded-xl transition-all",
                checked ? "bg-primary/10 text-primary scale-110" : "bg-muted/20 text-muted-foreground group-hover:bg-muted/40"
            )}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 flex flex-col">
                <span className={cn(
                    "text-[10px] font-black uppercase tracking-wider transition-colors",
                    checked ? "text-primary" : "text-muted-foreground"
                )}>{label}</span>
                <span className="text-[10px] text-muted-foreground/60 font-medium">{checked ? "Включено" : "Выключено"}</span>
            </div>
            <Checkbox id={label} checked={checked} onCheckedChange={onCheckedChange} className="w-5 h-5 rounded-lg border-primary/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
        </div>
    );
}
