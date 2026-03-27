"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Trash2, Save, Loader2, ArrowRight } from "lucide-react"

export function CrmStageMappingsManager() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [mappings, setMappings] = useState<any[]>([])
  const [targetStatuses, setTargetStatuses] = useState<any[]>([])
  const [qualStatuses, setQualStatuses] = useState<any[]>([])
  const [leadStages, setLeadStages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/projects").then(res => res.json()).then(setProjects)
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      fetchMappings()
      fetchStatuses()
    }
  }, [selectedProjectId])

  const fetchStatuses = async () => {
    const [tRes, qRes, sRes] = await Promise.all([
      fetch(`/api/projects/${selectedProjectId}/statuses/target`),
      fetch(`/api/projects/${selectedProjectId}/statuses/qualification`),
      fetch(`/api/projects/${selectedProjectId}/statuses/stages`)
    ])
    if (tRes.ok) setTargetStatuses(await tRes.json())
    if (qRes.ok) setQualStatuses(await qRes.json())
    if (sRes.ok) setLeadStages(await sRes.json())
  }

  const fetchMappings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/crm-mappings`)
      if (res.ok) setMappings(await res.json())
    } catch (e) {
      toast.error("Ошибка при загрузке маппингов")
    } finally {
      setLoading(false)
    }
  }

  const handleAddMapping = () => {
    setMappings([...mappings, { crmStageName: "", targetStatusId: null, qualificationStatusId: null, leadStageId: null }])
  }

  const handleRemoveMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/crm-mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings })
      })
      if (res.ok) {
        toast.success("Настройки маппинга сохранены")
        fetchMappings()
      } else {
        toast.error("Ошибка при сохранении")
      }
    } catch (e) {
      toast.error("Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  if (!projects.length) return null

  return (
    <Card className="shadow-sm border-neutral-200 lg:col-span-2">
      <CardHeader className="bg-neutral-50/50">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                    <ArrowRight className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                    <CardTitle className="text-lg">Маппинг статусов CRM</CardTitle>
                    <CardDescription>Свяжите названия этапов из вашей CRM с внутренними статусами платформы.</CardDescription>
                </div>
            </div>
            <div className="w-48">
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger><SelectValue placeholder="Выберите проект" /></SelectTrigger>
                    <SelectContent>
                        {projects.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {selectedProjectId ? (
            <div className="space-y-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] uppercase text-neutral-400 font-bold border-b">
                                <th className="pb-2 text-left">Этап в CRM (Текст)</th>
                                <th className="pb-2 text-left">Целевой</th>
                                <th className="pb-2 text-left">Квал</th>
                                <th className="pb-2 text-left">Этап сделки</th>
                                <th className="pb-2 w-[40px]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {mappings.map((m, idx) => (
                                <tr key={idx} className="group hover:bg-neutral-50/50 transition-colors">
                                    <td className="py-2 pr-4">
                                        <Input 
                                            placeholder="Например: Сделка создана" 
                                            value={m.crmStageName}
                                            onChange={(e) => {
                                                const newMappings = [...mappings]
                                                newMappings[idx].crmStageName = e.target.value
                                                setMappings(newMappings)
                                            }}
                                            className="h-9 text-xs"
                                        />
                                    </td>
                                    <td className="py-2 pr-4">
                                        <Select 
                                            value={m.targetStatusId?.toString() || "none"} 
                                            onValueChange={(v) => {
                                                const newMappings = [...mappings]
                                                newMappings[idx].targetStatusId = v === "none" ? null : parseInt(v)
                                                setMappings(newMappings)
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Нет</SelectItem>
                                                {targetStatuses.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="py-2 pr-4">
                                        <Select 
                                            value={m.qualificationStatusId?.toString() || "none"} 
                                            onValueChange={(v) => {
                                                const newMappings = [...mappings]
                                                newMappings[idx].qualificationStatusId = v === "none" ? null : parseInt(v)
                                                setMappings(newMappings)
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Нет</SelectItem>
                                                {qualStatuses.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="py-2 pr-4">
                                        <Select 
                                            value={m.leadStageId?.toString() || "none"} 
                                            onValueChange={(v) => {
                                                const newMappings = [...mappings]
                                                newMappings[idx].leadStageId = v === "none" ? null : parseInt(v)
                                                setMappings(newMappings)
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Нет</SelectItem>
                                                {leadStages.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="py-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveMapping(idx)} className="h-8 w-8 text-neutral-300 hover:text-red-500">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-between items-center pt-4 border-t">
                    <Button variant="outline" size="sm" onClick={handleAddMapping}>
                        <Plus className="h-4 w-4 mr-2" /> Добавить правило
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={loading} className="min-w-[120px]">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Сохранить
                    </Button>
                </div>
            </div>
        ) : (
            <div className="py-12 text-center text-muted-foreground italic border-2 border-dashed rounded-lg bg-neutral-50/50">
                Выберите проект для настройки правил маппинга.
            </div>
        )}

        {selectedProjectId && (
            <div className="mt-8 pt-8 border-t">
                <LeadStagesManager projectId={parseInt(selectedProjectId)} />
            </div>
        )}
      </CardContent>
    </Card>
  )
}

import { LeadStagesManager } from "./lead-stages-manager"
