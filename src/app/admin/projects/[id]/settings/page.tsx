"use client"

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { YandexSettings } from "@/components/projects/yandex-settings";
import { SyncSettings } from "@/components/projects/sync-settings";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function ProjectSettingsPage({ params }: { params: { id: string } }) {
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

      <Tabs>
        <TabsList>
          <TabsTrigger 
            value="yandex" 
            active={activeTab === "yandex"} 
            onClick={() => setActiveTab("yandex")}
          >
            Яндекс.Метрика
          </TabsTrigger>
          <TabsTrigger 
            value="sync" 
            active={activeTab === "sync"} 
            onClick={() => setActiveTab("sync")}
          >
            Синхронизация и CRM
          </TabsTrigger>
          <TabsTrigger 
            value="general" 
            active={activeTab === "general"} 
            onClick={() => setActiveTab("general")}
          >
            Общие
          </TabsTrigger>
        </TabsList>

        <TabsContent value="yandex" active={activeTab === "yandex"}>
           <YandexSettings projectId={parseInt(params.id)} />
        </TabsContent>

        <TabsContent value="sync" active={activeTab === "sync"}>
           <SyncSettings projectId={parseInt(params.id)} />
        </TabsContent>

        <TabsContent value="general" active={activeTab === "general"}>
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
                  <Link href={`/admin/projects/${params.id}`}>Изменить Название и Slug</Link>
               </Button>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
