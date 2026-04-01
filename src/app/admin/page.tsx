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
      <div className="relative w-full h-[300px] md:h-[500px] mt-8">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-sans">
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
            const val = Math.round(roundedMax * p);
            const y = getY(val);
            return (
              <g key={i}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" className="text-muted/5" strokeDasharray="4 4" />
                <text x={padding.left - 15} y={y + 4} textAnchor="end" className="text-[10px] fill-muted-foreground/40 font-black uppercase tracking-tighter">{val}</text>
              </g>
            );
          })}

          {data.trends.map((t: any, i: number) => {
            const step = Math.ceil(data.trends.length / 10);
            if (i % step !== 0 && i !== data.trends.length - 1) return null;
            return (
              <text key={i} x={getX(i)} y={height - padding.bottom + 30} textAnchor="middle" className="text-[10px] fill-muted-foreground/40 font-black uppercase tracking-widest">
                {t.period}
              </text>
            );
          })}

          <path d={createPath("leads")} stroke="hsl(var(--primary))" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700 drop-shadow-[0_0_10px_rgba(40,0,184,0.2)]" />
          <path d={createPath("qualLeads")} stroke="#a855f7" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700 opacity-50" />
          <path d={createPath("targetLeads")} stroke="#71D878" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700 drop-shadow-[0_0_10px_rgba(113,216,120,0.2)]" />
          <path d={createPath("sales")} stroke="#f59e0b" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700 opacity-80" />

          {data.trends.map((t: any, i: number) => (
            <g key={i} className="group/point">
              <rect x={getX(i) - 15} y={padding.top} width="30" height={chartHeight} fill="transparent" className="cursor-pointer" />
              <circle cx={getX(i)} cy={getY(t.leads)} r="6" fill="hsl(var(--primary))" stroke="white" strokeWidth="3" className="opacity-0 group-hover/point:opacity-100 transition-opacity shadow-2xl" />
              <circle cx={getX(i)} cy={getY(t.targetLeads)} r="6" fill="#71D878" stroke="white" strokeWidth="3" className="opacity-0 group-hover/point:opacity-100 transition-opacity shadow-2xl" />

              <foreignObject x={getX(i) + 15} y={padding.top + 20} width="200" height="150" className="pointer-events-none hidden group-hover/point:block z-50 overflow-visible">
                <div className="glass-card shadow-2xl p-5 text-[11px] border-none scale-in-center animate-in fade-in duration-300">
                  <div className="font-black border-b border-white/5 mb-3 pb-2 text-primary uppercase tracking-widest">{t.period}</div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center gap-6">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-primary" /><span>Лиды:</span></div>
                      <span className="font-black text-primary text-sm">{t.leads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-6">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#71D878]" /><span>Целевые:</span></div>
                      <span className="font-black text-[#71D878] text-sm">{t.targetLeads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-6 opacity-60">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-purple-500" /><span>Квалы:</span></div>
                      <span className="font-black text-purple-600">{t.qualLeads}</span>
                    </div>
                    <div className="flex justify-between items-center gap-6">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span>Продажи:</span></div>
                      <span className="font-black text-amber-600 text-sm">{t.sales}</span>
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
    <div className="p-6 md:p-10 space-y-10 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
           <div className="flex items-center gap-4 mb-2">
              <div className="p-3 glass-card rounded-2xl shadow-xl border-none">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                Дашборд
              </h1>
           </div>
           <p className="text-muted-foreground/60 font-black uppercase tracking-[0.2em] text-[10px] pl-1">Аналитика эффективности маркетинга</p>
        </div>
        
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full md:w-[240px] glass-card h-12 border-none font-black uppercase text-[10px] tracking-widest shadow-xl">
              <Filter className="w-4 h-4 mr-2 text-primary" />
              <SelectValue placeholder="Все проекты" />
            </SelectTrigger>
            <SelectContent className="glass-card border-none shadow-2xl">
              {userRole === "SUPER_ADMIN" && <SelectItem value="0" className="font-black uppercase text-[10px] tracking-widest">Все проекты</SelectItem>}
              {projectsData?.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()} className="font-black uppercase text-[10px] tracking-widest">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 1: Leads, Target, Quals */}
      <div className="grid gap-8 md:grid-cols-3 mb-8">
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Всего лидов</CardTitle>
             <div className="p-2 bg-primary/10 rounded-xl"><Briefcase className="h-5 w-5 text-primary" /></div>
           </CardHeader>
           <CardContent>
             <div className="text-5xl font-black tracking-tighter text-primary drop-shadow-sm">{data?.summary?.leads || 0}</div>
             <p className="text-[9px] text-muted-foreground/40 mt-3 uppercase font-black tracking-[0.15em]">за выбранный период</p>
           </CardContent>
         </Card>
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Целевые</CardTitle>
             <div className="p-2 bg-[#71D878]/10 rounded-xl"><Target className="h-5 w-5 text-[#71D878]" /></div>
           </CardHeader>
           <CardContent>
             <div className="text-5xl font-black tracking-tighter text-[#71D878] drop-shadow-sm">{data?.summary?.targetLeads || 0}</div>
             <div className="flex items-center gap-2 mt-4">
                 <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-[#71D878] shadow-[0_0_10px_rgba(113,216,120,0.5)]" style={{ width: `${Math.min(data?.summary?.targetConv || 0, 100)}%` }} />
                 </div>
                <span className="text-[10px] text-[#71D878] font-black tracking-widest uppercase">
                   {Math.round(data?.summary?.targetConv || 0)}%
                </span>
             </div>
           </CardContent>
         </Card>
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Квалы</CardTitle>
             <div className="p-2 bg-purple-500/10 rounded-xl"><CheckCircle2 className="h-5 w-5 text-purple-500" /></div>
           </CardHeader>
           <CardContent>
             <div className="text-5xl font-black tracking-tighter text-purple-500 drop-shadow-sm">{data?.summary?.qualLeads || 0}</div>
             <div className="flex items-center gap-2 mt-4">
                 <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" style={{ width: `${Math.min(data?.summary?.qualConv || 0, 100)}%` }} />
                 </div>
                <span className="text-[10px] text-purple-500 font-black tracking-widest uppercase">
                   {Math.round(data?.summary?.qualConv || 0)}%
                </span>
             </div>
           </CardContent>
         </Card>
      </div>

      {/* Row 2: CPL, CPT, CPQ */}
      <div className="grid gap-8 md:grid-cols-3 mb-8">
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">CPL (Лид)</CardTitle>
             <RussianRuble className="h-4 w-4 text-primary/40" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-foreground">{Math.round(data?.summary?.cpl || 0).toLocaleString()} <span className="text-xl font-bold text-muted-foreground/30">₽</span></div>
             <p className="text-[9px] text-muted-foreground/40 mt-3 uppercase font-black tracking-[0.15em]">стоимость лида</p>
           </CardContent>
         </Card>
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">CPT (Целевой)</CardTitle>
             <Target className="h-4 w-4 text-[#71D878]/40" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-foreground">{Math.round(data?.summary?.cpt || 0).toLocaleString()} <span className="text-xl font-bold text-muted-foreground/30">₽</span></div>
             <p className="text-[9px] text-muted-foreground/40 mt-3 uppercase font-black tracking-[0.15em]">стоимость целевого</p>
           </CardContent>
         </Card>
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">CPQ (Квал)</CardTitle>
             <CheckCircle2 className="h-4 w-4 text-purple-500/40" />
           </CardHeader>
           <CardContent>
             <div className="text-4xl font-black tracking-tighter text-foreground">{Math.round(data?.summary?.cpq || 0).toLocaleString()} <span className="text-xl font-bold text-muted-foreground/30">₽</span></div>
             <p className="text-[9px] text-muted-foreground/40 mt-3 uppercase font-black tracking-[0.15em]">стоимость квала</p>
           </CardContent>
         </Card>
      </div>

      {/* Row 3: Sales, Sum, ROMI */}
      <div className="grid gap-8 md:grid-cols-3 mb-8">
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Успешные сделки</CardTitle>
             <div className="p-2 bg-amber-500/10 rounded-xl"><ShoppingBag className="h-5 w-5 text-amber-500" /></div>
           </CardHeader>
           <CardContent>
             <div className="text-5xl font-black tracking-tighter text-amber-500 drop-shadow-sm">{data?.summary?.sales || 0} <span className="text-xl font-bold opacity-30">шт</span></div>
           </CardContent>
         </Card>
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Сумма продаж</CardTitle>
             <div className="p-2 bg-amber-500/10 rounded-xl"><DollarSign className="h-5 w-5 text-amber-500" /></div>
           </CardHeader>
           <CardContent>
             <div className="text-5xl font-black tracking-tighter text-foreground drop-shadow-sm">{Math.round(data?.summary?.revenue || 0).toLocaleString()} <span className="text-xl font-bold text-muted-foreground/30">₽</span></div>
           </CardContent>
         </Card>
         <Card className="glass-card border-none shadow-2xl transition-all hover:scale-[1.02] duration-500 overflow-hidden relative">
           <div className={cn(
               "absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full -mr-16 -mt-16 opacity-20",
               (data?.summary?.romi || 0) > 0 ? "bg-[#71D878]" : "bg-destructive"
           )} />
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
             <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">ROMI</CardTitle>
             <div className="p-2 bg-primary/10 rounded-xl"><TrendingUp className="h-5 w-5 text-primary" /></div>
           </CardHeader>
           <CardContent>
             <div className={cn(
                 "text-5xl font-black tracking-tighter drop-shadow-sm",
                 (data?.summary?.romi || 0) > 0 ? "text-primary" : "text-muted-foreground/40"
             )}>{Math.round(data?.summary?.romi || 0)}%</div>
             <p className="text-[9px] text-muted-foreground/40 mt-3 uppercase font-black tracking-[0.15em]">окупаемость маркетинга</p>
           </CardContent>
         </Card>
      </div>

      {/* Row 4: Full Width Chart */}
      <div className="grid gap-8 grid-cols-1 mb-12">
        <Card className="glass-card border-none shadow-2xl transition-all duration-1000 p-2">
          <CardHeader className="p-8 pb-4">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8">
              <div>
                <CardTitle className="text-3xl font-black tracking-tighter">Динамика воронки</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-1">Активность маркетинга по времени</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-8">
                <div className="flex items-center gap-1.5 glass-card p-1.5 border-none shadow-inner bg-black/5 dark:bg-white/5 rounded-2xl">
                  <Button variant={granularity === "day" ? "default" : "ghost"} size="sm" onClick={() => setGranularity("day")} className="h-9 text-[10px] px-5 rounded-xl font-black uppercase tracking-widest">Дни</Button>
                  <Button variant={granularity === "week" ? "default" : "ghost"} size="sm" onClick={() => setGranularity("week")} className="h-9 text-[10px] px-5 rounded-xl font-black uppercase tracking-widest">Недели</Button>
                  <Button variant={granularity === "month" ? "default" : "ghost"} size="sm" onClick={() => setGranularity("month")} className="h-9 text-[10px] px-5 rounded-xl font-black uppercase tracking-widest">Месяцы</Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-10">
            {renderLineChart()}
            <div className="flex flex-wrap items-center justify-center gap-10 mt-10 pt-8 border-t border-white/5">
                <div className="flex items-center gap-3"><div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_10px_rgba(40,0,184,0.5)]" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Лиды</span></div>
                <div className="flex items-center gap-3"><div className="w-3 h-3 bg-[#71D878] rounded-full shadow-[0_0_10px_rgba(113,216,120,0.5)]" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Целевые</span></div>
                <div className="flex items-center gap-3 opacity-40"><div className="w-3 h-3 bg-purple-500 rounded-full" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Квалы</span></div>
                <div className="flex items-center gap-3"><div className="w-3 h-3 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.3)]" /><span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Продажи</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-16 pb-20">
        <section>
          <div className="flex items-center gap-6 mb-8">
            <h2 className="text-3xl font-black tracking-tighter flex-shrink-0">Эффективность кампаний</h2>
            <div className="h-px w-full bg-gradient-to-r from-primary/20 to-transparent" />
          </div>
          <div className="grid gap-8 md:grid-cols-3">
             <TopListCard title="Всего лидов" data={data?.topLeads} field="leads" totalValue={data?.summary?.leads} color="hsl(var(--primary))" />
             <TopListCard title="Целевые" data={data?.topTarget} field="targetLeads" totalValue={data?.summary?.targetLeads} color="#71D878" />
             <TopListCard title="Квалы" data={data?.topQual} field="qualLeads" totalValue={data?.summary?.qualLeads} color="#a855f7" />
          </div>
        </section>

        <section>
           <div className="flex items-center gap-6 mb-8">
            <h2 className="text-3xl font-black tracking-tighter flex-shrink-0">Стоимость привлечения</h2>
            <div className="h-px w-full bg-gradient-to-r from-primary/20 to-transparent" />
          </div>
          <div className="grid gap-8 md:grid-cols-3">
             <TopListCard title="CPL (Лид)" data={data?.effCpl} field="cpl" isCurrency totalValue={data?.summary?.cpl} color="hsl(var(--primary))" />
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
    <Card className="glass-card border-none shadow-2xl group overflow-hidden transition-all duration-500">
      <CardHeader className="p-6 pb-4 border-b border-white/5 bg-white/5 dark:bg-black/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{title}</CardTitle>
          {totalValue !== undefined && (
            <div className={cn(
                "text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-inner",
                isCurrency ? "bg-primary/10 text-primary" : "bg-white/5 text-muted-foreground/40"
            )}>
               {isCurrency ? `${Math.round(totalValue).toLocaleString()} ₽` : `Σ ${totalValue}`}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {!data || data.length === 0 ? (
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/20 py-10 text-center italic">Нет данных</div>
          ) : data.map((c: any, i: number) => (
            <div key={i} className="flex relative items-center justify-between text-xs p-4 rounded-[1.5rem] hover:bg-primary/5 transition-all cursor-default border border-transparent hover:border-primary/10 group/item">
              <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: color }} />
                  <span className="font-black tracking-tight truncate text-foreground/70 group-hover/item:text-foreground transition-colors">{c.name}</span>
              </div>
              <span className="font-black tabular-nums shrink-0 pl-6 text-sm" style={{ color: isCurrency ? undefined : color }}>
                {isCurrency ? `${Math.round(c[field]).toLocaleString()}` : c[field]}
                {isCurrency && <span className="ml-1 opacity-20 text-[10px]">₽</span>}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
