"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Trash2, Save, Loader2, LayoutGrid } from "lucide-react"

export function LeadStagesManager({ projectId }: { projectId: number }) {
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (projectId) fetchStages()
  }, [projectId])

  const fetchStages = async () => {
    const res = await fetch(`/api/projects/${projectId}/statuses/stages`)
    if (res.ok) setStages(await res.json())
  }

  const handleAdd = () => {
    setStages([...stages, { label: "Новый этап", color: "#6366f1", sortOrder: stages.length }])
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/statuses/stages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages })
      })
      if (res.ok) {
        toast.success("Этапы сохранены")
        fetchStages()
      } else {
        toast.error("Ошибка при сохранении")
      }
    } catch (e) {
      toast.error("Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-neutral-200">
      <CardHeader className="bg-neutral-50/50">
        <div className="flex items-center gap-3">
            <LayoutGrid className="h-5 w-5 text-indigo-500" />
            <div>
                <CardTitle className="text-sm">Справочник: Этапы сделки</CardTitle>
                <CardDescription className="text-[10px]">Список этапов для колонки «Этап сделки».</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
            {stages.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                    <Input 
                        value={s.label} 
                        onChange={(e) => {
                            const ns = [...stages]; ns[idx].label = e.target.value; setStages(ns)
                        }}
                        className="h-8 text-[11px]"
                    />
                    <Input 
                        type="color" 
                        value={s.color} 
                        onChange={(e) => {
                            const ns = [...stages]; ns[idx].color = e.target.value; setStages(ns)
                        }}
                        className="w-10 h-8 p-1 cursor-pointer"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setStages(stages.filter((_, i) => i !== idx))} className="h-8 w-8 text-neutral-300 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
        </div>
        <div className="flex justify-between border-t pt-4">
            <Button variant="outline" size="sm" onClick={handleAdd} className="h-8 text-[11px]">
                <Plus className="h-3 w-3 mr-1" /> Добавить
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading} className="h-8 text-[11px]">
                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Сохранить
            </Button>
        </div>
      </CardContent>
    </Card>
  )
}
