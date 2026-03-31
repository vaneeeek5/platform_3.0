"use client"

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const [directLogins, setDirectLogins] = useState("");
  const [yandexUtmsAllowed, setYandexUtmsAllowed] = useState("");
  const [availableUtmSources, setAvailableUtmSources] = useState<string[]>([]);
  const [newUtmInput, setNewUtmInput] = useState("");
  const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
  const [trackedGoalsList, setTrackedGoalsList] = useState<TrackedGoal[]>([]);
  
  const fetchGoals = useCallback(async (t?: string, c?: string) => {
    const activeToken = t || token;
    const activeCounter = c || counterId;

    if (!activeToken || !activeCounter) return;
    
    setFetchingGoals(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/metrika/goals?token=${activeToken}&counterId=${activeCounter}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.error) {
            setAvailableGoals(data);
        }
      }
    } catch (e) {
       console.error(e);
    } finally {
      setFetchingGoals(false);
    }
  }, [projectId, token, counterId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(res => res.json()),
      fetch(`/api/projects/${projectId}/tracked-goals`).then(res => res.json()),
      fetch(`/api/projects/${projectId}/utm-sources`).then(res => res.json())
    ]).then(([project, goals, sources]) => {
      if (project) {
        setToken(project.yandexToken || "");
        setCounterId(project.yandexCounterId || "");
        setDirectLogins(project.yandexDirectLogins || "");
        setYandexUtmsAllowed(project.yandexUtmsAllowed || "");
        
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

      if (Array.isArray(sources)) {
        setAvailableUtmSources(sources);
      }
    })
    .catch(err => console.error("Error loading project data:", err))
    .finally(() => setLoading(false));
  }, [projectId]);

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
          yandexDirectLogins: directLogins,
          yandexUtmsAllowed: yandexUtmsAllowed,
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

  if (loading) return (
    <div className="py-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Загрузка настроек Метрики...</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <Card className="border-none shadow-2xl glass-card overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-muted/30 border-b border-white/5 pb-8 p-10">
          <CardTitle className="text-2xl font-black tracking-tight">Яндекс.Метрика API</CardTitle>
          <CardDescription className="text-sm font-medium mt-2">
            Введите данные доступа к Яндекс.Метрике для автоматической загрузки целей и данных из Logs API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-10">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="token" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">OAuth Токен</Label>
              <Input
                id="token"
                type="password"
                placeholder="y0_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="h-12 glass-card border-white/5 rounded-2xl px-5 focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="counter" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">ID Счетчика</Label>
              <Input
                id="counter"
                placeholder="12345678"
                value={counterId}
                onChange={(e) => setCounterId(e.target.value)}
                className="h-12 glass-card border-white/5 rounded-2xl px-5 focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-3 sm:col-span-2">
              <Label htmlFor="logins" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Логины Директа (через запятую)</Label>
              <Input
                id="logins"
                placeholder="login1, login2"
                value={directLogins}
                onChange={(e) => setDirectLogins(e.target.value)}
                className="h-12 glass-card border-white/5 rounded-2xl px-5 focus-visible:ring-primary/20"
              />
            </div>
          </div>
          <Button onClick={() => fetchGoals()} variant="outline" disabled={fetchingGoals} className="h-12 px-8 rounded-2xl border-primary/20 text-primary font-bold uppercase text-[10px] tracking-widest hover:bg-primary/5">
            {fetchingGoals ? "Загрузка целей..." : "Обновить список целей"}
          </Button>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t border-white/5 p-8 px-10">
          <Button onClick={handleSaveToken} disabled={saving} className="h-14 px-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-primary/20">
            {saving ? "Сохранение..." : "Сохранить доступы"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-none shadow-2xl glass-card overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-muted/30 border-b border-white/5 p-10">
          <CardTitle className="text-2xl font-black tracking-tight">Фильтрация источников трафика</CardTitle>
          <CardDescription className="text-sm font-medium mt-2">
            Если вы отметите источники здесь, платформа будет импортировать лиды <b>только</b> из них. 
            Если не отметить ничего — будут учитываться все лиды.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-10">
          <div className="flex flex-wrap gap-3">
            {availableUtmSources.length === 0 ? (
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Источники еще не обнаружены</p>
            ) : availableUtmSources.map(source => {
              const isActive = yandexUtmsAllowed.split(',').map(s => s.trim()).includes(source);
              return (
                <div key={source} className={cn(
                    "flex items-center space-x-3 p-3 px-4 rounded-2xl border transition-all cursor-pointer group",
                    isActive ? "bg-primary/5 border-primary/20 shadow-lg shadow-primary/5" : "bg-muted/10 border-white/5 opacity-60 hover:opacity-100"
                )} onClick={() => {
                   const enabled = new Set(yandexUtmsAllowed.split(',').map(s => s.trim()).filter(Boolean));
                   if (!isActive) enabled.add(source);
                   else enabled.delete(source);
                   setYandexUtmsAllowed(Array.from(enabled).join(', '));
                }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    readOnly
                    className="h-5 w-5 rounded-lg border-primary/20 text-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <Label className="cursor-pointer font-black text-[11px] uppercase tracking-tight truncate max-w-[150px]">{source}</Label>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 max-w-xl">
            <Input 
              placeholder="Добавить вручную (например: mytarget)" 
              value={newUtmInput} 
              onChange={e => setNewUtmInput(e.target.value)} 
              className="h-12 glass-card border-white/5 rounded-2xl px-5"
            />
            <Button variant="outline" className="h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary" onClick={() => {
              if (!newUtmInput.trim()) return;
              const term = newUtmInput.trim();
              if (!availableUtmSources.includes(term)) setAvailableUtmSources([...availableUtmSources, term]);
              
              const enabled = new Set(yandexUtmsAllowed.split(',').map(s => s.trim()).filter(Boolean));
              enabled.add(term);
              setYandexUtmsAllowed(Array.from(enabled).join(', '));
              setNewUtmInput("");
            }}>Добавить</Button>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t border-white/5 p-8 px-10">
           <Button onClick={handleSaveToken} disabled={saving} className="h-14 px-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-primary/20 border-primary/20 text-primary hover:bg-primary hover:text-white" variant="outline">
              {saving ? "Сохранение..." : "Применить фильтр"}
           </Button>
        </CardFooter>
      </Card>

      {(availableGoals.length > 0 || trackedGoalsList.length > 0) && (
        <Card className="border-none shadow-2xl glass-card overflow-hidden rounded-[2rem]">
          <CardHeader className="bg-muted/30 border-b border-white/5 p-10">
            <CardTitle className="text-2xl font-black tracking-tight">Отслеживаемые цели (Лиды)</CardTitle>
            <CardDescription className="text-sm font-medium mt-2">
              Выберите цели из Метрики и укажите их отображаемые названия для отчётов.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {fetchingGoals ? (
               <div className="py-20 flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Загрузка из Метрики...</p>
               </div>
            ) : availableGoals.length === 0 ? (
               <div className="py-20 text-center text-muted-foreground italic font-medium uppercase text-[10px] tracking-widest opacity-40">Цели не загружены. Обновите доступы.</div>
            ) : (
                <Table>
                <TableHeader className="bg-muted/20 h-14">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="w-[80px] pl-10"></TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Цель в Метрике</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Название в CRM</TableHead>
                    <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Counter ID</TableHead>
                    <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Тип</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableGoals.map((goal) => {
                    const tracked = trackedGoalsList.find(g => g.goalId.toString() === goal.id.toString());
                    return (
                      <TableRow key={goal.id} className={cn(
                          "border-white/5 transition-all h-20 group",
                          tracked ? "bg-primary/5" : "hover:bg-primary/5"
                      )}>
                        <TableCell className="pl-10">
                           <input 
                              type="checkbox" 
                              className="h-6 w-6 rounded-xl border-primary/20 text-primary focus:ring-primary/20 cursor-pointer shadow-sm"
                              checked={!!tracked}
                              onChange={(e) => toggleGoal(goal, e.target.checked)}
                           />
                        </TableCell>
                        <TableCell className="text-[12px] font-black tracking-tight text-foreground/80">{goal.name}</TableCell>
                        <TableCell>
                           <Input 
                              disabled={!tracked}
                              value={tracked?.displayName || ""}
                              onChange={(e) => updateGoalDisplayName(goal.id.toString(), e.target.value)}
                              className="h-10 text-xs max-w-[240px] glass-card border-white/5 rounded-xl px-4"
                              placeholder="Название для платформы"
                           />
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground font-medium opacity-50">{goal.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-muted/10 border-white/5 px-3 py-1 rounded-full">{goal.type}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
          <CardFooter className="bg-muted/20 border-t border-white/5 p-8 px-10">
             <Button onClick={handleSaveGoals} disabled={saving || availableGoals.length === 0} className="h-14 px-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-primary/20">
                {saving ? "Сохранение..." : "Сохранить цели"}
             </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
