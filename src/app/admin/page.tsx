"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
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
import { Button } from "@/components/ui/button"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { DateRange } from "react-day-picker"
import { subDays, format } from "date-fns"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("0")
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  })

  const { data: projectsData } = useSWR("/api/projects", fetcher);
  
  const queryParams = new URLSearchParams({
    projectId: selectedProjectId,
    granularity,
    ...(dateRange?.from && { dateFrom: dateRange.from.toISOString() }),
    ...(dateRange?.to && { dateTo: dateRange.to.toISOString() }),
  });

  const { data, error, isLoading } = useSWR(
    `/api/reports/dashboard?${queryParams.toString()}`,
    fetcher
  );

  // SVG Chart Renderer
  const renderLineChart = () => {
    if (!data?.trends || data.trends.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground italic">
                {isLoading ? "Загрузка..." : "Нет данных за период"}
            </div>
        );
    }
    
    const padding = { top: 20, right: 40, bottom: 40, left: 50 };
    const width = 800;
    const height = 280;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Calculate scale
    const allVals = data.trends.flatMap((t: any) => [t.leads, t.targetLeads, t.sales]);
    const maxVal = Math.max(...allVals, 10);
    const roundedMax = Math.ceil(maxVal / 10) * 10 || 10;
    
    const getX = (i: number) => padding.left + (i / (data.trends.length - 1 || 1)) * chartWidth;
    const getY = (val: number) => padding.top + chartHeight - (val / roundedMax) * chartHeight;
    
    const createPath = (key: string) => {
      if (data.trends.length < 2) return "";
      return data.trends.map((t: any, i: number) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(t[key])}`).join(" ");
    };

    return (
      <div className="relative w-full h-[300px] mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-sans">
          {/* Horizontal Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const val = Math.round(roundedMax * p);
            const y = getY(val);
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f1f5f9" strokeDasharray="4 4" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-medium">{val}</text>
              </g>
            );
          })}

          {/* X Axis Labels */}
          {data.trends.map((t: any, i: number) => {
            // Show labels selectively to avoid overlap
            const step = Math.ceil(data.trends.length / 10);
            if (i % step !== 0 && i !== data.trends.length - 1) return null;
            return (
              <text key={i} x={getX(i)} y={height - padding.bottom + 20} textAnchor="middle" className="text-[10px] fill-slate-400 font-medium">
                {t.period}
              </text>
            );
          })}

          {/* The Lines */}
          <path d={createPath("leads")} stroke="#3b82f6" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
          <path d={createPath("targetLeads")} stroke="#10b981" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
          <path d={createPath("sales")} stroke="#f59e0b" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />

          {/* Interaction Points */}
          {data.trends.map((t: any, i: number) => (
            <g key={i} className="group/point">
              {/* Invisible Hit Area */}
              <rect x={getX(i) - 10} y={padding.top} width="20" height={chartHeight} fill="transparent" className="cursor-pointer" />
              
              {/* Visible Dots on Hover */}
              <circle cx={getX(i)} cy={getY(t.leads)} r="4" fill="#3b82f6" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity" />
              <circle cx={getX(i)} cy={getY(t.targetLeads)} r="4" fill="#10b981" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity" />
              <circle cx={getX(i)} cy={getY(t.sales)} r="4" fill="#f59e0b" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity" />

              {/* Tooltip Content */}
              <foreignObject x={getX(i) + 12} y={padding.top} width="140" height="100" className="pointer-events-none hidden group-hover/point:block z-50 overflow-visible">
                <div className="bg-slate-900/95 backdrop-blur-sm text-white p-2.5 rounded-lg shadow-2xl text-[10px] border border-white/10 ring-1 ring-black/5">
                  <div className="font-bold border-b border-white/20 mb-1.5 pb-1 text-slate-300">{t.period}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /><span>Всего лидов:</span></div>
                      <span className="font-bold text-blue-100">{t.leads}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span>Целевые:</span></div>
                      <span className="font-bold text-emerald-100">{t.targetLeads}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span>Продажи:</span></div>
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
          {/* Granularity Toggles */}
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Всего лидов</CardTitle>
             <Briefcase className="h-4 w-4 text-slate-400" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{data?.summary?.leads || 0}</div>
             <p className="text-[10px] text-muted-foreground mt-1 uppercase">за период</p>
           </CardContent>
         </Card>
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Целевые</CardTitle>
             <Target className="h-4 w-4 text-emerald-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-emerald-600">{data?.summary?.targetLeads || 0}</div>
             <p className="text-[10px] text-muted-foreground mt-1 uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 inline-block font-bold">Goal</p>
           </CardContent>
         </Card>
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">Продажи</CardTitle>
             <ShoppingBag className="h-4 w-4 text-amber-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-amber-600">{data?.summary?.sales || 0}</div>
             <p className="text-[10px] text-muted-foreground mt-1 uppercase">с чеком &gt; 0</p>
           </CardContent>
         </Card>
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">CPL (Лид)</CardTitle>
             <RussianRuble className="h-4 w-4 text-slate-400" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">{Math.round(data?.summary?.cpl || 0).toLocaleString()} ₽</div>
             <p className="text-[10px] text-muted-foreground mt-1 uppercase">цена лида</p>
           </CardContent>
         </Card>
         <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">ROMI</CardTitle>
             <TrendingUp className="h-4 w-4 text-blue-500" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold text-blue-600">{Math.round(data?.summary?.romi || 0)}%</div>
             <p className="text-[10px] text-muted-foreground mt-1 uppercase">окупаемость</p>
           </CardContent>
         </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4 border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Динамика лидов</CardTitle>
                <CardDescription>Активность по времени</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-blue-500" /><span>Все лиды</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-emerald-500" /><span>Целевые</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-0.5 bg-amber-500" /><span>Продажи</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderLineChart()}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-none shadow-sm">
          <CardHeader>
            <CardTitle>Источники трафика</CardTitle>
            <CardDescription>Распределение по каналам</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              {data?.sources?.map((s: any, i: number) => {
                const max = data.sources[0].value;
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="truncate max-w-[150px]">{s.name}</span>
                      <span className="text-slate-900 font-bold">{s.value}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden scale-x-100 origin-left transition-transform duration-500">
                      <div className="h-full bg-primary/80 rounded-full" style={{ width: `${(s.value/max)*100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
         <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Топ кампаний</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.topCampaigns?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors rounded px-2 -mx-2">
                    <span className="font-medium truncate max-w-[280px] text-slate-700">{c.name}</span>
                    <span className="font-bold tabular-nums">{c.leads}</span>
                  </div>
                ))}
              </div>
            </CardContent>
         </Card>
         <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Эффективность (CPL)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.efficientCampaigns?.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors rounded px-2 -mx-2">
                    <span className="font-medium truncate max-w-[280px] text-slate-700">{c.name}</span>
                    <span className="font-bold text-emerald-600 tabular-nums">{Math.round(c.cpl).toLocaleString()} ₽</span>
                  </div>
                ))}
              </div>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}
