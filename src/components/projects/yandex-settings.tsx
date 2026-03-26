"use client"

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Goal {
  id: string;
  name: string;
  type: string;
}

export function YandexSettings({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(true);
  const [fetchingGoals, setFetchingGoals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [counterId, setCounterId] = useState("");
  const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
  const [trackedGoalIds, setTrackedGoalIds] = useState<string[]>([]);

  const fetchGoals = useCallback(async (t?: string, c?: string) => {
    const activeToken = t || token;
    const activeCounter = c || counterId;

    if (!activeToken || !activeCounter) return;
    
    setFetchingGoals(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/metrika/goals?token=${activeToken}&counterId=${activeCounter}`);
      const data = await res.json();
      if (data.error) {
        // Don't toast on initial auto-load to avoid noise
        if (t || c) toast.error(data.error);
      } else {
        setAvailableGoals(data);
      }
    } catch (e) {
      if (t || c) toast.error("Ошибка при получении целей");
    } finally {
      setFetchingGoals(false);
    }
  }, [projectId, token, counterId]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(res => res.json()),
      fetch(`/api/projects/${projectId}/tracked-goals`).then(res => res.json())
    ]).then(([project, goals]) => {
      if (project) {
        setToken(project.yandexToken || "");
        setCounterId(project.yandexCounterId || "");
        
        // Auto-fetch goals if creds exist
        if (project.yandexToken && project.yandexCounterId) {
           fetchGoals(project.yandexToken, project.yandexCounterId);
        }
      }
      if (Array.isArray(goals)) {
        setTrackedGoalIds(goals.map((g: any) => g.goalId));
      }
      setLoading(false);
    });
  }, [projectId, fetchGoals]);

  const handleSaveGoals = async () => {
    // If availableGoals is empty because they haven't fetched manually, we can't save names
    // But we should have the IDs anyway. 
    // This is a UI limitation: we only save what we see.
    const goalsToSave = trackedGoalIds.map(id => {
       const goal = availableGoals.find(g => g.id === id);
       return { goalId: id, goalName: goal?.name || "Unknown Goal" };
    });

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tracked-goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: goalsToSave }),
      });

      if (res.ok) {
        toast.success("Список отслеживаемых целей обновлен");
      } else {
        toast.error("Не удалось сохранить цели");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yandexToken: token,
          yandexCounterId: counterId,
        }),
      });

      if (res.ok) {
        toast.success("Доступы Яндекса сохранены");
        // Re-fetch goals to refresh UI
        fetchGoals(token, counterId);
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
          <CardTitle>Яндекс.Метрика API</CardTitle>
          <CardDescription>
            Настройте учетные данные Яндекс.Метрики для получения данных о лидах.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="token">OAuth Токен</Label>
              <Input
                id="token"
                type="password"
                placeholder="y0_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="counter">ID Счетчика</Label>
              <Input
                id="counter"
                placeholder="12345678"
                value={counterId}
                onChange={(e) => setCounterId(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={() => fetchGoals()} variant="outline" disabled={fetchingGoals}>
            {fetchingGoals ? "Загрузка целей..." : "Обновить список целей"}
          </Button>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить доступы"}
          </Button>
        </CardFooter>
      </Card>

      {(availableGoals.length > 0 || trackedGoalIds.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Цели Метрики</CardTitle>
            <CardDescription>
              Выберите цели, которые должны считаться «Лидами».
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fetchingGoals ? (
               <div className="py-8 text-center text-muted-foreground italic">Загрузка списка целей...</div>
            ) : availableGoals.length === 0 ? (
               <div className="py-8 text-center text-muted-foreground italic">Нажмите «Обновить список целей», чтобы увидеть доступные цели.</div>
            ) : (
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Отсл.</TableHead>
                    <TableHead>Goal ID</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Тип</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableGoals.map((goal) => (
                    <TableRow key={goal.id}>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          checked={trackedGoalIds.includes(goal.id)}
                          onChange={(e) => {
                             if (e.target.checked) {
                                setTrackedGoalIds([...trackedGoalIds, goal.id]);
                             } else {
                                setTrackedGoalIds(trackedGoalIds.filter(id => id !== goal.id));
                             }
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{goal.id}</TableCell>
                      <TableCell>{goal.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{goal.type}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
             <Button onClick={handleSaveGoals} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить выбранные цели"}
             </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
