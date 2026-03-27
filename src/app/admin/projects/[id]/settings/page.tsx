"use client"

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

  const handleClearLeads = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/leads?projectId=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Все лиды проекта успешно удалены");
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
          <TabsTrigger value="danger" className="text-red-600">Опасная зона</TabsTrigger>
        </TabsList>

        <TabsContent value="yandex">
            <YandexSettings projectId={parseInt(id)} />
        </TabsContent>

        <TabsContent value="statuses">
            <StatusSettings projectId={parseInt(id)} />
        </TabsContent>

        <TabsContent value="campaigns">
            <CampaignMappingSettings projectId={parseInt(id)} />
        </TabsContent>

        <TabsContent value="sync">
            <SyncSettings projectId={parseInt(id)} />
        </TabsContent>

        <TabsContent value="leads">
            <LeadsList projectId={parseInt(id)} />
        </TabsContent>

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
                  
                  <Dialog>
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
                        <Button variant="outline" onClick={() => {}}>Отмена</Button>
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
      </Tabs>
    </div>
  );
}
