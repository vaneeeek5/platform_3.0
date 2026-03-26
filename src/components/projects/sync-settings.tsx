"use client"

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Clock } from "lucide-react";

export function SyncSettings({ projectId }: { projectId: number }) {
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Задание на синхронизацию добавлено в очередь");
      } else {
        toast.error("Ошибка при запуске синхронизации");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Синхронизация данных</CardTitle>
          <CardDescription>
            Управление автоматическим сбором данных из Яндекс.Метрики и Директа.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1">
                 <p className="text-sm font-medium">Ручной запуск</p>
                 <p className="text-xs text-muted-foreground">Запустить немедленное обновление данных за последние 2 дня.</p>
              </div>
              <Button onClick={handleManualSync} disabled={syncing} size="sm">
                 <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                 {syncing ? "Запуск..." : "Запустить сейчас"}
              </Button>
           </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-between items-center text-xs text-muted-foreground">
           <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Последняя синхронизация: еще не проводилась</span>
           </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Интеграция с CRM</CardTitle>
          <CardDescription>
            Настройки экспорта лидов в вашу CRM (в разработке).
          </CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground italic">
              Здесь будут настройки Webhooks и API для передачи лидов в CRM.
           </p>
        </CardContent>
      </Card>
    </div>
  );
}
