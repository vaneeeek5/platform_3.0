"use client"

import { useState, useEffect } from "react"
import { format, subDays } from "date-fns"
import { Plus, Trash2, Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Mapping {
  id: number
  utmValue: string
  directValue: string
  displayName: string
  isHidden?: boolean
}

export function CampaignMappingSettings({ projectId }: { projectId: number }) {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // For autocomplete
  const [existingUtms, setExistingUtms] = useState<{utm: string, name: string}[]>([])
  const [existingDirects, setExistingDirects] = useState<{direct: string, name: string}[]>([])

  useEffect(() => {
    fetchMappings()
    fetchExistingCampaigns()
  }, [projectId])

  const fetchMappings = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/campaign-mappings`)
      const data = await res.json()
      setMappings(Array.isArray(data) ? data.map(d => ({ ...d, directValue: d.directValue || '', utmValue: d.utmValue || '' })) : [])
    } catch (e) {
      toast.error("Не удалось загрузить маппинг кампаний")
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingCampaigns = async () => {
    try {
      // Fetch the expenses report with raw mode to get unique UTM/Direct pairs
      const today = new Date();
      const thirtyDaysAgo = subDays(today, 30);
      
      const params = new URLSearchParams({
          projectId: projectId.toString(),
          dateFrom: format(thirtyDaysAgo, 'yyyy-MM-dd'),
          dateTo: format(today, 'yyyy-MM-dd'),
          raw: 'true'
      });
      
      const res = await fetch(`/api/reports/expenses?${params}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        // Extract unique utm values
        const utms = data.map((d: any) => ({
          utm: d.utmCampaign || "",
          name: d.campaignName || d.utmCampaign || ""
        })).filter((c: any) => c.utm);
        
        const uniqueUtms = Array.from(new Map(utms.map((item: any) => [item.utm, item])).values()) as {utm: string, name: string}[];
        setExistingUtms(uniqueUtms);

        // Extract unique direct orders
        const directs = data.map((d: any) => ({
          direct: d.directOrder || "",
          name: d.campaignName || d.directOrder || ""
        })).filter((c: any) => c.direct);
        
        const uniqueDirects = Array.from(new Map(directs.map((item: any) => [item.direct, item])).values()) as {direct: string, name: string}[];
        setExistingDirects(uniqueDirects);
      }
    } catch (e) {
       console.error("Failed to load existing campaigns for autocomplete");
    }
  }

  const addMapping = () => {
    setMappings([...mappings, { id: Date.now() * -1, utmValue: "", directValue: "", displayName: "" }])
  }

  const updateMapping = (id: number, field: keyof Mapping, value: string | boolean) => {
    setMappings(mappings.map(m => {
      if (m.id !== id) return m;
      
      const updated = { ...m, [field]: value };
      
      // Auto-fill displayName if utmValue is selected
      if (field === 'utmValue' && !m.displayName) {
        const match = existingUtms.find(c => c.utm === value);
        if (match && match.name && match.name !== value) {
          updated.displayName = match.name;
        } else if (typeof value === 'string' && value) {
          updated.displayName = value;
        }
      }

      // Auto-fill displayName if directValue is selected and name is empty (or same as utm)
      if (field === 'directValue' && (!m.displayName || m.displayName === m.utmValue)) {
        const match = existingDirects.find(c => c.direct === value);
        if (match && match.name && match.name !== value) {
          updated.displayName = match.name;
        } else if (typeof value === 'string' && value) {
          updated.displayName = value;
        }
      }
      
      return updated;
    }))
  }

  const removeMapping = (id: number) => {
    setMappings(mappings.filter(m => m.id !== id))
  }

  const saveMappings = async () => {
    // Prevent empty rows (must have either UTM or Direct AND a display name)
    const validMappings = mappings.filter(m => (m.utmValue || m.directValue) && m.displayName)
    
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/campaign-mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: validMappings }),
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
            Свяжите метки из Метрики и названия из Директа в одну кампанию на платформе.
          </CardDescription>
        </div>
        <Button size="sm" onClick={addMapping}>
          <Plus className="h-4 w-4 mr-1" /> Добавить строку
        </Button>
      </CardHeader>
      <CardContent>
        <datalist id="existing-utms">
          {existingUtms
            .filter((camp) => !mappings.some(m => m.utmValue === camp.utm))
            .map((camp) => (
              <option key={camp.utm} value={camp.utm} />
          ))}
        </datalist>
        <datalist id="existing-directs">
          {existingDirects.map((camp) => (
            <option key={camp.direct} value={camp.direct} />
          ))}
        </datalist>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Метка в Метрике (UTM)</TableHead>
              <TableHead className="w-[30%]">Название в Директе</TableHead>
              <TableHead className="w-[30%]">Название на Платформе</TableHead>
              <TableHead className="w-[10%] text-center">Скрыть</TableHead>
              <TableHead className="w-[10%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Input 
                    value={m.utmValue} 
                    placeholder="Выберите или введите..." 
                    onChange={(e) => updateMapping(m.id, 'utmValue', e.target.value)}
                    className="h-8 font-mono text-xs"
                    list="existing-utms"
                  />
                </TableCell>
                <TableCell>
                  <Input 
                    value={m.directValue} 
                    placeholder="Выберите или введите..." 
                    onChange={(e) => updateMapping(m.id, 'directValue', e.target.value)}
                    className="h-8 font-mono text-xs"
                    list="existing-directs"
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input 
                    value={m.displayName} 
                    placeholder="Напр. Поиск: Общие" 
                    onChange={(e) => updateMapping(m.id, 'displayName', e.target.value)}
                    className="h-8 text-xs font-medium"
                  />
                </TableCell>
                <TableCell className="align-top text-center">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => updateMapping(m.id, 'isHidden', !m.isHidden)}
                    title={m.isHidden ? "Показать в отчетах" : "Скрыть из отчетов"}
                  >
                    {m.isHidden ? <EyeOff className="h-4 w-4 text-orange-500" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </TableCell>
                <TableCell className="align-top">
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
