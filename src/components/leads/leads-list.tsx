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
import { cn } from "@/lib/utils"
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
         toast.error(errData.error || "Ошибка при загрузке лидов")
      }
    } catch (e) {
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
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="glass-card p-6 border-white/10 shadow-xl flex flex-col xl:flex-row gap-6 items-end">
         <div className="flex flex-col gap-2 w-full xl:w-[320px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Поиск</label>
            <div className="relative group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40 group-focus-within:opacity-100 transition-opacity" />
               <Input 
                  placeholder="ClientID или Кампания..." 
                  className="pl-11 h-11 glass-card border-white/5 focus-visible:ring-primary/20 rounded-xl"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
               />
            </div>
         </div>
         
         <div className="w-full xl:w-[320px]">
             <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">Период</label>
             <DatePickerWithRange date={dateRange} setDate={setDateRange} />
         </div>

         <div className="flex flex-wrap gap-3 flex-1 justify-end">
            {(filterSources.length > 0 || filterGoals.length > 0 || filterTargetStatusIds.length > 0 || filterQualStatusIds.length > 0 || filterStageIds.length > 0 || query) && (
               <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={handleResetAll}
                 className="text-destructive hover:bg-destructive/10 h-11 px-4 rounded-xl font-bold uppercase text-[10px] tracking-widest"
               >
                 Сбросить всё
               </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDedup} disabled={loading} className="h-11 px-4 rounded-xl border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold uppercase text-[10px] tracking-widest">
               Дубли
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={leads.length === 0} className="h-11 px-6 rounded-xl border-primary/20 text-primary font-bold uppercase text-[10px] tracking-widest">
               <Download className="h-4 w-4 mr-2" />
               Excel
            </Button>
            <Button size="sm" onClick={fetchLeads} disabled={loading} className="h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-primary/20">
               Обновить
            </Button>
         </div>
      </div>

      <div className="glass-card bg-primary/5 border-primary/10 p-3 flex items-center gap-3 rounded-2xl">
         <div className="p-2 bg-primary/10 rounded-xl">
             <AlertCircle className="h-4 w-4 text-primary" />
         </div>
         <p className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">
            Яндекс.Метрика (Logs API) передает данные с задержкой 24ч.
         </p>
      </div>

      <div className="glass-card border-none overflow-hidden shadow-2xl rounded-[2rem]">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest h-14 pl-8">Дата</TableHead>
              {showProjectColumn && <TableHead className="text-[10px] font-black uppercase tracking-widest">Проект</TableHead>}
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                 <div className="flex items-center gap-2">
                    Источник
                    <FilterPopover 
                       title="ФИЛЬТР ПО ИСТОЧНИКУ"
                       options={filterOptions.sources} 
                       selected={filterSources} 
                       onChange={(val) => setFilterSources(val)} 
                    />
                 </div>
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                 <div className="flex items-center gap-2">
                    Цели
                    <FilterPopover 
                       title="ФИЛЬТР ПО ЦЕЛЯМ"
                       options={filterOptions.goals} 
                       selected={filterGoals} 
                       onChange={(val) => setFilterGoals(val)} 
                    />
                 </div>
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">ClientID</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                 <div className="flex items-center gap-2">
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
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                 <div className="flex items-center gap-2">
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
              <TableHead className="text-[10px] font-black uppercase tracking-widest">
                 <div className="flex items-center gap-2">
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
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest pr-8">Сумма</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={showProjectColumn ? 10 : 9} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Загрузка данных...</span>
                  </div>
              </TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={showProjectColumn ? 10 : 9} className="h-40 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Лиды не найдены</TableCell></TableRow>
            ) : leads.map((item) => (
              <TableRow key={item.lead.id} className="border-white/5 hover:bg-primary/5 transition-all group h-20">
                <TableCell className="text-[11px] font-bold pl-8">
                  {mounted && item.lead?.date ? format(new Date(item.lead.date), "dd.MM.yyyy HH:mm", { locale: ru }) : '—'}
                </TableCell>
                {showProjectColumn && (
                   <TableCell className="text-xs font-bold text-primary">{item.project?.name}</TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-black tracking-tight truncate max-w-[120px]">{item.lead.utmSource || 'direct'}</span>
                    {item.lead.utmCampaign && (
                      <span className="text-[9px] text-muted-foreground truncate max-w-[150px] font-bold uppercase tracking-wider">
                        {item.lead.utmCampaign}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-wrap gap-1.5">
                      {item.achievements?.map((a: any) => (
                         <span key={a.id} className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-[#2800B8]/10 text-[#2800B8] border border-[#2800B8]/10 whitespace-nowrap">
                            {a.goalName}
                         </span>
                      ))}
                   </div>
                </TableCell>
                <TableCell className="text-[10px] font-mono text-muted-foreground font-medium">
                  {item.lead.metrikaClientId || '—'}
                </TableCell>
                <TableCell>
                   <div className="flex flex-col gap-1.5">
                      {item.achievements?.map((a: any) => (
                        <Select 
                          key={a.id}
                          value={a.targetStatusId?.toString() || "none"} 
                          onValueChange={(val) => updateLeadStatus(a.id, 'targetStatusId', val)}
                        >
                          <SelectTrigger className="h-8 text-[9px] font-black uppercase tracking-wider px-3 w-[120px] glass-card border-white/5 shadow-sm hover:border-primary/20 transition-all">
                            <SelectValue placeholder="Статус" className="truncate" />
                          </SelectTrigger>
                          <SelectContent className="glass-card border-white/10">
                            <SelectItem value="none" className="text-[10px] font-bold uppercase">Не выбран</SelectItem>
                            {targetStatuses.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()} className="text-[10px] font-bold uppercase">
                                <div className="flex items-center gap-3">
                                  <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{ backgroundColor: s.color }} />
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
                   <div className="flex flex-col gap-1.5">
                      {item.achievements?.map((a: any) => (
                        <Select 
                          key={a.id}
                          value={a.qualificationStatusId?.toString() || "none"} 
                          onValueChange={(val) => updateLeadStatus(a.id, 'qualificationStatusId', val)}
                        >
                          <SelectTrigger className="h-8 text-[9px] font-black uppercase tracking-wider px-3 w-[120px] glass-card border-white/5 shadow-sm hover:border-primary/20 transition-all">
                            <SelectValue placeholder="Квал" className="truncate" />
                          </SelectTrigger>
                          <SelectContent className="glass-card border-white/10">
                            <SelectItem value="none" className="text-[10px] font-bold uppercase">Не выбран</SelectItem>
                            {qualStatuses.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()} className="text-[10px] font-bold uppercase">
                                <div className="flex items-center gap-3">
                                  <div className="w-2.5 h-2.5 rounded-full shadow-inner" style={{ backgroundColor: s.color }} />
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
                        <SelectTrigger className="h-9 text-[10px] font-black uppercase tracking-widest px-4 w-[140px] glass-card bg-primary/5 hover:bg-primary/10 border-primary/10 shadow-lg">
                        <SelectValue placeholder="Этап" className="truncate w-full" />
                        </SelectTrigger>
                        <SelectContent className="glass-card border-white/10">
                        <SelectItem value="none" className="text-[10px] font-bold uppercase tracking-wider">Не выбран</SelectItem>
                        {leadStages.map(s => (
                            <SelectItem key={s.id} value={s.id.toString()} className="text-[10px] font-bold uppercase tracking-wider">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-md shadow-lg" style={{ backgroundColor: s.color }} />
                                {s.label}
                            </div>
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </TableCell>

                <TableCell className="text-right text-xs font-black text-foreground tabular-nums pr-8">
                  {(() => {
                    const total = item.achievements?.reduce((acc: number, a: any) => acc + (parseFloat(a.saleAmount) || 0), 0) || 0;
                    return total > 0 ? `${total.toLocaleString()} ₽` : "—";
                  })()}
                </TableCell>
                <TableCell className="pr-4">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
                    onClick={() => {
                       setSelectedLead(item)
                       setIsEditDialogOpen(true)
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
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
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-primary/10 rounded-full transition-colors group">
               <Filter className={cn(
                   "h-3 w-3 transition-colors",
                   selected.length > 0 ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-primary'
               )} />
            </Button>
         </PopoverTrigger>
         <PopoverContent className="w-80 p-0 glass-card shadow-[0_20px_50px_rgba(40,0,184,0.15)] border-white/20 animate-in zoom-in-95 duration-200" align="start">
            <div className="p-6 space-y-4">
               <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em]">{title}</p>
                    {pending.length > 0 && <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full">{pending.length}</span>}
               </div>
               
               <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-1 -mr-2">
                  {options.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic px-1 font-medium">Нет данных для фильтрации</p>
                  ) : options.map(opt => {
                     const label = useObjects ? opt.label : opt;
                     const value = useObjects ? opt.value : opt;
                     const active = pending.includes(value);
                     return (
                        <div key={value} className={cn(
                            "flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group",
                            active ? "bg-primary/5 border-primary/10" : "hover:bg-white/10"
                        )} onClick={() => {
                            if (pending.includes(value)) setPending(pending.filter(s => s !== value))
                            else setPending([...pending, value])
                        }}>
                           <Checkbox 
                              id={value} 
                              checked={active} 
                              className="w-5 h-5 rounded-lg border-primary/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-sm"
                           />
                           <label htmlFor={value} className={cn(
                               "text-xs font-bold transition-colors cursor-pointer truncate flex-1",
                               active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                           )}>{label}</label>
                        </div>
                     )
                  })}
               </div>
               
               <div className="pt-4 border-t border-white/5 flex gap-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 rounded-xl"
                    onClick={() => { setPending([]); onChange([]); setOpen(false); }}
                  >
                     Сбросить
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 rounded-xl"
                    onClick={() => {
                       onChange(pending);
                       setOpen(false);
                    }}
                  >
                     Применить
                  </Button>
               </div>
            </div>
         </PopoverContent>
      </Popover>
   )
}
