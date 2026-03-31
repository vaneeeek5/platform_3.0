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
import { cn } from "@/lib/utils"
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/me")
      .then(res => res.json())
      .then(user => setUserRole(user.role))
      .catch(console.error);

    fetch("/api/projects")
      .then(res => res.json())
      .then(projects => {
        setProjectsData(projects);
        if (userRole && userRole !== "SUPER_ADMIN" && projects.length > 0) {
          setSelectedProjectId(projects[0].id.toString());
        }
      })
      .catch(console.error);
  }, [userRole]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        projectId: selectedProjectId,
        granularity,
        ...(dateRange?.from && { dateFrom: dateRange.from.toISOString() }),
        ...(dateRange?.to && { dateTo: dateRange.to.toISOString() }),
      });
      const res = await fetch(`/api/reports/dashboard?${queryParams.toString()}`, {
        cache: "no-store"
      });
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
    const height = 500;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
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
      <div className="relative w-full h-[300px] md:h-[500px] mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-sans">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const val = Math.round(roundedMax * p);
            const y = getY(val);
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" className="text-muted/10" strokeDasharray="4 4" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="text-xs fill-muted-foreground font-medium">{val}</text>
              </g>
            );
          })}

          {data.trends.map((t: any, i: number) => {
            const step = Math.ceil(data.trends.length / 10);
            if (i % step !== 0 && i !== data.trends.length - 1) return null;
            return (
              <text key={i} x={getX(i)} y={height - padding.bottom + 25} textAnchor="middle" className="text-xs fill-muted-foreground font-medium">
                {t.period}
              </text>
            );
          })}

          <path d={createPath("leads")} stroke="#2800B8" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
          <path d={createPath("qualLeads")} stroke="#a855f7" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
          <path d={createPath("targetLeads")} stroke="#71D878" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />
          <path d={createPath("sales")} stroke="#f59e0b" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />

          {data.trends.map((t: any, i: number) => (
            <g key={i} className="group/point">
              <rect x={getX(i) - 10} y={padding.top} width="20" height={chartHeight} fill="transparent" className="cursor-pointer" />
              <circle cx={getX(i)} cy={getY(t.leads)} r="5" fill="#2800B8" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity shadow-lg" />
              <circle cx={getX(i)} cy={getY(t.qualLeads)} r="5" fill="#a855f7" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity shadow-lg" />
              <circle cx={getX(i)} cy={getY(t.targetLeads)} r="5" fill="#71D878" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity shadow-lg" />
              <circle cx={getX(i)} cy={getY(t.sales)} r="5" fill="#f59e0b" stroke="white" strokeWidth="2" className="opacity-0 group-hover/point:opacity-100 transition-opacity shadow-lg" />

              <foreignObject x={getX(i) + 12} y={padding.top} width="160" height="110" className="pointer-events-none hidden group-hover/point:block z-50 overflow-visible">
                <div className="glass-card shadow-2xl p-3 text-[11px] border border-white/20">
                  <div className="font-bold border-b border-primary/10 mb-2 pb-1.5 text-primary">{t.period}</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#2800B8]" /><span>Всего:</span></div>
                      <span className="font-bold text-[#2800B8]">{t.leads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500" /><span>Квалы:</span></div>
                      <span className="font-bold text-purple-600">{t.qualLeads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#71D878]" /><span>Целевые:</span></div>
                      <span className="font-bold text-[#71D878] font-black">{t.targetLeads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /><span>Продажи:</span></div>
                      <span className="font-bold text-amber-600">{t.sales}</span>
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
    <div className="p-4 md:p-8 space-y-8 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 glass-card rounded-2xl shadow-lg">
                <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            Дашборд
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Аналитика эффективности маркетинга</p>
        </div>
        
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full md:w-[220px] glass-card h-11 border-white/10">
              <Filter className="w-4 h-4 mr-2 text-primary" />
              <SelectValue placeholder="Все проекты" />
            </SelectTrigger>
            <SelectContent className="glass-card border-white/10">
              {userRole === "SUPER_ADMIN" && <SelectItem value="0">Все проекты</SelectItem>}
              {projectsData?.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: Leads, Target, Quals */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Всего лидов</CardTitle>
             <Briefcase className="h-5 w-5 text-primary" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-[#2800B8]">{data?.summary?.leads || 0}</div>
             <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">за период</p>
           </CardContent>
         </Card>
         <Card className="border-l-4 border-l-[#71D878]">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Целевые</CardTitle>
             <Target className="h-5 w-5 text-[#71D878]" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-[#71D878]">{data?.summary?.targetLeads || 0}</div>
             <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-white px-2 py-0.5 rounded-full bg-[#71D878] font-bold tracking-wider uppercase">
                   {Math.round(data?.summary?.targetConv || 0)}% ИЗ ЛИДОВ
                </span>
             </div>
           </CardContent>
         </Card>
         <Card className="border-l-4 border-l-purple-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Квалы</CardTitle>
             <CheckCircle2 className="h-5 w-5 text-purple-500" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-purple-600">{data?.summary?.qualLeads || 0}</div>
             <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-white px-2 py-0.5 rounded-full bg-purple-500 font-bold tracking-wider uppercase">
                   {Math.round(data?.summary?.qualConv || 0)}% ИЗ ЛИДОВ
                </span>
             </div>
           </CardContent>
         </Card>
      </div>

      {/* Row 2: CPL, CPT, CPQ */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">CPL (Лид)</CardTitle>
             <RussianRuble className="h-5 w-5 text-primary" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-foreground">{Math.round(data?.summary?.cpl || 0).toLocaleString()} <span className="text-2xl font-bold opacity-30">₽</span></div>
             <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">стоимость лида</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">CPT (Целевой)</CardTitle>
             <Target className="h-5 w-5 text-[#71D878] opacity-50" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-[#71D878]">{Math.round(data?.summary?.cpt || 0).toLocaleString()} <span className="text-2xl font-bold opacity-30">₽</span></div>
             <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">стоимость целевого</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">CPQ (Квал)</CardTitle>
             <CheckCircle2 className="h-5 w-5 text-purple-500 opacity-50" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-purple-700">{Math.round(data?.summary?.cpq || 0).toLocaleString()} <span className="text-2xl font-bold opacity-30">₽</span></div>
             <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">стоимость квала</p>
           </CardContent>
         </Card>
      </div>

      {/* Row 3: Sales, Sum, ROMI */}
      <div className="grid gap-6 md:grid-cols-3 mb-6">
         <Card className="border-l-4 border-l-amber-400">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Продажи (шт)</CardTitle>
             <ShoppingBag className="h-5 w-5 text-amber-500" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-amber-600">{data?.summary?.sales || 0}</div>
             <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">успешные сделки</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Сумма продаж</CardTitle>
             <DollarSign className="h-5 w-5 text-amber-500" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-amber-700">{Math.round(data?.summary?.revenue || 0).toLocaleString()} <span className="text-2xl font-bold opacity-30">₽</span></div>
             <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">выручка по CRM</p>
           </CardContent>
         </Card>
         <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">ROMI</CardTitle>
             <TrendingUp className="h-5 w-5 text-primary" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-primary">{Math.round(data?.summary?.romi || 0)}%</div>
             <p className="text-[10px] text-muted-foreground mt-2 uppercase font-bold tracking-widest">окупаемость</p>
           </CardContent>
         </Card>
      </div>

      {/* Row 4: Full Width Chart */}
      <div className="grid gap-6 grid-cols-1 mb-10">
        <Card className="h-full">
          <CardHeader>
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
              <div>
                <CardTitle className="text-2xl font-black tracking-tight">Динамика лидов</CardTitle>
                <CardDescription className="text-sm font-medium">Активность маркетинга по времени</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-1 glass-card p-1 border-white/10 shadow-inner">
                  <Button variant={granularity === "day" ? "default" : "ghost"} size="sm" onClick={() => setGranularity("day")} className="h-8 text-[10px] px-4 rounded-xl">Дни</Button>
                  <Button variant={granularity === "week" ? "default" : "ghost"} size="sm" onClick={() => setGranularity("week")} className="h-8 text-[10px] px-4 rounded-xl">Недели</Button>
                  <Button variant={granularity === "month" ? "default" : "ghost"} size="sm" onClick={() => setGranularity("month")} className="h-8 text-[10px] px-4 rounded-xl">Месяцы</Button>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#2800B8] rounded-[4px]" /><span>Лиды</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-[#71D878] rounded-[4px]" /><span>Целевые</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500 rounded-[4px]" /><span>Квалы</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-[4px]" /><span>Продажи</span></div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderLineChart()}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-12">
        <section>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-black tracking-tight flex-shrink-0">Эффективность кампаний</h2>
            <div className="h-px w-full bg-primary/10" />
          </div>
          <div className="grid gap-6 md:grid-cols-3">
             <TopListCard title="Всего лидов" data={data?.topLeads} field="leads" totalValue={data?.summary?.leads} color="#2800B8" />
             <TopListCard title="Целевые" data={data?.topTarget} field="targetLeads" totalValue={data?.summary?.targetLeads} color="#71D878" />
             <TopListCard title="Квалы" data={data?.topQual} field="qualLeads" totalValue={data?.summary?.qualLeads} color="#a855f7" />
          </div>
        </section>

        <section>
           <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-black tracking-tight flex-shrink-0">Стоимость привлечения</h2>
            <div className="h-px w-full bg-primary/10" />
          </div>
          <div className="grid gap-6 md:grid-cols-3">
             <TopListCard title="CPL (Лид)" data={data?.effCpl} field="cpl" isCurrency totalValue={data?.summary?.cpl} color="#2800B8" />
             <TopListCard title="CPT (Целевой)" data={data?.effCpt} field="cpt" isCurrency totalValue={data?.summary?.cpt} color="#71D878" />
             <TopListCard title="CPQ (Квал)" data={data?.effCpq} field="cpq" isCurrency totalValue={data?.summary?.cpq} color="#a855f7" />
          </div>
        </section>
      </div>
    </div>
  )
}

function TopListCard({ title, data, field, isCurrency = false, totalValue, color }: { title: string, data: any[], field: string, isCurrency?: boolean, totalValue?: number, color?: string }) {
  return (
    <Card className="group overflow-hidden border-none">
      <CardHeader className="pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
          {totalValue !== undefined && (
            <div className={cn(
                "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider",
                isCurrency ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
               {isCurrency ? `${Math.round(totalValue).toLocaleString()} ₽` : `ИТОГО: ${totalValue}`}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2">
          {!data || data.length === 0 ? (
            <div className="text-xs text-muted-foreground italic py-8 text-center">Нет данных</div>
          ) : data.map((c: any, i: number) => (
            <div key={i} className="flex relative items-center justify-between text-sm py-3 px-4 rounded-2xl hover:bg-white/10 transition-all cursor-default border border-transparent hover:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-bold truncate text-foreground/80">{c.name}</span>
              </div>
              <span className="font-black tabular-nums text-foreground shrink-0 pl-4" style={{ color: isCurrency ? undefined : color }}>
                {isCurrency ? `${Math.round(c[field]).toLocaleString()} ₽` : c[field]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
