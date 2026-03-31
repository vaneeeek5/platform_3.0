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

  if (loading) return <div className="p-10 text-center text-muted-foreground animate-pulse">Загрузка настроек проекта...</div>;

  const projectId = parseInt(id);
  const projectLink = user?.links?.find((l: any) => l.projectId === projectId);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const canAccess = isSuperAdmin || projectLink?.canViewSettings;

  if (!canAccess) {
    return (
      <div className="p-10 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h3 className="text-xl font-bold">Доступ ограничен</h3>
        <p className="text-muted-foreground">У вас нет прав для изменения настроек этого проекта.</p>
        <Button asChild variant="outline">
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/projects">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Настройки проекта</h2>
      </div>

      <Tabs defaultValue="yandex">
        <TabsList>
          <TabsTrigger value="yandex">Яндекс.Метрика</TabsTrigger>
          <TabsTrigger value="statuses">Статусы</TabsTrigger>
          <TabsTrigger value="campaigns">Маппинг кампаний</TabsTrigger>
          <TabsTrigger value="sync">Синхронизация и CRM</TabsTrigger>
          <TabsTrigger value="leads">Лиды</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="danger" className="text-red-600">Опасная зона</TabsTrigger>}
        </TabsList>

        <TabsContent value="yandex">
            <YandexSettings projectId={projectId} />
        </TabsContent>

        <TabsContent value="statuses">
            <StatusSettings projectId={projectId} />
        </TabsContent>

        <TabsContent value="campaigns">
            <CampaignMappingSettings projectId={projectId} />
        </TabsContent>

        <TabsContent value="sync">
            <SyncSettings projectId={projectId} />
        </TabsContent>

        <TabsContent value="leads">
            <LeadsList projectId={projectId} />
        </TabsContent>

        {isSuperAdmin && (
            <TabsContent value="danger">
                <Card className="border-red-200 bg-red-50/10">
                <CardHeader>
                    <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                    <CardTitle>Опасная зона</CardTitle>
                    </div>
                    <CardDescription>
                    Действия в этом разделе необратимы. Пожалуйста, будьте внимательны.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 border border-red-100 rounded-lg bg-white">
                    <div>
                        <h4 className="font-bold text-neutral-900">Сброс всех лидов</h4>
                        <p className="text-sm text-neutral-500">
                        Удалить все данные о лидах и их достижениях для этого проекта.
                        </p>
                    </div>
                    
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-2" /> Очистить таблицу
                        </Button>
                        </DialogTrigger>
                        <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Вы уверены?</DialogTitle>
                            <DialogDescription>
                            Это действие безвозвратно удалит все лиды и связанные с ними статусы/продажи для текущего проекта. 
                            Данные о расходах (expenses) не будут затронуты.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                            <Button variant="destructive" onClick={handleClearLeads} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Да, удалить всё
                            </Button>
                        </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    </div>
                </CardContent>
                </Card>
            </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
