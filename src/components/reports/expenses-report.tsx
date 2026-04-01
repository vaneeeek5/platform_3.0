"use client"

import * as React from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DateRange } from "react-day-picker"

interface ReportData {
    utmCampaign: string;
    campaignName?: string;
    totalCost: number;
    totalVisits: number;
    totalClicks: number;
    leadCount: number;
    cpl: number;
    cpc: number;
    conversion: number;
}

type SortKey = keyof ReportData;
type SortDir = "asc" | "desc";


export function ExpensesReport() {
    const [projects, setProjects] = React.useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        to: new Date()
    });
    const [data, setData] = React.useState<ReportData[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [sortCol, setSortCol] = React.useState<SortKey | null>("totalCost");
    const [sortDir, setSortDir] = React.useState<SortDir>("desc");
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
    const [isInitialized, setIsInitialized] = React.useState(false);

    const [user, setUser] = React.useState<any>(null);

    React.useEffect(() => {
        const init = async () => {
            try {
                const [meRes, projRes] = await Promise.all([
                    fetch("/api/admin/me").then(r => r.json()),
                    fetch("/api/projects").then(r => r.json())
                ]);
                
                setUser(meRes);
                if (meRes.preferences?.expenses?.dateRange) {
                    const p = meRes.preferences.expenses.dateRange;
                    if (p.from && p.to) {
                        setDateRange({
                            from: new Date(p.from),
                            to: new Date(p.to)
                        });
                    }
                }
                setIsInitialized(true);
                const isSuper = meRes.role === "SUPER_ADMIN";
                
                const allowedProjects = projRes.filter((p: any) => {
                    if (isSuper) return true;
                    const link = meRes.links?.find((l: any) => l.projectId === p.id);
                    return link?.canViewExpenses;
                });
                
                setProjects(allowedProjects);
                
                if (allowedProjects.length > 0) {
                    setSelectedProjectId(allowedProjects[0].id.toString());
                }
            } catch (e) {
                console.error(e);
            }
        };
        init();
    }, []);

    // Sync preferences to DB
    React.useEffect(() => {
        if (!isInitialized || !user) return;
        const timer = setTimeout(() => {
            fetch("/api/admin/preferences", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    expenses: {
                        dateRange: {
                            from: dateRange?.from?.toISOString(),
                            to: dateRange?.to?.toISOString()
                        }
                    }
                })
            });
        }, 1000);
        return () => clearTimeout(timer);
    }, [dateRange, user, isInitialized]);

    const fetchData = React.useCallback(async () => {
        if (!selectedProjectId || !dateRange?.from || !dateRange?.to) return;
        
        setLoading(true);
        try {
            const params = new URLSearchParams({
                projectId: selectedProjectId,
                dateFrom: format(dateRange.from, 'yyyy-MM-dd'),
                dateTo: format(dateRange.to, 'yyyy-MM-dd')
            });
            const res = await fetch(`/api/reports/expenses?${params}`);
            const json = await res.json();
            const fetchedData = Array.isArray(json) ? json : [];
            setData(fetchedData);
            setSelectedIds(new Set(fetchedData.map((r, i) => r.campaignName || r.utmCampaign || `row-${i}`)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [selectedProjectId, dateRange]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSort = (col: SortKey) => {
        if (sortCol === col) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortCol(col);
            setSortDir("desc");
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === data.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(data.map((r, i) => r.campaignName || r.utmCampaign || `row-${i}`)));
        }
    };

    const sortedData = React.useMemo(() => {
        if (!sortCol) return data;
        return [...data].sort((a, b) => {
            const av = a[sortCol] as number;
            const bv = b[sortCol] as number;
            return sortDir === "asc" ? av - bv : bv - av;
        });
    }, [data, sortCol, sortDir]);

    const totals = React.useMemo(() => {
        return data
            .filter((r, i) => selectedIds.has(r.campaignName || r.utmCampaign || `row-${i}`))
            .reduce((acc, curr) => ({
                cost: acc.cost + (curr.totalCost || 0),
                visits: acc.visits + (curr.totalVisits || 0),
                leads: acc.leads + (curr.leadCount || 0),
                clicks: acc.clicks + (curr.totalClicks || 0)
            }), { cost: 0, visits: 0, leads: 0, clicks: 0 });
    }, [data, selectedIds]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Filters Bar */}
            <div className="flex flex-col xl:flex-row xl:items-end gap-8 glass-card p-10 border-white/10 shadow-2xl rounded-[2.5rem]">
                <div className="w-full xl:w-[280px] group">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block ml-1 transition-colors group-hover:text-primary">Проект</label>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="h-11 glass-card border-white/5 hover:border-primary/30 transition-all rounded-2xl text-xs font-semibold">
                            <SelectValue placeholder="Выберите проект" />
                        </SelectTrigger>
                        <SelectContent className="glass-card border-white/10 shadow-2xl rounded-2xl">
                            {projects.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()} className="text-[11px] font-bold uppercase tracking-tight">{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 group">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block ml-1 transition-colors group-hover:text-primary">Период</label>
                   <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                </div>
                <div className="shrink-0">
                    <Button 
                        variant="outline" 
                        onClick={fetchData} 
                        className="h-11 rounded-2xl px-10 font-black uppercase text-[10px] tracking-widest border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5 active:scale-95"
                        disabled={loading}
                    >
                        {loading ? "Загрузка..." : "Обновить отчёт"}
                    </Button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] border-none shadow-xl glass-card backdrop-blur-xl group hover:bg-white/5 transition-all">
                    <CardHeader className="py-5 px-8 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Общий расход</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-6">
                        <div className="text-3xl font-black tracking-tighter text-[#2800B8] drop-shadow-sm">{totals.cost.toLocaleString('ru-RU')} <span className="text-xl opacity-30">₽</span></div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-xl glass-card backdrop-blur-xl border-l-4 border-l-primary group hover:bg-white/5 transition-all">
                    <CardHeader className="py-5 px-8 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Выбранные лиды</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-6">
                        <div className="text-3xl font-black tracking-tighter text-primary">{totals.leads}</div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-xl glass-card backdrop-blur-xl group hover:bg-white/5 transition-all">
                    <CardHeader className="py-5 px-8 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Средний CPL</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-6">
                        <div className="text-3xl font-black tracking-tighter text-foreground">
                            {totals.leads > 0 ? Math.round(totals.cost / totals.leads).toLocaleString('ru-RU') : 0} <span className="text-xl opacity-30">₽</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-none shadow-xl glass-card backdrop-blur-xl group hover:bg-white/5 transition-all">
                    <CardHeader className="py-5 px-8 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Визиты</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-6">
                        <div className="text-3xl font-black tracking-tighter text-foreground">{totals.visits.toLocaleString('ru-RU')}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] glass-card backdrop-blur-xl">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 px-10 py-8 border-b border-white/5">
                    <div>
                        <CardTitle className="text-2xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Эффективность кампаний</CardTitle>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-1.5 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            {selectedIds.size} из {data.length} в выборке
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={toggleAll} className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary hover:bg-primary/10 transition-all">
                            {selectedIds.size === data.length ? "Сбросить выбор" : "Выбрать всё"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-white/5 dark:bg-black/20">
                            <TableRow className="hover:bg-transparent border-white/5">
                                <TableHead className="w-[60px] pl-10 text-center">
                                    {/* Empty for selection checkboxes below */}
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 h-16 w-[180px]">Кампания</TableHead>
                                <SortableHead label="Визиты" col="totalVisits" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                <SortableHead label="Расход" col="totalCost" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                <SortableHead label="Лиды" col="leadCount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                <SortableHead label="CPL" col="cpl" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                                <SortableHead label="Конверсия" col="conversion" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-20 border-none">
                                        <div className="inline-flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin shadow-lg shadow-primary/10" />
                                            <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] translate-y-1">Загрузка данных...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-24 text-[11px] font-black uppercase tracking-widest text-muted-foreground/30 italic border-none">
                                        {selectedProjectId ? "Данные не найдены за период" : "Выберите проект для начала"}
                                    </TableCell>
                                </TableRow>
                            ) : sortedData.map((row, i) => {
                                const id = row.campaignName || row.utmCampaign || `row-${i}`;
                                const isSelected = selectedIds.has(id);
                                return (
                                    <TableRow 
                                        key={id} 
                                        className={cn(
                                            "transition-all border-white/5 h-[72px] cursor-pointer group",
                                            !isSelected && "opacity-25 grayscale hover:opacity-50",
                                            isSelected && "hover:bg-primary/[0.03]"
                                        )}
                                        onClick={() => toggleSelection(id)}
                                    >
                                        <TableCell className="pl-10 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                className="h-5 w-5 rounded-lg cursor-pointer accent-primary border-primary/20 bg-white/5 shadow-inner"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-extrabold text-[12px] text-foreground/80 max-w-[180px] pr-6">
                                            <div className="truncate uppercase tracking-tight" title={id}>{id}</div>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-black text-[11px] text-muted-foreground/60">{row.totalVisits.toLocaleString('ru-RU')}</TableCell>
                                        <TableCell className="text-right tabular-nums font-black text-[13px] text-primary">{row.totalCost.toLocaleString('ru-RU')} ₽</TableCell>
                                        <TableCell className="text-right tabular-nums font-black text-[13px] text-[#71D878]">{row.leadCount}</TableCell>
                                        <TableCell className="text-right tabular-nums font-black text-[12px]">{row.cpl.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</TableCell>
                                        <TableCell className="text-right pr-10">
                                            <div className="inline-flex items-center px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border border-primary/10 shadow-sm">
                                                {row.conversion.toFixed(2)}%
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function SortableHead({ label, col, sortCol, sortDir, onSort }: {
    label: string;
    col: SortKey;
    sortCol: SortKey | null;
    sortDir: SortDir;
    onSort: (col: SortKey) => void;
}) {
    const active = sortCol === col;
    return (
        <TableHead 
            className={cn(
                "text-right cursor-pointer select-none h-14 group/head",
                active ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
            )} 
            onClick={() => onSort(col)}
        >
            <div className="flex items-center justify-end gap-1.5 text-[10px] font-black uppercase tracking-widest">
                {label}
                <div className={cn(
                    "transition-all duration-300",
                    active ? "opacity-100" : "opacity-0 group-hover/head:opacity-40"
                )}>
                    {active && sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                </div>
            </div>
        </TableHead>
    );
}
