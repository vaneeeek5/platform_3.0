"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { CrmArchiveImport } from "@/components/settings/crm-archive-import";
import { CrmStageMappingsManager } from "@/components/settings/crm-stage-mappings-manager";

// We'll modify the existing components slightly or wrap them to use the global projectId
// For now, I'll just refactor the page to make it clear.

export default function GlobalSettingsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  useEffect(() => {
    fetch("/api/projects").then(res => res.json()).then(setProjects)
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 font-display">Настройки платформы</h2>
            <p className="text-muted-foreground">Управление интеграциями, маппингом статусов и импортом данных из CRM.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Блок импорта архива */}
        <CrmArchiveImport />

        {/* Блок маппинга статусов и этапов */}
        <CrmStageMappingsManager />

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
