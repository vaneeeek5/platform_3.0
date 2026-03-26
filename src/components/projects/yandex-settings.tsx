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

interface TrackedGoal {
  goalId: string;
  goalName: string;
  displayName: string;
}

export function YandexSettings({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(true);
  const [fetchingGoals, setFetchingGoals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [counterId, setCounterId] = useState("");
  const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
  const [trackedGoalsList, setTrackedGoalsList] = useState<TrackedGoal[]>([]);
  
  const fetchGoals = useCallback(async (t?: string, c?: string) => {
    const activeToken = t || token;
    const activeCounter = c || counterId;

    if (!activeToken || !activeCounter) return;
    
    setFetchingGoals(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/metrika/goals?token=${activeToken}&counterId=${activeCounter}`);
      const data = await res.json();
      if (!data.error) {
        setAvailableGoals(data);
      }
    } catch (e) {
       console.error(e);
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
        if (project.yandexToken && project.yandexCounterId) {
           fetchGoals(project.yandexToken, project.yandexCounterId);
        }
      }
      if (Array.isArray(goals)) {
        setTrackedGoalsList(goals.map((g: any) => ({
           goalId: g.goalId,
           goalName: g.goalName,
           displayName: g.displayName || g.goalName
        })));
      }
      setLoading(false);
    });
  }, [projectId, fetchGoals]);

  const handleSaveGoals = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tracked-goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goals: trackedGoalsList }),
      });

      if (res.ok) {
        toast.success("Список отслеживаемых целей успешно сохранен");
      } else {
        const data = await res.json();
        toast.error(data.error || "Не удалось сохранить цели");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    } finally {
      setSaving(false);
    }
  };

  const toggleGoal = (goal: Goal, checked: boolean) => {
     if (checked) {
        if (!trackedGoalsList.find(g => g.goalId.toString() === goal.id.toString())) {
           setTrackedGoalsList([...trackedGoalsList, { 
              goalId: goal.id.toString(), 
              goalName: goal.name,
              displayName: goal.name
           }]);
        }
     } else {
        setTrackedGoalsList(trackedGoalsList.filter(g => g.goalId.toString() !== goal.id.toString()));
     }
  };

  const updateGoalDisplayName = (goalId: string, value: string) => {
     setTrackedGoalsList(trackedGoalsList.map(g => {
        if (g.goalId.toString() === goalId.toString()) {
           return { ...g, displayName: value };
        }
        return g;
     }));
  };

  const handleSaveToken = async () => {
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
        toast.success("Данные доступа успешно сохранены");
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

  if (loading) return <div className="p-8 text-center">Загрузка настроек Метрики...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Яндекс.Метрика API</CardTitle>
          <CardDescription>
            Введите данные доступа к Яндекс.Метрике для загрузки целей.
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
          <Button onClick={handleSaveToken} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить доступы"}
          </Button>
        </CardFooter>
      </Card>

      {(availableGoals.length > 0 || trackedGoalsList.length > 0) && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Отслеживаемые цели (Лиды)</CardTitle>
            <CardDescription>
              Выберите цели из Метрики и укажите, как они должны называться в платформе.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {fetchingGoals ? (
               <div className="py-8 text-center text-muted-foreground italic">Загрузка списка из Яндекса...</div>
            ) : availableGoals.length === 0 ? (
               <div className="py-8 text-center text-muted-foreground italic">Цели не загружены.</div>
            ) : (
                <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px] pl-6"></TableHead>
                    <TableHead>Название в Метрике</TableHead>
                    <TableHead>Название в платформе</TableHead>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead className="w-[100px]">Тип</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableGoals.map((goal) => {
                    const tracked = trackedGoalsList.find(g => g.goalId.toString() === goal.id.toString());
                    return (
                      <TableRow key={goal.id} className={tracked ? "bg-primary/5" : ""}>
                        <TableCell className="pl-6">
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            checked={!!tracked}
                            onChange={(e) => toggleGoal(goal, e.target.checked)}
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{goal.name}</TableCell>
                        <TableCell>
                           <Input 
                              disabled={!tracked}
                              value={tracked?.displayName || ""}
                              onChange={(e) => updateGoalDisplayName(goal.id.toString(), e.target.value)}
                              className="h-8 text-xs max-w-[200px]"
                              placeholder="Название для отчетов"
                           />
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">{goal.id}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{goal.type}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter className="border-t px-6 py-4 bg-muted/20">
             <Button onClick={handleSaveGoals} disabled={saving || availableGoals.length === 0}>
                {saving ? "Сохранение..." : "Сохранить выбор целей"}
             </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
