"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GlobalSettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 font-display">Настройки платформы</h2>
            <p className="text-muted-foreground">Глобальные платформенные настройки.</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-neutral-200">
                <CardHeader>
                    <CardTitle>Общие настройки</CardTitle>
                    <CardDescription>Основные параметры системы.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm py-4 text-muted-foreground italic">
                        Здесь будут располагаться глобальные настройки уведомлений и доступов.
                    </p>
                </CardContent>
            </Card>

            <Card className="border-neutral-200">
                <CardHeader>
                    <CardTitle>Статус системы</CardTitle>
                    <CardDescription>Мониторинг воркеров и очередей.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 text-sm">
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-neutral-500">Воркер синхронизации:</span>
                        <span className="text-yellow-600 font-medium bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">Не сконфигурирован</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-neutral-500">Очередь задач BullMQ:</span>
                        <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200">Работает (Redis)</span>
                    </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
