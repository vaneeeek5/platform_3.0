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

  if (isLoading) return <div className="p-10 text-center text-muted-foreground animate-pulse">Загрузка настроек...</div>;
  if (me?.role !== "SUPER_ADMIN") return <div className="p-10 text-center text-destructive">Доступ ограничен. Только для Супер-администраторов.</div>;

  return (
    <div className="space-y-6 p-6 bg-slate-50/30 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-display flex items-center gap-2">
            <Settings className="h-8 w-8 text-primary" />
            Настройки платформы
          </h2>
          <p className="text-muted-foreground">Управление пользователями, проектами и глобальными правами.</p>
        </div>
        <div className="flex gap-4">
           <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm">
                    <Plus className="h-4 w-4" />
                    Добавить пользователя
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Новый пользователь</DialogTitle>
                    <DialogDescription>Создайте учетную запись для доступа к платформе.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" />
                    </div>
                    <div className="space-y-2">
                        <Label>Пароль</Label>
                        <div className="relative">
                            <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground opacity-50" />
                            <Input className="pl-9" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Глобальная роль</Label>
                        <Select value={newRole} onValueChange={setNewRole}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="USER">Обычный пользователь</SelectItem>
                                <SelectItem value="SUPER_ADMIN">Супер-админ</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Супер-админы имеют доступ ко ВСЕМ проектам.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Отмена</Button>
                    <Button onClick={handleAddUser}>Создать</Button>
                </DialogFooter>
            </DialogContent>
           </Dialog>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Users Table */}
        <Card className="border-none shadow-sm">
          <CardHeader className="bg-white rounded-t-xl border-b border-slate-100">
            <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">Пользователи</CardTitle>
            </div>
            <CardDescription>Управление ролями и персональным доступом к проектам.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="pl-6">Email</TableHead>
                  <TableHead>Глобальная роль</TableHead>
                  <TableHead>Доступ к проектам</TableHead>
                  <TableHead className="text-right pr-6">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersList.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50/50">
                    <TableCell className="pl-6 font-medium font-sans">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.role === 'SUPER_ADMIN' ? (
                        <span className="text-xs text-muted-foreground italic">Все проекты (полный доступ)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.links.length === 0 ? (
                            <span className="text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Нет привязок</span>
                          ) : user.links.map((link: any) => {
                            const p = projects.find(proj => proj.id === link.projectId);
                            return (
                                <Badge key={link.id} variant="outline" className="bg-white text-[10px] font-medium border-slate-200">
                                    {p?.name || 'Unknown'}
                                </Badge>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {user.role !== 'SUPER_ADMIN' && (
                          <Button variant="outline" size="sm" onClick={() => { setSelectedUser(user); setIsPermissionsOpen(true); }}>
                            Настроить доступ
                          </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* System Status */}
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-none shadow-sm">
                 <CardHeader className="bg-white rounded-t-xl border-b border-slate-100 pb-3">
                    <CardTitle className="text-base">Статус системы</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="space-y-4 text-sm">
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-slate-500">Воркер синхронизации:</span>
                        <span className="text-yellow-600 font-medium bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 text-[10px]">Ожидание</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                        <span className="text-slate-500">Очередь BullMQ:</span>
                        <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200 text-[10px]">Работает (Redis)</span>
                    </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Permissions Dialog */}
      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Настройка доступа: {selectedUser?.email}</DialogTitle>
            <DialogDescription>Укажите, к каким проектам и разделам имеет доступ пользователь.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
             {projects.map(project => {
                const link = selectedUser?.links?.find((l: any) => l.projectId === project.id);
                const hasAccess = !!link;
                
                return (
                    <div key={project.id} className={`p-4 rounded-xl border transition-all ${hasAccess ? 'border-primary/20 bg-primary/5' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Shield className={`h-5 w-5 ${hasAccess ? 'text-primary' : 'text-slate-300'}`} />
                                <div>
                                    <h4 className="font-bold text-slate-800">{project.name}</h4>
                                    <p className="text-[10px] text-muted-foreground uppercase">{project.slug}</p>
                                </div>
                            </div>
                            <Button 
                                variant={hasAccess ? "ghost" : "default"} 
                                size="sm" 
                                className={hasAccess ? "text-destructive hover:bg-destructive/10" : ""}
                                onClick={() => handleUpdatePermission(selectedUser.id, project.id, {}, hasAccess)}
                            >
                                {hasAccess ? <Trash2 className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                {hasAccess ? "Отозвать доступ" : "Предоставить доступ"}
                            </Button>
                        </div>

                        {hasAccess && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-8">
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
                                    label="Логи проекта" 
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermissionsOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermissionToggle({ label, icon: Icon, checked, onCheckedChange }: any) {
    return (
        <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm transition-all hover:border-primary/30">
            <Checkbox id={label} checked={checked} onCheckedChange={onCheckedChange} />
            <Icon className={`h-4 w-4 ${checked ? 'text-primary' : 'text-slate-300'}`} />
            <Label htmlFor={label} className="text-xs cursor-pointer select-none">{label}</Label>
        </div>
    );
}
