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
import { subDays, startOfDay, endOfDay } from "date-fns"

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
  const [filterTargetStatusIds, setFilterTargetStatusIds] = useState<string[]>([])
  const [filterQualStatusIds, setFilterQualStatusIds] = useState<string[]>([])

  useEffect(() => {
    setMounted(true)
    if (projectId) {
       fetchLeads()
       fetchStatuses()
    }
  }, [projectId])

  const fetchStatuses = async () => {
    const [tRes, qRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/statuses/target`),
      fetch(`/api/projects/${projectId}/statuses/qualification`)
    ])
    if (tRes.ok) setTargetStatuses(await tRes.json())
    if (qRes.ok) setQualStatuses(await qRes.json())
  }

  const fetchLeads = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (projectId) params.append("projectId", projectId.toString())
    if (query) params.append("query", query)
    if (dateRange?.from) params.append("dateFrom", dateRange.from.toISOString())
    if (dateRange?.to) params.append("dateTo", dateRange.to.toISOString())
    if (filterSources.length > 0) params.append("sources", filterSources.join(","))
    if (filterGoals.length > 0) params.append("goals", filterGoals.join(","))
    if (filterTargetStatusIds.length > 0) params.append("targetStatusIds", filterTargetStatusIds.join(","))
    if (filterQualStatusIds.length > 0) params.append("qualStatusIds", filterQualStatusIds.join(","))
    
    try {
      const res = await fetch(`/api/leads?${params.toString()}`)
      if (res.ok) setLeads(await res.json())
    } catch (e) {
      toast.error("Ошибка при загрузке лидов")
    } finally {
      setLoading(false)
    }
  }

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
         <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={handleDedup} disabled={loading} title="Проверить и удалить дубликаты" className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
               Удалить дубли
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={leads.length === 0}>
               <Download className="h-4 w-4 mr-2" />
               Excel
            </Button>
            <Button size="sm" onClick={fetchLeads} disabled={loading}>
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
              <TableHead className="w-[140px] text-xs">
                <div className="flex items-center gap-1">
                  Дата
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
                        <Filter className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-2 border-b text-[10px] font-medium bg-muted/30">Фильтр по дате</div>
                      <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                    </PopoverContent>
                  </Popover>
                </div>
              </TableHead>
              {showProjectColumn && <TableHead className="text-xs">Проект</TableHead>}
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Источник
                    <FilterPopover 
                       options={Array.from(new Set(leads.map(l => l.lead.utmSource || 'direct')))} 
                       selected={filterSources} 
                       onChange={setFilterSources} 
                    />
                 </div>
              </TableHead>
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Цели
                    <FilterPopover 
                       options={Array.from(new Set(leads.flatMap(l => l.achievements?.map((a: any) => a.goalName) || [])))} 
                       selected={filterGoals} 
                       onChange={setFilterGoals} 
                    />
                 </div>
              </TableHead>
              <TableHead className="text-xs">ClientID</TableHead>
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Статус
                    <FilterPopover 
                       options={targetStatuses.map(s => ({ label: s.label, value: s.id.toString() }))} 
                       selected={filterTargetStatusIds} 
                       onChange={setFilterTargetStatusIds} 
                       useObjects
                    />
                 </div>
              </TableHead>
              <TableHead className="text-xs">
                 <div className="flex items-center gap-1">
                    Квал
                    <FilterPopover 
                       options={qualStatuses.map(s => ({ label: s.label, value: s.id.toString() }))} 
                       selected={filterQualStatusIds} 
                       onChange={setFilterQualStatusIds} 
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
              <TableRow><TableCell colSpan={showProjectColumn ? 7 : 6} className="h-24 text-center text-xs">Загрузка...</TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={showProjectColumn ? 7 : 6} className="h-24 text-center text-xs text-muted-foreground">Лиды не найдены</TableCell></TableRow>
            ) : leads.map((item) => (
              <TableRow key={item.lead.id}>
                <TableCell className="text-[10px] whitespace-nowrap">
                  {mounted && item.lead?.date ? format(new Date(item.lead.date), "dd.MM.yyyy HH:mm", { locale: ru }) : '—'}
                </TableCell>
                {showProjectColumn && (
                   <TableCell className="text-xs">{item.project?.name}</TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold">{item.lead.utmSource || 'direct'}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[150px] uppercase">
                      {item.lead.utmCampaign || '—'}
                    </span>
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
                   <div className="flex flex-wrap gap-1">
                      {item.achievements?.map((a: any) => {
                         const ts = targetStatuses.find(s => s.id === a.targetStatusId);
                         return ts ? (
                            <Badge key={ts.id} style={{ backgroundColor: ts.color + '20', color: ts.color, borderColor: ts.color + '40' }} variant="outline" className="text-[9px] px-1 py-0">
                               {ts.label}
                            </Badge>
                         ) : null;
                      })}
                   </div>
                </TableCell>
                <TableCell>
                   <div className="flex flex-wrap gap-1">
                      {item.achievements?.map((a: any) => {
                         const qs = qualStatuses.find(s => s.id === a.qualificationStatusId);
                         return qs ? (
                            <Badge key={qs.id} style={{ backgroundColor: qs.color + '20', color: qs.color, borderColor: qs.color + '40' }} variant="outline" className="text-[9px] px-1 py-0">
                               {qs.label}
                            </Badge>
                         ) : null;
                      })}
                   </div>
                </TableCell>
                <TableCell className="text-right text-xs font-bold">
                  {item.achievements?.reduce((acc: number, a: any) => acc + parseFloat(a.saleAmount || "0"), 0).toLocaleString()} ₽
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7"
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

function FilterPopover({ options, selected, onChange, useObjects = false }: { options: any[], selected: string[], onChange: (val: string[]) => void, useObjects?: boolean }) {
   return (
      <Popover>
         <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-4 w-4 p-0">
               <Filter className={`h-3 w-3 ${selected.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </Button>
         </PopoverTrigger>
         <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-2">
               <p className="text-xs font-medium px-1">Фильтр</p>
               <div className="max-h-48 overflow-y-auto space-y-1">
                  {options.map(opt => {
                     const label = useObjects ? opt.label : opt;
                     const value = useObjects ? opt.value : opt;
                     return (
                        <div key={value} className="flex items-center space-x-2 px-1 py-1 hover:bg-muted rounded">
                           <Checkbox 
                              id={value} 
                              checked={selected.includes(value)} 
                              onCheckedChange={(checked) => {
                                 if (checked) onChange([...selected, value])
                                 else onChange(selected.filter(s => s !== value))
                              }}
                           />
                           <label htmlFor={value} className="text-xs cursor-pointer truncate flex-1">{label}</label>
                        </div>
                     )
                  })}
               </div>
               {selected.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full h-7 text-[10px]" onClick={() => onChange([])}>
                     Сбросить
                  </Button>
               )}
            </div>
         </PopoverContent>
      </Popover>
   )
}
