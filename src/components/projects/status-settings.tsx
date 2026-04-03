"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Status {
  id: number
  label: string
  color: string
  isPositive?: boolean
}

export function StatusSettings({ projectId }: { projectId: number }) {
  const [targetStatuses, setTargetStatuses] = useState<Status[]>([])
  const [qualStatuses, setQualStatuses] = useState<Status[]>([])
  const [saleStatuses, setSaleStatuses] = useState<Status[]>([])
  const [stageStatuses, setStageStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStatuses = async () => {
    try {
      const [tRes, qRes, saleRes, sRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/statuses/target`),
        fetch(`/api/projects/${projectId}/statuses/qualification`),
        fetch(`/api/projects/${projectId}/statuses/sale`),
        fetch(`/api/projects/${projectId}/statuses/stages`)
      ])
      let tData = [];
      let qData = [];
      let saleData = [];
      let sData = [];
      try { tData = await tRes.json(); } catch(e) {}
      try { qData = qRes.ok ? await qRes.json() : []; } catch(e) {}
      try { saleData = saleRes.ok ? await saleRes.json() : []; } catch(e) {}
      try { sData = await sRes.json(); } catch(e) {}
      
      setTargetStatuses(Array.isArray(tData) ? tData : []);
      setQualStatuses(Array.isArray(qData) ? qData : []);
      setSaleStatuses(Array.isArray(saleData) ? saleData : []);
      setStageStatuses(Array.isArray(sData) ? sData : []);
    } catch (e) {
      toast.error("Не удалось загрузить статусы")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatuses()
  }, [projectId])

  const addStatus = async (type: 'target' | 'qualification' | 'sale' | 'stages') => {
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Новый статус", color: "#2800B8", isPositive: type !== 'stages' ? true : undefined }),
      })
      if (res.ok) {
        toast.success("Статус добавлен")
        fetchStatuses()
      }
    } catch (e) {
      toast.error("Ошибка при добавлении")
    }
  }

  const deleteStatus = async (type: 'target' | 'qualification' | 'sale' | 'stages', id: number) => {
    if (!confirm("Вы уверены? Это может затронуть существующие лиды.")) return
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/${type}/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Статус удален")
        fetchStatuses()
      }
    } catch (e) {
      toast.error("Ошибка при удалении")
    }
  }

  const updateStatus = async (type: 'target' | 'qualification' | 'sale' | 'stages', id: number, updates: Partial<Status>) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/${type}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        toast.success("Изменения сохранены", { duration: 1000 })
        fetchStatuses()
      } else {
        toast.error("Ошибка при сохранении")
      }
    } catch (e) {
      toast.error("Произошла ошибка")
    }
  }

  if (loading) return (
    <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse uppercase text-[10px] tracking-widest leading-none">Загрузка структуры воронки...</p>
    </div>
  );

  return (
    <div className="grid gap-10 xl:grid-cols-2 2xl:grid-cols-4 animate-in fade-in duration-700">
      <StatusSection 
        title="Целевые статусы" 
        description="Результаты сделок для расчета ROI"
        items={targetStatuses}
        onAdd={() => addStatus('target')}
        onDelete={(id: number) => deleteStatus('target', id)}
        onUpdate={(id: number, updates: any) => updateStatus('target', id, updates)}
        type="target"
      />

      <StatusSection 
        title="Квалификация" 
        description="Промежуточные этапы лида"
        items={qualStatuses}
        onAdd={() => addStatus('qualification')}
        onDelete={(id: number) => deleteStatus('qualification', id)}
        onUpdate={(id: number, updates: any) => updateStatus('qualification', id, updates)}
        type="qualification"
      />

      <StatusSection 
        title="Продажи" 
        description="Статусы для расчета суммы сделок"
        items={saleStatuses}
        onAdd={() => addStatus('sale')}
        onDelete={(id: number) => deleteStatus('sale', id)}
        onUpdate={(id: number, updates: any) => updateStatus('sale', id, updates)}
        type="sale"
      />

      <StatusSection 
        title="CRM Этапы (Stages)" 
        description="Воронка продаж напрямую из CRM"
        items={stageStatuses}
        onAdd={() => addStatus('stages')}
        onDelete={(id: number) => deleteStatus('stages', id)}
        onUpdate={(id: number, updates: any) => updateStatus('stages', id, updates)}
        type="stages"
      />
    </div>
  )
}

function StatusSection({ title, description, items, onAdd, onDelete, onUpdate, type }: any) {
    return (
        <Card className="border-none shadow-2xl glass-card overflow-hidden rounded-[2.5rem] flex flex-col h-full">
            <CardHeader className="bg-muted/30 border-b border-white/5 p-8">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-black tracking-tight">{title}</CardTitle>
                        <CardDescription className="text-[11px] font-medium leading-relaxed opacity-60 uppercase tracking-widest">{description}</CardDescription>
                    </div>
                    <Button size="sm" onClick={onAdd} className="h-10 w-10 p-0 rounded-2xl shadow-lg shadow-primary/20">
                        <Plus className="h-5 w-5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-8 p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                {(Array.isArray(items) ? items : []).map((status) => (
                    <div key={status.id} className="space-y-4 p-5 rounded-[2rem] bg-white border border-slate-50 shadow-sm group hover:shadow-md transition-all duration-300">
                        <div className="flex items-center gap-3">
                            <GripVertical className="h-5 w-5 text-slate-200 shrink-0" />
                            <Input 
                                className="h-10 text-[12px] font-black tracking-tight bg-slate-50/50 border-transparent rounded-xl px-4 focus-visible:ring-primary/10 hover:bg-slate-50" 
                                defaultValue={status.label}
                                onBlur={(e) => {
                                    if (e.target.value !== status.label) {
                                        onUpdate(status.id, { label: e.target.value })
                                    }
                                }}
                            />
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 rounded-xl pointer-events-none border border-black/5" />
                                <Input 
                                    type="color" 
                                    className="w-12 h-10 p-1 rounded-xl cursor-pointer border-none bg-transparent" 
                                    defaultValue={status.color}
                                    onBlur={(e) => {
                                        if (e.target.value !== status.color) {
                                            onUpdate(status.id, { color: e.target.value })
                                        }
                                    }}
                                />
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 rounded-xl text-slate-300 hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                onClick={() => onDelete(status.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        {(type === 'target' || type === 'qualification' || type === 'sale') && (
                            <div className="flex items-center gap-3 pl-8">
                                <Checkbox 
                                    id={`pos-${status.id}`}
                                    checked={status.isPositive}
                                    onCheckedChange={(checked) => {
                                        onUpdate(status.id, { isPositive: !!checked })
                                    }}
                                    className="w-5 h-5 rounded-lg border-primary/20"
                                />
                                <Label htmlFor={`pos-${status.id}`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 cursor-pointer hover:text-primary transition-colors">
                                    {type === 'target' ? 'Учитывать в ROI' : type === 'sale' ? 'Учитывать как Продажу' : 'Учитывать в Квалах'}
                                </Label>
                            </div>
                        )}
                    </div>
                ))}
                {(Array.isArray(items) ? items : []).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/10 rounded-[2rem] bg-muted/20 opacity-40">
                        <Info className="h-8 w-8 mb-3 text-muted-foreground" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Статусы не добавлены</p>
                    </div>
                )}
            </CardContent>
            {type === 'target' && (
                <CardFooter className="bg-primary/5 p-6 border-t border-white/5 mx-4 mb-4 rounded-[1.5rem]">
                    <div className="flex gap-4">
                         <div className="p-2 bg-primary/10 rounded-xl shrink-0 h-fit">
                            <Info className="h-4 w-4 text-primary" />
                         </div>
                         <p className="text-[10px] font-medium leading-relaxed text-primary/70">
                            Целевые статусы используются для расчёта ROMI и CPA. Обычно это «Продажа» или «Договор».
                         </p>
                    </div>
                </CardFooter>
            )}
        </Card>
    );
}
