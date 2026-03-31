"use client"

import { useState, useEffect } from "react"
import { format, subDays } from "date-fns"
import { Plus, Trash2, Eye, EyeOff, GitMerge } from "lucide-react"
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
  
  const addAllExistingUtms = () => {
    const newMappings = [...mappings];
    let addedCount = 0;
    
    existingUtms.forEach(camp => {
      // Проверяем, нет ли уже такой метки в списке (среди UTM или как основное значение)
      const alreadyMapped = newMappings.find(m => m.utmValue === camp.utm);
      if (!alreadyMapped) {
        newMappings.push({
          id: (Date.now() + addedCount) * -1,
          utmValue: camp.utm,
          directValue: "",
          displayName: camp.name || camp.utm
        });
        addedCount++;
      }
    });
    
    if (addedCount > 0) {
      setMappings(newMappings);
      toast.success(`Добавлено ${addedCount} новых строк из Метрики`);
    } else {
      toast.info("Все доступные метки уже добавлены");
    }
  };

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

  if (loading) return (
    <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse uppercase text-[10px] tracking-widest leading-none">Загрузка маппинга кампаний...</p>
    </div>
  );

  return (
    <Card className="border-none shadow-2xl glass-card overflow-hidden rounded-[2.5rem] animate-in fade-in duration-700">
      <CardHeader className="bg-muted/30 border-b border-white/5 p-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <CardTitle className="text-2xl font-black tracking-tight">Маппинг рекламных кампаний</CardTitle>
          <CardDescription className="text-sm font-medium mt-2">
            Свяжите метки из Метрики и названия из Директа в одну кампанию на платформе.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button size="sm" variant="outline" onClick={addAllExistingUtms} disabled={existingUtms.length === 0} className="rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-widest border-white/10 group">
            <GitMerge className="h-4 w-4 mr-2 text-primary group-hover:scale-110 transition-transform" /> 
            Перенести все UTM
          </Button>
          <Button size="sm" onClick={addMapping} className="rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
            <Plus className="h-4 w-4 mr-2" /> Добавить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
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

        <div className="overflow-x-auto">
            <Table>
            <TableHeader className="bg-muted/10 h-16">
                <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="pl-10 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[28%]">UTM Метка (Метрика)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[28%]">ID/Имя Кампании (Директ)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[28%]">Название на Платформе</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-[8%] text-center">Статус</TableHead>
                <TableHead className="w-[8%]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {mappings.map((m) => (
                <TableRow key={m.id} className="border-white/5 hover:bg-primary/5 group h-20">
                    <TableCell className="pl-10">
                    <Input 
                        value={m.utmValue} 
                        placeholder="utm_campaign..." 
                        onChange={(e) => updateMapping(m.id, 'utmValue', e.target.value)}
                        className="h-10 font-mono text-[11px] bg-slate-50/50 border-transparent rounded-xl px-4 hover:bg-white focus:bg-white transition-all shadow-sm"
                        list="existing-utms"
                    />
                    </TableCell>
                    <TableCell>
                    <Input 
                        value={m.directValue} 
                        placeholder="ID или название..." 
                        onChange={(e) => updateMapping(m.id, 'directValue', e.target.value)}
                        className="h-10 font-mono text-[11px] bg-slate-50/50 border-transparent rounded-xl px-4 hover:bg-white focus:bg-white transition-all shadow-sm"
                        list="existing-directs"
                    />
                    </TableCell>
                    <TableCell>
                    <Input 
                        value={m.displayName} 
                        placeholder="Напр. Поиск: Ретаргетинг" 
                        onChange={(e) => updateMapping(m.id, 'displayName', e.target.value)}
                        className="h-10 text-[11px] font-black tracking-tight bg-slate-50/50 border-transparent rounded-xl px-4 hover:bg-white focus:bg-white transition-all shadow-sm"
                    />
                    </TableCell>
                    <TableCell className="text-center">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-xl"
                        onClick={() => updateMapping(m.id, 'isHidden', !m.isHidden)}
                        title={m.isHidden ? "Показать в отчетах" : "Скрыть из отчетов"}
                    >
                        {m.isHidden ? <EyeOff className="h-4 w-4 text-orange-500" /> : <Eye className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />}
                    </Button>
                    </TableCell>
                    <TableCell className="pr-10">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-xl text-slate-200 hover:text-destructive hover:bg-destructive/5 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => removeMapping(m.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>

        {mappings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-30">
            <GitMerge className="h-12 w-12 mb-4 text-muted-foreground" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Маппинг не настроен</p>
          </div>
        )}
        
        <div className="p-10 bg-muted/20 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
           <div className="flex items-start gap-4 max-w-xl">
             <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
               <Eye className="h-5 w-5 text-primary" />
             </div>
             <p className="text-[11px] font-medium leading-relaxed text-muted-foreground leading-relaxed">
               <span className="font-black uppercase tracking-tight text-foreground/80 block mb-1">Как это работает:</span>
               Объединяя UTM из Метрики и Кампании из Директа под одним общим именем, вы получаете сквозную аналитику в единой строке отчёта.
             </p>
           </div>
           <Button onClick={saveMappings} disabled={saving} className="h-14 px-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-primary/30 w-full sm:w-auto">
             {saving ? "Сохранение..." : "Сохранить маппинг"}
           </Button>
        </div>
      </CardContent>
    </Card>
  )
}
