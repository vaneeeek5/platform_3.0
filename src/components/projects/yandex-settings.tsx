"use client"

import { useState, useEffect } from "react";
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

  useEffect(() => {
    // Load initial project settings and tracked goals
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(res => res.json()),
      fetch(`/api/projects/${projectId}/tracked-goals`).then(res => res.json())
    ]).then(([project, goals]) => {
      if (project) {
        setToken(project.yandexToken || "");
        setCounterId(project.yandexCounterId || "");
      }
      if (Array.isArray(goals)) {
        setTrackedGoalIds(goals.map((g: any) => g.goalId));
      }
      setLoading(false);
    });
  }, [projectId]);

  const handleSaveGoals = async () => {
    const goalsToSave = availableGoals
      .filter(g => trackedGoalIds.includes(g.id))
      .map(g => ({ goalId: g.id, goalName: g.name }));

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

  const fetchGoals = async () => {
    if (!token || !counterId) {
       toast.error("Введите токен и ID счетчика");
       return;
    }
    setFetchingGoals(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/metrika/goals?token=${token}&counterId=${counterId}`);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setAvailableGoals(data);
        toast.success(`Найдено целей: ${data.length}`);
      }
    } catch (e) {
      toast.error("Ошибка при получении целей");
    } finally {
      setFetchingGoals(false);
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
          <Button onClick={fetchGoals} variant="outline" disabled={fetchingGoals}>
            {fetchingGoals ? "Загрузка..." : "Получить список целей"}
          </Button>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить доступы"}
          </Button>
        </CardFooter>
      </Card>

      {availableGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Цели Метрики</CardTitle>
            <CardDescription>
              Выберите цели, которые должны считаться «Лидами».
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
             <Button onClick={handleSaveGoals} disabled={saving || availableGoals.length === 0}>
                {saving ? "Сохранение..." : "Сохранить выбранные цели"}
             </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
