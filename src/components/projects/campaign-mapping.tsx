"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Mapping {
  id: number
  utmValue: string
  displayName: string
}

export function CampaignMappingSettings({ projectId }: { projectId: number }) {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMappings()
  }, [projectId])

  const fetchMappings = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/campaign-mappings`)
      const data = await res.json()
      setMappings(Array.isArray(data) ? data : [])
    } catch (e) {
      toast.error("Не удалось загрузить маппинг кампаний")
    } finally {
      setLoading(false)
    }
  }

  const addMapping = () => {
    setMappings([...mappings, { id: Date.now() * -1, utmValue: "", displayName: "" }])
  }

  const updateMapping = (id: number, field: keyof Mapping, value: string) => {
    setMappings(mappings.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  const removeMapping = (id: number) => {
    setMappings(mappings.filter(m => m.id !== id))
  }

  const saveMappings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/campaign-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      })
      if (res.ok) {
        toast.success("Маппинг кампаний сохранен")
        fetchMappings()
      } else {
        toast.error("Ошибка при сохранении")
      }
    } catch (e) {
      toast.error("Произошла ошибка")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Загрузка маппинга...</div>

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Маппинг рекламных кампаний</CardTitle>
          <CardDescription>
            Привяжите UTM-метки или ID кампаний к их понятным названиям.
          </CardDescription>
        </div>
        <Button size="sm" onClick={addMapping}>
          <Plus className="h-4 w-4 mr-1" /> Добавить строку
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Метка (UTM / ID)</TableHead>
              <TableHead>Отображаемое название</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Input 
                    value={m.utmValue} 
                    placeholder="Напр. cpc_yandex" 
                    onChange={(e) => updateMapping(m.id, 'utmValue', e.target.value)}
                    className="h-8 font-mono text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    value={m.displayName} 
                    placeholder="Напр. Поиск: Общие запросы" 
                    onChange={(e) => updateMapping(m.id, 'displayName', e.target.value)}
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMapping(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {mappings.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 italic">
            Маппинг не настроен. Нажмите «Добавить строку», чтобы начать.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Button onClick={saveMappings} disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить маппинг"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
