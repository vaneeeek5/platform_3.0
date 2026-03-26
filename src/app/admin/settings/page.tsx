"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Глобальные настройки</h2>
        <p className="text-muted-foreground">Управление общесистемными параметрами платформы.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Общие настройки</CardTitle>
            <CardDescription>Основные параметры системы.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-center py-8 text-muted-foreground italic">
              Здесь будут располагаться глобальные настройки уведомлений и доступов.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Статус системы</CardTitle>
            <CardDescription>Мониторинг воркеров и очередей.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b pb-2">
                 <span>Воркер синхронизации:</span>
                 <span className="text-yellow-600 font-medium">Не сконфигурирован</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                 <span>Очередь задач BullMQ:</span>
                 <span className="text-green-600 font-medium">Работает (Redis)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
