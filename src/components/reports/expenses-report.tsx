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
        if (!user) return;
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
    }, [dateRange, user]);

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
            <div className="flex flex-col xl:flex-row xl:items-end gap-6 glass-card p-6 border-white/10 shadow-2xl">
                <div className="w-full xl:w-[300px] group">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block ml-1 transition-colors group-hover:text-primary">Проект</label>
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger className="h-12 glass-card border-white/5 hover:border-primary/30 transition-all">
                            <SelectValue placeholder="Выберите проект" />
                        </SelectTrigger>
                        <SelectContent className="glass-card border-white/10">
                            {projects.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 group">
                   <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block ml-1 transition-colors group-hover:text-primary">Период</label>
                   <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                </div>
                <div className="shrink-0">
                    <Button 
                        variant="outline" 
                        onClick={fetchData} 
                        className="h-12 rounded-2xl px-8 font-bold border-primary/20 text-primary hover:bg-primary hover:text-white transition-all"
                        disabled={loading}
                    >
                        {loading ? "Обновление..." : "Обновить данные"}
                    </Button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="py-4 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Общий расход</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-[#2800B8]">{totals.cost.toLocaleString('ru-RU')} <span className="text-xl opacity-30">₽</span></div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-[#71D878]">
                    <CardHeader className="py-4 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Выбранные лиды</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-[#71D878]">{totals.leads}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-4 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Средний CPL</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-foreground">
                            {totals.leads > 0 ? Math.round(totals.cost / totals.leads).toLocaleString('ru-RU') : 0} <span className="text-xl opacity-30">₽</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-4 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Визиты</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-foreground">{totals.visits.toLocaleString('ru-RU')}</div>
                    </CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden border-none shadow-2xl">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                    <div>
                        <CardTitle className="text-2xl font-black tracking-tight">Эффективность рекламных кампаний</CardTitle>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                            {selectedIds.size} из {data.length} кампаний активно
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={toggleAll} className="text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 hover:text-primary">
                            {selectedIds.size === data.length ? "Снять всё" : "Выбрать всё"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent border-white/5">
                                <TableHead className="w-[50px] px-4 text-center">
                                    {/* Empty for selection checkboxes below */}
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground h-14">Кампания</TableHead>
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
                                    <TableCell colSpan={7} className="text-center py-20">
                                        <div className="inline-flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                            <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Загрузка данных...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-20 text-muted-foreground font-medium italic">
                                        {selectedProjectId ? "Нет данных за выбранный период." : "Выберите проект для отображения отчета"}
                                    </TableCell>
                                </TableRow>
                            ) : sortedData.map((row, i) => {
                                const id = row.campaignName || row.utmCampaign || `row-${i}`;
                                const isSelected = selectedIds.has(id);
                                return (
                                    <TableRow 
                                        key={id} 
                                        className={cn(
                                            "transition-all border-white/5 h-16 cursor-pointer group",
                                            !isSelected && "opacity-30 grayscale hover:opacity-50",
                                            isSelected && "hover:bg-primary/5"
                                        )}
                                        onClick={() => toggleSelection(id)}
                                    >
                                        <TableCell className="px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                className="h-5 w-5 rounded-lg cursor-pointer accent-[#2800B8] border-white/20 bg-white/5"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-bold text-foreground/80 max-w-[200px] truncate">{id}</TableCell>
                                        <TableCell className="text-right tabular-nums font-medium">{row.totalVisits.toLocaleString('ru-RU')}</TableCell>
                                        <TableCell className="text-right tabular-nums font-black text-[#2800B8]">{row.totalCost.toLocaleString('ru-RU')} ₽</TableCell>
                                        <TableCell className="text-right tabular-nums font-black text-[#71D878]">{row.leadCount}</TableCell>
                                        <TableCell className="text-right tabular-nums font-bold">{row.cpl.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</TableCell>
                                        <TableCell className="text-right">
                                            <div className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 border border-purple-500/20">
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
