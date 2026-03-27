"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical, Info } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Status {
  id: number
  label: string
  color: string
  isPositive?: boolean
}

export function StatusSettings({ projectId }: { projectId: number }) {
  const [targetStatuses, setTargetStatuses] = useState<Status[]>([])
  const [qualStatuses, setQualStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatuses()
  }, [projectId])

  const fetchStatuses = async () => {
    try {
      const [tRes, qRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/statuses/target`),
        fetch(`/api/projects/${projectId}/statuses/qualification`)
      ])
      setTargetStatuses(await tRes.json())
      setQualStatuses(await qRes.json())
    } catch (e) {
      toast.error("Не удалось загрузить статусы")
    } finally {
      setLoading(false)
    }
  }

  const addStatus = async (type: 'target' | 'qualification') => {
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Новый статус", color: "#3b82f6", isPositive: true }),
      })
      if (res.ok) {
        toast.success("Статус добавлен")
        fetchStatuses()
      }
    } catch (e) {
      toast.error("Ошибка при добавлении")
    }
  }

  const deleteStatus = async (type: 'target' | 'qualification', id: number) => {
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

  const updateStatus = async (type: 'target' | 'qualification', id: number, updates: Partial<Status>) => {
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

  if (loading) return <div className="p-8 text-center">Загрузка статусов проекта...</div>

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-neutral-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b bg-neutral-50/50">
          <div>
            <CardTitle className="text-lg">Целевые статусы</CardTitle>
            <CardDescription className="text-xs">Результаты сделок для расчета конверсии</CardDescription>
          </div>
          <Button size="sm" onClick={() => addStatus('target')} className="h-8">
            <Plus className="h-4 w-4 mr-1" /> Добавить
          </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {targetStatuses.map((status) => (
            <div key={status.id} className="space-y-3 p-3 border rounded-lg bg-neutral-50/30 group">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/30" />
                <Input 
                  className="h-8 text-sm font-medium bg-white" 
                  defaultValue={status.label}
                  onBlur={(e) => {
                    if (e.target.value !== status.label) {
                       updateStatus('target', status.id, { label: e.target.value })
                    }
                  }}
                />
                <Input 
                  type="color" 
                  className="w-10 h-8 p-1 rounded cursor-pointer border-neutral-200 bg-white" 
                  defaultValue={status.color}
                  onBlur={(e) => {
                    if (e.target.value !== status.color) {
                       updateStatus('target', status.id, { color: e.target.value })
                    }
                  }}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteStatus('target', status.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2 pl-6">
                <Checkbox 
                  id={`pos-${status.id}`}
                  checked={status.isPositive}
                  onCheckedChange={(checked) => {
                    updateStatus('target', status.id, { isPositive: !!checked })
                  }}
                />
                <Label htmlFor={`pos-${status.id}`} className="text-[11px] font-medium text-neutral-600 cursor-pointer flex items-center gap-1">
                  Учитывать в «Целевых лидах» на дашборде
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-neutral-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px] text-[10px]">
                          Если галочка стоит, лиды с этим статусом будут считаться успешными (целевыми). 
                          Например: «Продажа» — да, «Отказ» или «Дубль» — нет.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
              </div>
            </div>
          ))}
          {targetStatuses.length === 0 && (
             <p className="text-sm text-muted-foreground italic text-center py-6 border-2 border-dashed rounded-lg">
                Статусы не добавлены
             </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-neutral-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b bg-neutral-50/50">
          <div>
            <CardTitle className="text-lg">Квалификация</CardTitle>
            <CardDescription className="text-xs">Промежуточные этапы работы с лидом</CardDescription>
          </div>
          <Button size="sm" onClick={() => addStatus('qualification')} className="h-8">
            <Plus className="h-4 w-4 mr-1" /> Добавить
          </Button>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {qualStatuses.map((status) => (
            <div key={status.id} className="flex items-center gap-2 group p-2 border border-transparent hover:border-neutral-100 rounded-md">
              <GripVertical className="h-4 w-4 text-muted-foreground/30" />
              <Input 
                className="h-8 text-sm bg-transparent border-transparent hover:border-neutral-200 focus:bg-white focus:border-neutral-200 transition-all" 
                defaultValue={status.label}
                onBlur={(e) => {
                   if (e.target.value !== status.label) {
                      updateStatus('qualification', status.id, { label: e.target.value })
                   }
                }}
              />
              <Input 
                type="color" 
                className="w-10 h-8 p-1 rounded cursor-pointer border-none bg-transparent" 
                defaultValue={status.color}
                onBlur={(e) => {
                   if (e.target.value !== status.color) {
                      updateStatus('qualification', status.id, { color: e.target.value })
                   }
                }}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteStatus('qualification', status.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {qualStatuses.length === 0 && (
             <p className="text-sm text-muted-foreground italic text-center py-6 border-2 border-dashed rounded-lg">
                Статусы не добавлены
             </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
