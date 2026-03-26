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
  
  // For autocomplete
  const [existingCampaigns, setExistingCampaigns] = useState<{utm: string, name: string}[]>([])

  useEffect(() => {
    fetchMappings()
    fetchExistingCampaigns()
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

  const fetchExistingCampaigns = async () => {
    try {
      // Fetch the expenses report to get a list of active campaigns
      const today = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const params = new URLSearchParams({
          projectId: projectId.toString(),
          dateFrom: thirtyDaysAgo.toISOString(),
          dateTo: today.toISOString()
      });
      
      const res = await fetch(`/api/reports/expenses?${params}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        // Extract unique utm values and their current names
        const campaigns = data.map((d: any) => ({
          utm: d.utmCampaign || "",
          name: d.campaignName || d.utmCampaign || ""
        })).filter((c: any) => c.utm);
        
        // Remove duplicates
        const unique = Array.from(new Map(campaigns.map((item: any) => [item.utm, item])).values()) as {utm: string, name: string}[];
        setExistingCampaigns(unique);
      }
    } catch (e) {
       console.error("Failed to load existing campaigns for autocomplete");
    }
  }

  const addMapping = () => {
    setMappings([...mappings, { id: Date.now() * -1, utmValue: "", displayName: "" }])
  }

  const updateMapping = (id: number, field: keyof Mapping, value: string) => {
    setMappings(mappings.map(m => {
      if (m.id !== id) return m;
      
      const updated = { ...m, [field]: value };
      
      // Auto-fill displayName if utmValue is selected from existing campaigns
      if (field === 'utmValue' && !m.displayName) {
        const match = existingCampaigns.find(c => c.utm === value);
        if (match && match.name && match.name !== value) {
          updated.displayName = match.name;
        }
      }
      
      return updated;
    }))
  }

  const removeMapping = (id: number) => {
    setMappings(mappings.filter(m => m.id !== id))
  }

  const saveMappings = async () => {
    // Prevent empty rows
    const validMappings = mappings.filter(m => m.utmValue && m.displayName)
    
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
            Привяжите UTM-метки (или ID кампаний) к их понятным названиям.
          </CardDescription>
        </div>
        <Button size="sm" onClick={addMapping}>
          <Plus className="h-4 w-4 mr-1" /> Добавить строку
        </Button>
      </CardHeader>
      <CardContent>
        <datalist id="existing-campaigns">
          {existingCampaigns.map((camp) => (
            <option key={camp.utm} value={camp.utm} />
          ))}
        </datalist>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45%]">Метка (UTM / ID)</TableHead>
              <TableHead className="w-[45%]">Отображаемое название</TableHead>
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
                    list="existing-campaigns"
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Input 
                    value={m.displayName} 
                    placeholder="Напр. Поиск: Общие запросы" 
                    onChange={(e) => updateMapping(m.id, 'displayName', e.target.value)}
                    className="h-8 text-xs"
                  />
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
