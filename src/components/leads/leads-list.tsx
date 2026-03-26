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
import { Search, Filter, Download, Edit2 } from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { LeadEditDialog } from "./lead-edit-dialog"
import * as XLSX from "xlsx"

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

  useEffect(() => {
    setMounted(true)
    if (projectId) fetchLeads()
  }, [projectId])

  const fetchLeads = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (projectId) params.append("projectId", projectId.toString())
    if (query) params.append("query", query)
    
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
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
         <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={leads.length === 0}>
               <Download className="h-4 w-4 mr-2" />
               Excel
            </Button>
            <Button size="sm" onClick={fetchLeads} disabled={loading}>
               Обновить
            </Button>
         </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[140px] text-xs">Дата</TableHead>
              {showProjectColumn && <TableHead className="text-xs">Проект</TableHead>}
              <TableHead className="text-xs">Источник / Кампания</TableHead>
              <TableHead className="text-xs">Цели</TableHead>
              <TableHead className="text-xs">ClientID</TableHead>
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
