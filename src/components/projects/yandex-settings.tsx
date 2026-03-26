"use client"

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Goal {
  id: string;
  name: string;
  type: string;
}

interface TrackedGoal {
  goalId: string;
  goalName: string;
  targetStatusId?: number | null;
  qualificationStatusId?: number | null;
}

interface Status {
  id: number;
  label: string;
  color: string;
}

export function YandexSettings({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(true);
  const [fetchingGoals, setFetchingGoals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");
  const [counterId, setCounterId] = useState("");
  const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
  const [trackedGoalsList, setTrackedGoalsList] = useState<TrackedGoal[]>([]);
  
  const [targetStatuses, setTargetStatuses] = useState<Status[]>([]);
  const [qualStatuses, setQualStatuses] = useState<Status[]>([]);

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
      fetch(`/api/projects/${projectId}/tracked-goals`).then(res => res.json()),
      fetch(`/api/projects/${projectId}/statuses/target`).then(res => res.json()),
      fetch(`/api/projects/${projectId}/statuses/qualification`).then(res => res.json())
    ]).then(([project, goals, targets, quals]) => {
      if (project) {
        setToken(project.yandexToken || "");
        setCounterId(project.yandexCounterId || "");
        if (project.yandexToken && project.yandexCounterId) {
           fetchGoals(project.yandexToken, project.yandexCounterId);
        }
      }
      if (Array.isArray(goals)) {
        setTrackedGoalsList(goals);
      }
      if (Array.isArray(targets)) setTargetStatuses(targets);
      if (Array.isArray(quals)) setQualStatuses(quals);
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
        toast.success("Список отслеживаемых целей и маппинг обновлены");
      } else {
        toast.error("Не удалось сохранить цели");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    } finally {
      setSaving(false);
    }
  };

  const toggleGoal = (goal: Goal, checked: boolean) => {
     if (checked) {
        setTrackedGoalsList([...trackedGoalsList, { 
           goalId: goal.id, 
           goalName: goal.name,
           targetStatusId: null,
           qualificationStatusId: null
        }]);
     } else {
        setTrackedGoalsList(trackedGoalsList.filter(g => g.goalId !== goal.id));
     }
  };

  const updateGoalMapping = (goalId: string, type: 'target' | 'qual', statusId: string) => {
     setTrackedGoalsList(trackedGoalsList.map(g => {
        if (g.goalId === goalId) {
           return {
              ...g,
              [type === 'target' ? 'targetStatusId' : 'qualificationStatusId']: statusId === "none" ? null : parseInt(statusId)
           };
        }
        return g;
     }));
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

      {(availableGoals.length > 0 || trackedGoalsList.length > 0) && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Цели Метрики и Маппинг</CardTitle>
            <CardDescription>
              Выберите цели-лиды и соответствующие им статусы в платформе.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {fetchingGoals ? (
               <div className="py-8 text-center text-muted-foreground italic">Загрузка списка целей...</div>
            ) : availableGoals.length === 0 ? (
               <div className="py-8 text-center text-muted-foreground italic">Нажмите «Обновить список целей», чтобы увидеть доступные цели.</div>
            ) : (
                <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px] pl-6"></TableHead>
                    <TableHead>Название / ID</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Целевой статус</TableHead>
                    <TableHead>Квал. статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableGoals.map((goal) => {
                    const tracked = trackedGoalsList.find(g => g.goalId === goal.id);
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
                        <TableCell>
                           <div className="flex flex-col">
                              <span className="font-medium text-sm">{goal.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{goal.id}</span>
                           </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{goal.type}</Badge>
                        </TableCell>
                        <TableCell>
                           <Select 
                              disabled={!tracked} 
                              value={tracked?.targetStatusId?.toString() || "none"}
                              onValueChange={(val) => updateGoalMapping(goal.id, 'target', val)}
                           >
                              <SelectTrigger className="h-8 text-xs w-[140px]">
                                 <SelectValue placeholder="Нет" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="none">Не маппить</SelectItem>
                                 {targetStatuses.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.label}</SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </TableCell>
                        <TableCell>
                           <Select 
                              disabled={!tracked} 
                              value={tracked?.qualificationStatusId?.toString() || "none"}
                              onValueChange={(val) => updateGoalMapping(goal.id, 'qual', val)}
                           >
                              <SelectTrigger className="h-8 text-xs w-[140px]">
                                 <SelectValue placeholder="Нет" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="none">Не маппить</SelectItem>
                                 {qualStatuses.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.label}</SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter className="border-t px-6 py-4 bg-muted/20">
             <Button onClick={handleSaveGoals} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить цели и маппинг"}
             </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
