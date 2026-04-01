"use client"

import * as React from "react";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { YandexSettings } from "@/components/projects/yandex-settings";
import { SyncSettings } from "@/components/projects/sync-settings";
import { StatusSettings } from "@/components/projects/status-settings";
import { CampaignMappingSettings } from "@/components/projects/campaign-mapping";
import { BackupSettings } from "@/components/projects/backup-settings";
import { LeadsList } from "@/components/leads/leads-list";
import { Button } from "@/components/ui/button";
import { ChevronLeft, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

export default function ProjectSettingsPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState("yandex");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetch("/api/admin/me")
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-10 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Загрузка настроек проекта...</p>
    </div>
  );

  const projectId = parseInt(id);
  const projectLink = user?.links?.find((l: any) => l.projectId === projectId);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const canAccess = isSuperAdmin || projectLink?.canViewSettings;

  if (!canAccess) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
        <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        </div>
        <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight">Доступ ограничен</h3>
            <p className="text-muted-foreground font-medium">У вас нет прав для изменения настроек этого проекта.</p>
        </div>
        <Button asChild variant="outline" className="rounded-xl h-12 px-8 border-primary/20 text-primary font-bold">
          <Link href="/admin/projects">Вернуться к проектам</Link>
        </Button>
      </div>
    );
  }

  const handleClearLeads = async () => {
    if (!isSuperAdmin) {
        toast.error("Только супер-администратор может удалять данные");
        return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/leads?projectId=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Все лиды проекта успешно удалены");
        setIsDialogOpen(false);
      } else {
        toast.error("Ошибка при удалении данных");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" asChild className="rounded-2xl w-14 h-14 bg-white/5 hover:bg-primary hover:text-white transition-all shadow-xl border border-white/10 group">
            <Link href="/admin/projects">
              <ChevronLeft className="h-6 w-6 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground">
                Настройки проекта
            </h1>
            <p className="text-muted-foreground font-medium mt-1">Конфигурация интеграций и управления данными.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="yandex" className="w-full">
        <div className="glass-card p-2 border-white/10 shadow-2xl mb-10 sticky top-[90px] z-10 rounded-3xl">
            <TabsList className="bg-transparent h-12 gap-2 flex w-full overflow-x-auto custom-scrollbar no-scrollbar">
                <TabsTrigger value="yandex" className="h-10 rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Яндекс.Метрика</TabsTrigger>
                <TabsTrigger value="statuses" className="h-10 rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Статусы</TabsTrigger>
                <TabsTrigger value="campaigns" className="h-10 rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Маппинг</TabsTrigger>
                <TabsTrigger value="sync" className="h-10 rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">CRM</TabsTrigger>
                <TabsTrigger value="leads" className="h-10 rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Лиды</TabsTrigger>
                <TabsTrigger value="backup" className="h-10 rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all">Бэкап</TabsTrigger>
                {isSuperAdmin && <TabsTrigger value="danger" className="h-10 rounded-xl px-6 font-bold uppercase text-[10px] tracking-widest data-[state=active]:bg-destructive data-[state=active]:text-white text-destructive/80 transition-all">Опасная зона</TabsTrigger>}
            </TabsList>
        </div>

        <div className="mt-8 space-y-8">
            <TabsContent value="yandex" className="m-0 focus-visible:outline-none">
                <YandexSettings projectId={projectId} />
            </TabsContent>

            <TabsContent value="statuses" className="m-0 focus-visible:outline-none">
                <StatusSettings projectId={projectId} />
            </TabsContent>

            <TabsContent value="campaigns" className="m-0 focus-visible:outline-none">
                <CampaignMappingSettings projectId={projectId} />
            </TabsContent>

            <TabsContent value="sync" className="m-0 focus-visible:outline-none">
                <SyncSettings projectId={projectId} />
            </TabsContent>

            <TabsContent value="leads" className="m-0 focus-visible:outline-none">
                <div className="glass-card overflow-hidden shadow-2xl p-0 rounded-[2.5rem]">
                    <LeadsList projectId={projectId} />
                </div>
            </TabsContent>

            <TabsContent value="backup" className="m-0 focus-visible:outline-none">
                <BackupSettings projectId={projectId} />
            </TabsContent>

            {isSuperAdmin && (
                <TabsContent value="danger" className="m-0 focus-visible:outline-none">
                    <Card className="border-destructive/20 bg-destructive/5 rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="p-10 pb-6 border-b border-destructive/10">
                            <div className="flex items-center gap-4 text-destructive">
                                <div className="p-4 bg-destructive/10 rounded-2xl shadow-lg border border-destructive/10">
                                    <AlertTriangle className="h-6 w-6" />
                                </div>
                                <CardTitle className="text-2xl font-black uppercase tracking-tight">Опасная зона</CardTitle>
                            </div>
                            <CardDescription className="text-destructive/80 font-medium text-sm mt-1">
                                Действия в этом разделе необратимы. Пожалуйста, будьте внимательны.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 p-10 pt-8">
                            <div className="flex flex-col sm:flex-row items-center justify-between p-10 glass-card border-none bg-white/40 dark:bg-black/20 gap-8 rounded-[2rem] shadow-xl">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-destructive/10 rounded-xl shrink-0">
                                        <Trash2 className="h-5 w-5 text-destructive" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-foreground uppercase tracking-tight text-lg mb-1 leading-none">Сброс всех лидов</h4>
                                        <p className="text-sm text-muted-foreground font-medium">
                                            Удалить все данные о лидах и их достижениях для этого проекта.
                                        </p>
                                    </div>
                                </div>
                                
                                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                    <DialogTrigger asChild>
                                    <Button variant="destructive" className="h-14 px-10 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-destructive/20 active:scale-95 transition-all">
                                        <Trash2 className="h-4 w-4 mr-2" /> Очистить таблицу
                                    </Button>
                                    </DialogTrigger>
                                    <DialogContent className="glass-card border-none shadow-2xl rounded-[2.5rem] p-0 overflow-hidden">
                                        <div className="p-10 space-y-6">
                                            <DialogHeader>
                                                <DialogTitle className="text-3xl font-black tracking-tight">Вы уверены?</DialogTitle>
                                                <DialogDescription className="text-muted-foreground font-medium py-4 text-sm leading-relaxed">
                                                    Это действие безвозвратно удалит все лиды и связанные с ними статусы/продажи для текущего проекта. 
                                                    <br /><br />
                                                    <span className="text-destructive font-black">Внимание:</span> данные о расходах (expenses) не будут затронуты.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <DialogFooter className="gap-3 sm:gap-4 flex flex-col sm:flex-row">
                                                <Button variant="ghost" className="rounded-2xl h-14 px-8 font-black uppercase text-[10px] tracking-widest order-2 sm:order-1" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                                                <Button variant="destructive" className="rounded-2xl h-14 px-10 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-destructive/20 order-1 sm:order-2" onClick={handleClearLeads} disabled={isDeleting}>
                                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                                    Да, удалить всё
                                                </Button>
                                            </DialogFooter>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            )}
        </div>
      </Tabs>
    </div>
  );
}
