"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical, Save } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Status {
  id: number
  label: string
  color: string
}

export function StatusSettings({ projectId }: { projectId: number }) {
  const [targetStatuses, setTargetStatuses] = useState<Status[]>([])
  const [qualStatuses, setQualStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

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
        body: JSON.stringify({ label: "Новый статус", color: "#3b82f6" }),
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
    const sId = `${type}-${id}`;
    setSavingId(sId);
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/${type}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        // We don't toast on every character change, but since it's onBlur, we should confirm
        toast.success("Изменения сохранены", { duration: 1000 })
        fetchStatuses()
      } else {
        toast.error("Ошибка при сохранении")
      }
    } catch (e) {
      toast.error("Произошла ошибка")
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <div className="p-8 text-center">Загрузка статусов проекта...</div>

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Целевые статусы</CardTitle>
            <CardDescription>Конечные результаты (напр. Продажа, Отказ)</CardDescription>
          </div>
          <Button size="sm" onClick={() => addStatus('target')}>
            <Plus className="h-4 w-4 mr-1" /> Добавить
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {targetStatuses.map((status) => (
            <div key={status.id} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-muted-foreground/30" />
              <Input 
                className="h-9 text-sm" 
                defaultValue={status.label}
                onBlur={(e) => {
                   if (e.target.value !== status.label) {
                      updateStatus('target', status.id, { label: e.target.value })
                   }
                }}
              />
              <Input 
                type="color" 
                className="w-12 h-9 p-1 rounded cursor-pointer border-none" 
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
                className="h-9 w-9 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteStatus('target', status.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {targetStatuses.length === 0 && (
             <p className="text-sm text-muted-foreground italic text-center py-6 border-2 border-dashed rounded-lg">
                Статусы не добавлены
             </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Квалификационные статусы</CardTitle>
            <CardDescription>Этапы воронки (напр. В работе, КЦ)</CardDescription>
          </div>
          <Button size="sm" onClick={() => addStatus('qualification')}>
            <Plus className="h-4 w-4 mr-1" /> Добавить
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {qualStatuses.map((status) => (
            <div key={status.id} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-muted-foreground/30" />
              <Input 
                className="h-9 text-sm" 
                defaultValue={status.label}
                onBlur={(e) => {
                   if (e.target.value !== status.label) {
                      updateStatus('qualification', status.id, { label: e.target.value })
                   }
                }}
              />
              <Input 
                type="color" 
                className="w-12 h-9 p-1 rounded cursor-pointer border-none" 
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
                className="h-9 w-9 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
