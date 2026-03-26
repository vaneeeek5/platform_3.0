"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    try {
      await fetch(`/api/projects/${projectId}/statuses/${type}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <div>Загрузка статусов...</div>

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Целевые статусы</CardTitle>
            <CardDescription>Статусы финального результата (напр. Продажа, Отказ)</CardDescription>
          </div>
          <Button size="sm" onClick={() => addStatus('target')}>
            <Plus className="h-4 w-4 mr-1" /> Добавить
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {targetStatuses.map((status) => (
            <div key={status.id} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-muted-foreground/30" />
              <div 
                className="w-4 h-4 rounded-full border" 
                style={{ backgroundColor: status.color }}
              />
              <Input 
                className="h-8 text-sm" 
                defaultValue={status.label}
                onBlur={(e) => updateStatus('target', status.id, { label: e.target.value })}
              />
              <Input 
                type="color" 
                className="w-10 h-8 p-1 rounded cursor-pointer" 
                defaultValue={status.color}
                onBlur={(e) => updateStatus('target', status.id, { color: e.target.value })}
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
          ))}
          {targetStatuses.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-4">Нет статусов</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Квалификационные статусы</CardTitle>
            <CardDescription>Статусы воронки (напр. В работе, КЦ, Перезвонить)</CardDescription>
          </div>
          <Button size="sm" onClick={() => addStatus('qualification')}>
            <Plus className="h-4 w-4 mr-1" /> Добавить
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {qualStatuses.map((status) => (
            <div key={status.id} className="flex items-center gap-2 group">
              <GripVertical className="h-4 w-4 text-muted-foreground/30" />
              <div 
                className="w-4 h-4 rounded-full border" 
                style={{ backgroundColor: status.color }}
              />
              <Input 
                className="h-8 text-sm" 
                defaultValue={status.label}
                onBlur={(e) => updateStatus('qualification', status.id, { label: e.target.value })}
              />
              <Input 
                type="color" 
                className="w-10 h-8 p-1 rounded cursor-pointer" 
                defaultValue={status.color}
                onBlur={(e) => updateStatus('qualification', status.id, { color: e.target.value })}
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
          {qualStatuses.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-4">Нет статусов</p>}
        </CardContent>
      </Card>
    </div>
  )
}
