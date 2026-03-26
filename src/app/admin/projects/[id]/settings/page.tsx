"use client"

import { useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { YandexSettings } from "@/components/projects/yandex-settings";
import { SyncSettings } from "@/components/projects/sync-settings";
import { StatusSettings } from "@/components/projects/status-settings";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function ProjectSettingsPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState("yandex");

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
          <TabsTrigger value="sync">Синхронизация и CRM</TabsTrigger>
          <TabsTrigger value="general">Общие</TabsTrigger>
        </TabsList>

        <TabsContent value="yandex">
            <YandexSettings projectId={parseInt(id)} />
        </TabsContent>

        <TabsContent value="statuses">
            <StatusSettings projectId={parseInt(id)} />
        </TabsContent>

        <TabsContent value="sync">
            <SyncSettings projectId={parseInt(id)} />
        </TabsContent>

        <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Общая информация</CardTitle>
                <CardDescription>Основные детали проекта и видимость.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Настройки названия и пути (slug) управляются в основной форме проекта.
                </p>
                <Button variant="outline" className="mt-4" asChild>
                   <Link href={`/admin/projects/${id}`}>Изменить Название и Slug</Link>
                </Button>
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
