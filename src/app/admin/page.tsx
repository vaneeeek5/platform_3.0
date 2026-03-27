"use client"

import { useState, useEffect } from "react"
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Calendar as CalendarIcon
} from "lucide-react"
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { subDays, format } from "date-fns"
import { toast } from "sonner"

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("0")
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  })
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [selectedProjectId, dateRange])

  const fetchProjects = async () => {
    const res = await fetch("/api/projects")
    if (res.ok) setProjects(await res.json())
  }

  const fetchDashboardData = async () => {
    if (!dateRange?.from || !dateRange?.to) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        dateFrom: dateRange.from.toISOString(),
        dateTo: dateRange.to.toISOString()
      })
      const res = await fetch(`/api/reports/dashboard?${params}`)
      if (res.ok) {
        setData(await res.json())
      } else {
        toast.error("Не удалось загрузить данные дашборда")
      }
    } catch (e) {
      toast.error("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
          <p className="text-muted-foreground">Обзор эффективности маркетинга</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[200px]">
               <Filter className="w-4 h-4 mr-2 opacity-50" />
               <SelectValue placeholder="Все проекты" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="0">Все проекты</SelectItem>
               {projects.map(p => (
                 <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
               ))}
            </SelectContent>
          </Select>
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего Лидов</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary?.leads.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">за выбранный период</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Расходы (₽)</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data?.summary?.cost || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">рекламный бюджет</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Средний CPL</CardTitle>
            <Target className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data?.summary?.cpl || 0).toLocaleString()} ₽</div>
            <p className="text-xs text-muted-foreground mt-1">цена за один лид</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROMI</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data?.summary?.romi || 0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">окупаемость маркетинга</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Custom Trends Chart (Tailwind based) */}
        <Card className="md:col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Динамика лидов</CardTitle>
            <CardDescription>Количество лидов по дням за период</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="h-[200px] flex items-end gap-1 px-2 pt-6">
                {data?.trends?.length > 0 ? (
                  data.trends.map((t: any, i: number) => {
                    const maxLeads = Math.max(...data.trends.map((tr: any) => tr.leads), 1);
                    const height = (t.leads / maxLeads) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center group relative">
                        <div 
                           className="w-full bg-primary/20 hover:bg-primary transition-colors rounded-t-sm"
                           style={{ height: `${Math.max(height, 5)}%` }}
                        />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2 rounded z-10 whitespace-nowrap">
                            {format(new Date(t.date), 'dd.MM')}: {t.leads} лидов
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground italic">
                    Нет данных за период
                  </div>
                )}
             </div>
             <div className="flex justify-between text-[10px] text-muted-foreground mt-2 border-t pt-2">
                 {data?.trends?.length > 0 && (
                   <>
                    <span>{format(new Date(data.trends[0].date), 'dd MMM')}</span>
                    <span>{format(new Date(data.trends[data.trends.length - 1].date), 'dd MMM')}</span>
                   </>
                 )}
             </div>
          </CardContent>
        </Card>

        {/* Channels / Sources */}
        <Card className="md:col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Источники трафика</CardTitle>
            <CardDescription>Распределение по UTM Source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.sources?.length > 0 ? (
                data.sources.map((s: any, i: number) => {
                  const maxLeads = data.sources[0].value;
                  const width = (s.value / maxLeads) * 100;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate max-w-[150px]">{s.name || "Прямой заход"}</span>
                        <span>{s.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full" 
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm italic">
                  Нет данных об источниках
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
         {/* Top Performing Campaigns */}
         <Card className="border-none shadow-sm">
            <CardHeader>
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <CardTitle>Эффективные кампании</CardTitle>
                     <CardDescription>Топ по количеству лидов</CardDescription>
                  </div>
                  <Target className="w-5 h-5 opacity-20" />
               </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  {data?.topCampaigns?.length > 0 ? (
                    data.topCampaigns.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                         <div className="flex flex-col">
                            <span className="text-xs font-semibold truncate max-w-[200px]">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">UTM Campaign</span>
                         </div>
                         <div className="text-right">
                            <div className="text-xs font-bold">{c.leads}</div>
                            <div className="text-[10px] text-muted-foreground">лидов</div>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-center py-4 text-muted-foreground italic">
                      Нет данных по кампаниям за период.
                    </div>
                  )}
                </div>
            </CardContent>
         </Card>

         <Card className="border-none shadow-sm bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <CardHeader>
               <CardTitle>Быстрый обзор</CardTitle>
               <CardDescription className="text-primary-foreground/70">Статус системы</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
               <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">Система активна</div>
                    <div className="text-xs opacity-70">Синхронизация работает в штатном режиме</div>
                  </div>
               </div>
               <button 
                  onClick={() => window.location.href = '/admin/logs'}
                  className="w-full bg-white text-primary font-bold py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors"
                >
                  Посмотреть логи
               </button>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}

