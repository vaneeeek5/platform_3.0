"use client"

import { useState, useEffect } from "react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, Download, Edit2, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { LeadEditDialog } from "./lead-edit-dialog"
import * as XLSX from "xlsx"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { subDays } from "date-fns"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"


interface LeadsListProps {
  projectId: number;
  showProjectColumn?: boolean;
}

export function LeadsList({ projectId, showProjectColumn = false }: LeadsListProps) {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  })
  const [filterSources, setFilterSources] = useState<string[]>([])
  const [filterGoals, setFilterGoals] = useState<string[]>([])
  const [targetStatuses, setTargetStatuses] = useState<any[]>([])
  const [qualStatuses, setQualStatuses] = useState<any[]>([])
  const [leadStages, setLeadStages] = useState<any[]>([])
  const [filterTargetStatusIds, setFilterTargetStatusIds] = useState<string[]>([])
  const [filterQualStatusIds, setFilterQualStatusIds] = useState<string[]>([])
  const [filterStageIds, setFilterStageIds] = useState<string[]>([])
  const [filterOptions, setFilterOptions] = useState<{ sources: string[], goals: string[] }>({ sources: [], goals: [] })


  useEffect(() => {
    setMounted(true)
    if (projectId) {
       fetchLeads()
       fetchStatuses()
       fetchFilterOptions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, dateRange, filterSources, filterGoals, filterTargetStatusIds, filterQualStatusIds, filterStageIds])

  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/filters`)
      if (res.ok) setFilterOptions(await res.json())
    } catch (e) {
      console.error("Failed to fetch filter options")
    }
  }

  const fetchStatuses = async () => {
    const [tRes, qRes, sRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/statuses/target`),
      fetch(`/api/projects/${projectId}/statuses/qualification`),
      fetch(`/api/projects/${projectId}/statuses/stages`)
    ])
    if (tRes.ok) setTargetStatuses(await tRes.json())
    if (qRes.ok) setQualStatuses(await qRes.json())
    if (sRes.ok) setLeadStages(await sRes.json())
  }

  const fetchLeads = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (projectId) params.append("projectId", projectId.toString())
    if (query) params.append("query", query)
    
    // Исправление сдвига даты на день: используем YYYY-MM-DD вместо ISOString
    if (dateRange?.from) params.append("dateFrom", format(dateRange.from, 'yyyy-MM-dd'))
    if (dateRange?.to) params.append("dateTo", format(dateRange.to, 'yyyy-MM-dd'))
    
    if (filterSources.length > 0) params.append("sources", filterSources.join(","))
    if (filterGoals.length > 0) params.append("goals", filterGoals.join(","))
    if (filterTargetStatusIds.length > 0) params.append("targetStatusIds", filterTargetStatusIds.join(","))
    if (filterQualStatusIds.length > 0) params.append("qualStatusIds", filterQualStatusIds.join(","))
    if (filterStageIds.length > 0) params.append("stageIds", filterStageIds.join(","))
    
    try {
      const res = await fetch(`/api/leads?${params.toString()}`)
      if (res.ok) {
         setLeads(await res.json())
      } else {
         const errData = await res.json()
         console.error("API Error:", errData)
         toast.error(errData.error || "Ошибка при загрузке лидов")
      }
    } catch (e) {
      console.error("Fetch fatal error:", e)
      toast.error("Ошибка сети или сервера")
    } finally {
      setLoading(false)
    }
  }

  const handleResetAll = () => {
    setFilterSources([]);
    setFilterGoals([]);
    setFilterTargetStatusIds([]);
    setFilterQualStatusIds([]);
    setFilterStageIds([]);
    setQuery("");
    toast.success("Все фильтры сброшены");
  };

    const handleExport = () => {
    if (leads.length === 0) return;
    const exportData = leads.map(item => ({
      "Дата": format(new Date(item.lead.date), "dd.MM.yyyy HH:mm"),
      "Источник": item.lead.utmSource || "direct",
      "Кампания": item.lead.utmCampaign || "—",
      "Цели": item.achievements?.map((a: any) => a.goalName).join(", "),
      "ClientID": item.lead.metrikaClientId || "—",
      "Сумма": item.achievements?.reduce((acc: number, a: any) => acc + parseFloat(a.saleAmount || "0"), 0)
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `Leads_Project_${projectId}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const handleDedup = async () => {
    try {
      const checkRes = await fetch(`/api/leads/dedup?projectId=${projectId}`);
      const checkData = await checkRes.json();
      
      if (checkData.duplicateCount === 0) {
        toast.success("Дубликатов не найдено");
        return;
      }

      const confirmDel = confirm(`Найдено дублей: ${checkData.duplicateCount}. Удалить их, оставив только уникальные записи?`);
      if (!confirmDel) return;

      setLoading(true);
      const delRes = await fetch(`/api/leads/dedup?projectId=${projectId}`, { method: 'DELETE' });
      if (delRes.ok) {
        toast.success("Дубликаты успешно удалены");
        fetchLeads();
      } else {
        toast.error("Ошибка при удалении дубликатов");
      }
    } catch (e) {
      toast.error("Ошибка при проверке дубликатов");
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (achievementId: number, field: string, value: any) => {
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: achievementId,
          [field]: value === "none" ? null : parseInt(value)
        })
      });
      if (res.ok) {
        toast.success("Статус обновлен");
        fetchLeads();
      } else {
        toast.error("Ошибка при обновлении статуса");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    }
  };

  const updateLeadStage = async (leadId: number, stageId: any) => {
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: leadId,
          stageId: stageId === "none" ? null : parseInt(stageId)
        })
      });
      if (res.ok) {
        toast.success("Этап обновлен");
        fetchLeads();
      } else {
        toast.error("Ошибка при обновлении этапа");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="flex flex-1 gap-2 items-center w-full">
            <div className="relative flex-1 max-w-sm">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input 
                  placeholder="Поиск по ClientID или Кампании..." 
                  className="pl-9 h-9 text-xs"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
               />
            </div>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
         </div>
         <div className="flex gap-2 flex-wrap items-center justify-end">
            {(filterSources.length > 0 || filterGoals.length > 0 || filterTargetStatusIds.length > 0 || filterQualStatusIds.length > 0 || filterStageIds.length > 0 || query) && (
               <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={handleResetAll}
                 className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 text-[10px]"
               >
                 Сбросить всё
               </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDedup} disabled={loading} title="Проверить и удалить дубликаты" className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
               Удалить дубли
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={leads.length === 0}>
               <Download className="h-4 w-4 mr-2" />
               Excel
            </Button>
            <Button size="sm" onClick={fetchLeads} disabled={loading} className="bg-slate-900">
               Обновить
            </Button>
         </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-md p-2 flex items-start gap-2">
         <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
         <p className="text-[10px] text-blue-700">
            Данные из Яндекс.Метрики (Logs API) поступают с задержкой. Актуальная статистика доступна за вчерашний день и ранее.
         </p>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[140px] text-xs">Дата</TableHead>
              {showProjectColumn && <TableHead className="text-xs">Проект</TableHead>}
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Источник
                    <FilterPopover 
                       title="ФИЛЬТР ПО ИСТОЧНИКУ"
                       options={filterOptions.sources} 
                       selected={filterSources} 
                       onChange={(val) => setFilterSources(val)} 
                    />
                 </div>
              </TableHead>
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Цели
                    <FilterPopover 
                       title="ФИЛЬТР ПО ЦЕЛЯМ"
                       options={filterOptions.goals} 
                       selected={filterGoals} 
                       onChange={(val) => setFilterGoals(val)} 
                    />
                 </div>
              </TableHead>
              <TableHead className="text-xs">ClientID</TableHead>
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Статус
                    <FilterPopover 
                       title="ФИЛЬТР ПО СТАТУСУ"
                       options={targetStatuses.map(s => ({ label: s.label, value: s.id.toString() }))} 
                       selected={filterTargetStatusIds} 
                       onChange={(val) => setFilterTargetStatusIds(val)} 
                       useObjects
                    />
                 </div>
              </TableHead>
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Квал
                    <FilterPopover 
                       title="ФИЛЬТР ПО КВАЛ"
                       options={qualStatuses.map(s => ({ label: s.label, value: s.id.toString() }))} 
                       selected={filterQualStatusIds} 
                       onChange={(val) => setFilterQualStatusIds(val)} 
                       useObjects
                    />
                 </div>
              </TableHead>
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Этап сделки
                    <FilterPopover 
                       title="ФИЛЬТР ПО ЭТАПУ"
                       options={leadStages.map(s => ({ label: s.label, value: s.id.toString() }))} 
                       selected={filterStageIds} 
                       onChange={(val) => setFilterStageIds(val)} 
                       useObjects
                    />
                 </div>
              </TableHead>
              <TableHead className="text-right text-xs">Сумма</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={showProjectColumn ? 9 : 8} className="h-24 text-center text-xs text-muted-foreground bg-neutral-50/50">Загрузка...</TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={showProjectColumn ? 9 : 8} className="h-24 text-center text-xs text-muted-foreground">Лиды не найдены</TableCell></TableRow>
            ) : leads.map((item) => (
              <TableRow key={item.lead.id} className="hover:bg-neutral-50 transition-colors">
                <TableCell className="text-[10px] whitespace-nowrap">
                  {mounted && item.lead?.date ? format(new Date(item.lead.date), "dd.MM.yyyy HH:mm", { locale: ru }) : '—'}
                </TableCell>
                {showProjectColumn && (
                   <TableCell className="text-xs">{item.project?.name}</TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">{item.lead.utmSource || 'direct'}</span>
                    {item.lead.utmCampaign && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[150px] uppercase">
                        {item.lead.utmCampaign}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-wrap gap-1">
                      {item.achievements?.map((a: any) => (
                         <span key={a.id} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {a.goalName}
                         </span>
                      ))}
                   </div>
                </TableCell>
                <TableCell className="text-[10px] font-mono text-muted-foreground">
                  {item.lead.metrikaClientId || '—'}
                </TableCell>
                <TableCell>
                   <div className="flex flex-col gap-1">
                      {item.achievements?.map((a: any) => (
                        <Select 
                          key={a.id}
                          value={a.targetStatusId?.toString() || "none"} 
                          onValueChange={(val) => updateLeadStatus(a.id, 'targetStatusId', val)}
                        >
                          <SelectTrigger className="h-7 text-[9px] px-2 w-[100px] max-w-[120px] border-neutral-200 overflow-hidden">
                            <SelectValue placeholder="Статус" className="truncate" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-[10px]">Не выбран</SelectItem>
                            {targetStatuses.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()} className="text-[10px]">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: s.color }} />
                                  {s.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ))}
                   </div>
                </TableCell>

                <TableCell>
                   <div className="flex flex-col gap-1">
                      {item.achievements?.map((a: any) => (
                        <Select 
                          key={a.id}
                          value={a.qualificationStatusId?.toString() || "none"} 
                          onValueChange={(val) => updateLeadStatus(a.id, 'qualificationStatusId', val)}
                        >
                          <SelectTrigger className="h-7 text-[9px] px-2 w-[100px] max-w-[120px] border-neutral-200 overflow-hidden">
                            <SelectValue placeholder="Квал" className="truncate" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-[10px]">Не выбран</SelectItem>
                            {qualStatuses.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()} className="text-[10px]">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: s.color }} />
                                  {s.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ))}
                   </div>
                </TableCell>

                <TableCell>
                    <Select 
                        value={item.lead.stageId?.toString() || "none"} 
                        onValueChange={(val) => updateLeadStage(item.lead.id, val)}
                    >
                        <SelectTrigger className="h-7 text-[9px] px-2 w-[110px] max-w-[150px] border-neutral-200 bg-neutral-50/50 overflow-hidden">
                        <SelectValue placeholder="Этап" className="truncate w-full" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="none" className="text-[10px]">Не выбран</SelectItem>
                        {leadStages.map(s => (
                            <SelectItem key={s.id} value={s.id.toString()} className="text-[10px]">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: s.color }} />
                                {s.label}
                            </div>
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </TableCell>

                <TableCell className="text-right text-xs font-bold text-neutral-800">
                  {(() => {
                    const total = item.achievements?.reduce((acc: number, a: any) => acc + (parseFloat(a.saleAmount) || 0), 0) || 0;
                    return total > 0 ? `${total.toLocaleString()} ₽` : "—";
                  })()}
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-neutral-400 hover:text-black"
                    onClick={() => {
                       setSelectedLead(item)
                       setIsEditDialogOpen(true)
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LeadEditDialog 
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={fetchLeads}
        lead={selectedLead}
        projectId={projectId}
      />
    </div>
  )
}

function FilterPopover({ title, options, selected, onChange, useObjects = false }: { title: string, options: any[], selected: string[], onChange: (val: string[]) => void, useObjects?: boolean }) {
   const [pending, setPending] = useState<string[]>(selected)
   const [open, setOpen] = useState(false)

   useEffect(() => {
     setPending(selected)
   }, [selected])

   return (
      <Popover open={open} onOpenChange={setOpen}>
         <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-neutral-100">
               <Filter className={`h-3 w-3 ${selected.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
         </PopoverTrigger>
         <PopoverContent className="w-64 p-0 bg-white shadow-2xl rounded-lg border border-neutral-200" align="start">
            <div className="p-4 space-y-3">
               <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{title}</p>
               <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar pr-2">
                  {options.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic px-1">Нет данных для фильтрации</p>
                  ) : options.map(opt => {
                     const label = useObjects ? opt.label : opt;
                     const value = useObjects ? opt.value : opt;
                     return (
                        <div key={value} className="flex items-center space-x-3 px-2 py-2 hover:bg-neutral-50 rounded-md transition-colors cursor-pointer group" onClick={() => {
                            if (pending.includes(value)) setPending(pending.filter(s => s !== value))
                            else setPending([...pending, value])
                        }}>
                           <Checkbox 
                              id={value} 
                              checked={pending.includes(value)} 
                              className="w-4 h-4 rounded border-neutral-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                           />
                           <label htmlFor={value} className="text-xs text-neutral-700 cursor-pointer truncate flex-1 group-hover:text-black transition-colors">{label}</label>
                        </div>
                     )
                  })}
               </div>
               
               <div className="pt-3 border-t flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 h-8 text-[11px] font-medium border-neutral-200"
                    onClick={() => { setPending([]); onChange([]); setOpen(false); }}
                  >
                     Сбросить
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 h-8 text-[11px] font-bold shadow-md shadow-primary/20"
                    onClick={() => {
                       onChange(pending);
                       setOpen(false);
                    }}
                  >
                     ОК / ПРИМЕНИТЬ
                  </Button>
               </div>
            </div>
         </PopoverContent>
      </Popover>
   )
}
