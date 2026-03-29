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
  RussianRuble,
  CheckCircle2
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
import { Button } from "@/components/ui/button"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { subDays, format } from "date-fns"
import { toast } from "sonner"

export default function DashboardPage() {
  const [projectsData, setProjectsData] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("0")
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  })
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/projects")
      .then(res => res.json())
      .then(setProjectsData)
      .catch(console.error);
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        projectId: selectedProjectId,
        granularity,
        ...(dateRange?.from && { dateFrom: dateRange.from.toISOString() }),
        ...(dateRange?.to && { dateTo: dateRange.to.toISOString() }),
      });
      const res = await fetch(`/api/reports/dashboard?${queryParams.toString()}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error("Не удалось загрузить данные дашборда");
      }
    } catch (e) {
      toast.error("Ошибка сети");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedProjectId, granularity, dateRange]);

  // SVG Chart Renderer
  const renderLineChart = () => {
    if (!data?.trends || data.trends.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground italic">
                {isLoading ? "Загрузка..." : "Нет данных за период"}
            </div>
        );
    }
    
    const padding = { top: 30, right: 40, bottom: 50, left: 60 };
    const width = 1000;
    const height = 500; // Increased height
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Include qualLeads in max calculation
    const allVals = data.trends.flatMap((t: any) => [t.leads, t.targetLeads, t.qualLeads, t.sales]);
    const maxVal = Math.max(...allVals, 10);
    const roundedMax = Math.ceil(maxVal / 10) * 10 || 10;
    
    const getX = (i: number) => padding.left + (i / (data.trends.length - 1 || 1)) * chartWidth;
    const getY = (val: number) => padding.top + chartHeight - (val / roundedMax) * chartHeight;
    
    const createPath = (key: string) => {
      if (data.trends.length < 2) return "";
      return data.trends.map((t: any, i: number) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(t[key])}`).join(" ");
    };

    return (
      <div className="relative w-full h-[500px] mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-sans">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const val = Math.round(roundedMax * p);
            const y = getY(val);
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeDasharray="4 4" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="text-xs fill-slate-400 font-medium">{val}</text>
              </g>
            );
          })}

          {data.trends.map((t: any, i: number) => {
            const step = Math.ceil(data.trends.length / 10);
            if (i % step !== 0 && i !== data.trends.length - 1) return null;
            return (
              <text key={i} x={getX(i)} y={height - padding.bottom + 25} textAnchor="middle" className="text-xs fill-slate-400 font-medium">
                {t.period}
              </text>
            );
          })}

          <path d={createPath("leads")} stroke="#3b82f6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
          <path d={createPath("qualLeads")} stroke="#a855f7" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
          <path d={createPath("targetLeads")} stroke="#10b981" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
          <path d={createPath("sales")} stroke="#f59e0b" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />

          {data.trends.map((t: any, i: number) => (
            <g key={i} className="group/point">
              <rect x={getX(i) - 10} y={padding.top} width="20" height={chartHeight} fill="transparent" className="cursor-pointer" />
              <circle cx={getX(i)} cy={getY(t.leads)} r="4" fill="#3b82f6" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity" />
              <circle cx={getX(i)} cy={getY(t.qualLeads)} r="4" fill="#a855f7" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity" />
              <circle cx={getX(i)} cy={getY(t.targetLeads)} r="4" fill="#10b981" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity" />
              <circle cx={getX(i)} cy={getY(t.sales)} r="4" fill="#f59e0b" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity" />

              <foreignObject x={getX(i) + 12} y={padding.top} width="160" height="110" className="pointer-events-none hidden group-hover/point:block z-50 overflow-visible">
                <div className="bg-slate-900/95 backdrop-blur-sm text-white p-3 rounded-lg shadow-2xl text-[11px] border border-white/10 ring-1 ring-black/5">
                  <div className="font-bold border-b border-white/20 mb-2 pb-1.5 text-slate-300">{t.period}</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400" /><span>Всего:</span></div>
                      <span className="font-bold text-blue-100">{t.leads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-400" /><span>Квалы:</span></div>
                      <span className="font-bold text-purple-100">{t.qualLeads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span>Целевые:</span></div>
                      <span className="font-bold text-emerald-100">{t.targetLeads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400" /><span>Продажи:</span></div>
                      <span className="font-bold text-amber-100">{t.sales}</span>
                    </div>
                  </div>
                </div>
              </foreignObject>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/30 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Дашборд
          </h1>
          <p className="text-muted-foreground mt-1">Аналитика эффективности маркетинга</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-lg border p-1 shadow-sm">
            <Button variant={granularity === "day" ? "secondary" : "ghost"} size="sm" onClick={() => setGranularity("day")} className="h-7 text-[10px] px-3">Дни</Button>
            <Button variant={granularity === "week" ? "secondary" : "ghost"} size="sm" onClick={() => setGranularity("week")} className="h-7 text-[10px] px-2.5">Недели</Button>
            <Button variant={granularity === "month" ? "secondary" : "ghost"} size="sm" onClick={() => setGranularity("month")} className="h-7 text-[10px] px-2.5">Месяцы</Button>
          </div>
          
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[180px] bg-white shadow-sm border-slate-200">
              <Filter className="w-4 h-4 mr-2 opacity-50" />
              <SelectValue placeholder="Все проекты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Все проекты</SelectItem>
              {projectsData?.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: Leads, Target, Quals */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Всего лидов</CardTitle>
             <Briefcase className="h-5 w-5 text-slate-400" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold">{data?.summary?.leads || 0}</div>
             <p className="text-xs text-muted-foreground mt-1 uppercase">за период</p>
           </CardContent>
         </Card>
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Целевые</CardTitle>
             <Target className="h-5 w-5 text-emerald-500" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold text-emerald-600">{data?.summary?.targetLeads || 0}</div>
             <p className="text-xs text-muted-foreground mt-1 uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 inline-block font-bold mt-1">
               {Math.round(data?.summary?.targetConv || 0)}% ИЗ ЛИДОВ
             </p>
           </CardContent>
         </Card>
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Квалы</CardTitle>
             <CheckCircle2 className="h-5 w-5 text-purple-500" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold text-purple-600">{data?.summary?.qualLeads || 0}</div>
             <p className="text-xs text-muted-foreground mt-1 uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 inline-block font-bold mt-1">
               {Math.round(data?.summary?.qualConv || 0)}% ИЗ ЛИДОВ
             </p>
           </CardContent>
         </Card>
      </div>

      {/* Row 2: Sales, CPL, ROMI */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Продажи и Выручка</CardTitle>
             <ShoppingBag className="h-5 w-5 text-amber-500" />
           </CardHeader>
           <CardContent>
             <div className="flex items-baseline gap-3">
               <div className="text-3xl font-bold text-amber-600">{data?.summary?.sales || 0} шт</div>
               <div className="text-xl font-medium text-amber-500">/ {Math.round(data?.summary?.revenue || 0).toLocaleString()} ₽</div>
             </div>
             <p className="text-xs text-muted-foreground mt-1 uppercase">успешные закрытия</p>
           </CardContent>
         </Card>
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">CPL (Лид)</CardTitle>
             <RussianRuble className="h-5 w-5 text-slate-400" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold">{Math.round(data?.summary?.cpl || 0).toLocaleString()} ₽</div>
             <p className="text-xs text-muted-foreground mt-1 uppercase">цена лида</p>
           </CardContent>
         </Card>
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">ROMI</CardTitle>
             <TrendingUp className="h-5 w-5 text-blue-500" />
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-bold text-blue-600">{Math.round(data?.summary?.romi || 0)}%</div>
             <p className="text-xs text-muted-foreground mt-1 uppercase">окупаемость</p>
           </CardContent>
         </Card>
      </div>

      {/* Row 3: Full Width Chart */}
      <div className="grid gap-4 grid-cols-1 mb-6">
        <Card className="border-none shadow-sm h-full">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Динамика лидов</CardTitle>
                <CardDescription className="text-sm">Активность по времени</CardDescription>
              </div>
              <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-blue-500 rounded-full" /><span>Лиды</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-emerald-500 rounded-full" /><span>Целевые</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-purple-500 rounded-full" /><span>Квалы</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-1 bg-amber-500 rounded-full" /><span>Продажи</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-full">
            {renderLineChart()}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Sources, Campaigns, CPL */}
      <div className="grid gap-4 md:grid-cols-3">
         <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg">Топ кампаний</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.topCampaigns?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-base py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors rounded px-2 -mx-2">
                    <span className="font-medium truncate max-w-[280px] text-slate-700">{c.name}</span>
                    <span className="font-bold tabular-nums">{c.leads}</span>
                  </div>
                ))}
              </div>
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg">Эффективность (CPL)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.efficientCampaigns?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-base py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors rounded px-2 -mx-2">
                    <span className="font-medium truncate max-w-[280px] text-slate-700">{c.name}</span>
                    <span className="font-bold text-emerald-600 tabular-nums">{Math.round(c.cpl).toLocaleString()} ₽</span>
                  </div>
                ))}
              </div>
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Источники трафика</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5 pt-2">
              {data?.sources?.map((s: any, i: number) => {
                const max = data.sources[0].value;
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="truncate max-w-[150px]">{s.name}</span>
                      <span className="text-slate-900 font-bold">{s.value}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/80 rounded-full" style={{ width: `${(s.value/max)*100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
         </Card>
      </div>
    </div>
  )
}
