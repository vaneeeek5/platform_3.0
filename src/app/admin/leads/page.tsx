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
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  Filter, 
  Download, 
  Calendar as CalendarIcon,
  ExternalLink,
  Edit2
} from "lucide-react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { LeadEditDialog } from "@/components/leads/lead-edit-dialog"

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    projectId: "all",
    query: "",
    dateFrom: "",
    dateTo: ""
  })
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchLeads()
  }, [])

  const fetchProjects = async () => {
    const res = await fetch("/api/projects")
    if (res.ok) setProjects(await res.json())
  }

  const fetchLeads = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.projectId !== "all") params.append("projectId", filters.projectId)
    if (filters.query) params.append("query", filters.query)
    
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
      "Проект": item.project.name,
      "Источник": item.lead.utmSource || "direct",
      "Кампания": item.lead.utmCampaign || "—",
      "Цели": item.achievements?.map((a: any) => a.goalName).join(", "),
      "ClientID": item.lead.metrikaClientId || "—",
      "Сумма": item.achievements?.reduce((acc: number, a: any) => acc + parseFloat(a.saleAmount || "0"), 0)
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `Leads_Export_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Лиды и Конверсии</h1>
          <p className="text-muted-foreground">Просмотр и управление заявками из всех источников.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={leads.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Экспорт в Excel
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск по ClientID или Кампании..." 
                className="pl-9"
                value={filters.query}
                onChange={(e) => setFilters({...filters, query: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
              />
            </div>
            <div className="w-full md:w-64">
              <Select 
                value={filters.projectId} 
                onValueChange={(val) => setFilters({...filters, projectId: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Все проекты" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все проекты</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchLeads} disabled={loading}>
              <Filter className="h-4 w-4 mr-2" />
              Показать
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[180px]">Дата и время</TableHead>
                  <TableHead>Проект</TableHead>
                  <TableHead>Источник / Кампания</TableHead>
                  <TableHead>Цель / Событие</TableHead>
                  <TableHead>ClientID</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">Загрузка...</TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">Лиды не найдены</TableCell>
                  </TableRow>
                ) : leads.map((item) => (
                  <TableRow key={item.lead.id}>
                    <TableCell className="text-xs font-medium">
                      {format(new Date(item.lead.date), "dd.MM.yyyy HH:mm", { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{item.project.name}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{item.lead.utmSource || 'direct'}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={item.lead.utmCampaign}>
                          {item.lead.utmCampaign || '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                       <div className="flex flex-col gap-1">
                          {item.achievements?.map((a: any) => (
                             <div key={a.id} className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                   {a.goalName}
                                </span>
                             </div>
                          ))}
                       </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {item.lead.metrikaClientId || '—'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {item.achievements?.reduce((acc: number, a: any) => acc + parseFloat(a.saleAmount || "0"), 0).toLocaleString()} ₽
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedLead(item)
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <LeadEditDialog 
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={fetchLeads}
        lead={selectedLead}
        projectId={selectedLead?.project.id}
      />
    </div>
  )
}
