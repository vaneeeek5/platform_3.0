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
  Calendar as CalendarIcon,
  Briefcase,
  ShoppingBag,
  RussianRuble
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
         <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Всего лидов</CardTitle>
             <Briefcase className="h-4 w-4 text-slate-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{data?.summary?.leads || 0}</div>
             <p className="text-xs text-muted-foreground mt-1">за выбранный период</p>
           </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Целевые</CardTitle>
             <Target className="h-4 w-4 text-emerald-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-emerald-600">{data?.summary?.targetLeads || 0}</div>
             <p className="text-xs text-muted-foreground mt-1">целевых действий</p>
           </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Продажи</CardTitle>
             <ShoppingBag className="h-4 w-4 text-amber-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-amber-600">{data?.summary?.sales || 0}</div>
             <p className="text-xs text-muted-foreground mt-1">с чеком &gt; 0</p>
           </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">CPL (Лид)</CardTitle>
             <RussianRuble className="h-4 w-4 text-slate-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{Math.round(data?.summary?.cpl || 0).toLocaleString()} ₽</div>
             <p className="text-xs text-muted-foreground mt-1">стоимость одного лида</p>
           </CardContent>
         </Card>
         <Card className="bg-gradient-to-br from-white to-slate-50 border-none shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">ROMI</CardTitle>
             <TrendingUp className="h-4 w-4 text-blue-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-blue-600">{Math.round(data?.summary?.romi || 0)}%</div>
             <p className="text-xs text-muted-foreground mt-1">окупаемость</p>
           </CardContent>
         </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        {/* Multi-Metric Trends Chart */}
        <Card className="md:col-span-4 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Динамика лидов</CardTitle>
            <CardDescription>Активность по дням: лиды, целевые, продажи</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="h-[200px] flex items-end gap-[2px] px-2 pt-6 border-l border-b border-slate-100">
                {data?.trends && data.trends.length > 0 ? (
                  data.trends.map((t: any, i: number) => {
                    const maxVal = Math.max(...data.trends.map((tr: any) => Number(tr.leads) || 0), 1);
                    const hLeads = (Number(t.leads) / maxVal) * 100;
                    const hTarget = (Number(t.targetLeads) / maxVal) * 100;
                    const hSales = (Number(t.sales) / maxVal) * 100;
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center group relative min-w-[4px] h-full">
                        <div className="w-full flex items-end justify-center gap-[1px] h-full group-hover:bg-slate-50 transition-colors">
                           <div 
                              className="w-[30%] bg-blue-400 group-hover:bg-blue-600 transition-colors rounded-t-[1px]"
                              style={{ height: `${Math.max(hLeads, 4)}%` }}
                           />
                           <div 
                              className="w-[30%] bg-emerald-400 group-hover:bg-emerald-600 transition-colors rounded-t-[1px]"
                              style={{ height: `${Math.max(hTarget, 2)}%` }}
                           />
                           <div 
                              className="w-[30%] bg-amber-400 group-hover:bg-amber-600 transition-colors rounded-t-[1px]"
                              style={{ height: `${Math.max(hSales, 2)}%` }}
                           />
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2 rounded z-20 shadow-xl whitespace-nowrap min-w-[120px]">
                            <div className="font-bold border-b border-white/20 mb-1 pb-1">{t.period}</div>
                            <div className="flex justify-between gap-4"><span>Всего:</span> <span>{t.leads}</span></div>
                            <div className="flex justify-between gap-4 text-emerald-300"><span>Целевые:</span> <span>{t.targetLeads}</span></div>
                            <div className="flex justify-between gap-4 text-amber-300"><span>Продажи:</span> <span>{t.sales}</span></div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground italic">
                    {data ? "Нет данных за выбранный период" : "Загрузка данных..."}
                  </div>
                )}
             </div>
             {/* Legend & X-Axis */}
             <div className="mt-4 pt-2 border-t flex items-center justify-between">
                <div className="flex gap-4">
                   <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full" />
                      <span className="text-[10px] text-muted-foreground">Все лиды</span>
                   </div>
                   <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                      <span className="text-[10px] text-muted-foreground">Целевые</span>
                   </div>
                   <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full" />
                      <span className="text-[10px] text-muted-foreground">Продажи</span>
                   </div>
                </div>
                <div className="flex gap-4 text-[10px] text-muted-foreground">
                   {data?.trends?.length > 0 && (
                     <>
                      <span>{data.trends[0].period}</span>
                      <span>{data.trends[data.trends.length - 1].period}</span>
                     </>
                   )}
                </div>
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
         <Card className="border-none shadow-sm h-full">
            <CardHeader>
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <CardTitle>Топ кампаний</CardTitle>
                     <CardDescription>По количеству лидов</CardDescription>
                  </div>
                  <Users className="w-5 h-5 opacity-20" />
               </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  {data?.topCampaigns?.length > 0 ? (
                    data.topCampaigns.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 hover:bg-slate-50 transition-colors px-1">
                         <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-semibold truncate max-w-[250px]">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">Кампания</span>
                         </div>
                         <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold">{c.leads}</div>
                            <div className="text-[10px] text-muted-foreground">лидов</div>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-center py-4 text-muted-foreground italic">
                      Нет данных за период.
                    </div>
                  )}
                </div>
            </CardContent>
         </Card>

         {/* Efficiency by CPL */}
         <Card className="border-none shadow-sm h-full">
            <CardHeader>
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                     <CardTitle>Эффективность (CPL)</CardTitle>
                     <CardDescription>Топ по стоимости лида</CardDescription>
                  </div>
                  <Target className="w-5 h-5 opacity-20" />
               </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  {data?.efficientCampaigns?.length > 0 ? (
                    data.efficientCampaigns.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 hover:bg-slate-50 transition-colors px-1">
                         <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-semibold truncate max-w-[250px]">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{c.leads} лидов</span>
                         </div>
                         <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-emerald-600">{Math.round(c.cpl).toLocaleString()} ₽</div>
                            <div className="text-[10px] text-muted-foreground">за лид</div>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-center py-4 text-muted-foreground italic">
                      Нет данных для расчета CPL.
                    </div>
                  )}
                </div>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}

