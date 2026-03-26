"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function SyncSettings({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [schedule, setSchedule] = useState("0 0 * * *");
  const [periodDays, setPeriodDays] = useState(1);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSyncEnabled(data.syncEnabled || false);
          setSchedule(data.syncSchedule || "0 0 * * *");
          setPeriodDays(data.syncPeriodDays || 1);
        }
        setLoading(false);
      });
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syncEnabled,
          syncSchedule: schedule,
          syncPeriodDays: periodDays,
        }),
      });

      if (res.ok) {
        toast.success("Настройки синхронизации сохранены");
      } else {
        toast.error("Ошибка при сохранении");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Расписание синхронизации</CardTitle>
          <CardDescription>
            Настройте частоту автоматической загрузки данных из Яндекса и CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Автоматическая синхронизация</Label>
              <p className="text-sm text-muted-foreground">
                Выполнять задачи в фоновом режиме по расписанию.
              </p>
            </div>
            <input 
              type="checkbox" 
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schedule">Частота синхронизации</Label>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger id="schedule">
                  <SelectValue placeholder="Выберите частоту" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0 * * * *">Каждый час</SelectItem>
                  <SelectItem value="0 */4 * * *">Каждые 4 часа</SelectItem>
                  <SelectItem value="0 0 * * *">Ежедневно в полночь</SelectItem>
                  <SelectItem value="0 0 * * 0">Еженедельно по воскресеньям</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">Период синхронизации (дней)</Label>
              <Input
                id="period"
                type="number"
                min="1"
                max="30"
                value={periodDays}
                onChange={(e) => setPeriodDays(parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                За сколько последних дней подтягивать данные при каждом запуске.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить настройки синхронизации"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Маппинг статусов CRM</CardTitle>
          <CardDescription>
            Сопоставьте статусы из CRM с внутренними статусами платформы.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground italic">
             Настройка маппинга будет доступна после первой успешной синхронизации с CRM.
           </p>
        </CardContent>
      </Card>
    </div>
  );
}
