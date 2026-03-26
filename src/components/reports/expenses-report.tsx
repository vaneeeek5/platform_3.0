"use client"

import * as React from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
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

function SortableHead({ label, col, sortCol, sortDir, onSort }: {
    label: string;
    col: SortKey;
    sortCol: SortKey | null;
    sortDir: SortDir;
    onSort: (col: SortKey) => void;
}) {
    const active = sortCol === col;
    return (
        <TableHead className="text-right cursor-pointer select-none" onClick={() => onSort(col)}>
            <div className="flex items-center justify-end gap-1">
                {label}
                {active
                    ? sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    : <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                }
            </div>
        </TableHead>
    );
}

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

    React.useEffect(() => {
        fetch("/api/projects")
            .then(res => res.json())
            .then(setProjects);
    }, []);

    const fetchData = React.useCallback(async () => {
        if (!selectedProjectId || !dateRange?.from || !dateRange?.to) return;
        
        setLoading(true);
        try {
            const params = new URLSearchParams({
                projectId: selectedProjectId,
                dateFrom: dateRange.from.toISOString(),
                dateTo: dateRange.to.toISOString()
            });
            const res = await fetch(`/api/reports/expenses?${params}`);
            const json = await res.json();
            const fetchedData = Array.isArray(json) ? json : [];
            setData(fetchedData);
            // Default to all selected
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
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4 bg-muted/30 p-4 rounded-lg border">
                <div className="w-full md:w-[250px]">
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Выберите проект" />
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1">
                    <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Общий расход</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.cost.toLocaleString('ru-RU')} ₽</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Выбранные лиды</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.leads}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Средний CPL</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totals.leads > 0 ? (totals.cost / totals.leads).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) : 0} ₽
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Визиты</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totals.visits.toLocaleString('ru-RU')}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Эффективность рекламных кампаний</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        Выбрано строк: {selectedIds.size} из {data.length}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px] px-2 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="h-4 w-4 rounded cursor-pointer accent-primary" 
                                        checked={data.length > 0 && selectedIds.size === data.length}
                                        onChange={toggleAll}
                                        title="Выбрать все"
                                    />
                                </TableHead>
                                <TableHead>Кампания</TableHead>
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
                                    <TableCell colSpan={7} className="text-center py-10">Загрузка данных...</TableCell>
                                </TableRow>
                            ) : sortedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                                        {selectedProjectId ? "Нет данных за выбранный период. Запустите синхронизацию в настройках проекта." : "Выберите проект для отображения отчета"}
                                    </TableCell>
                                </TableRow>
                            ) : sortedData.map((row, i) => {
                                const id = row.campaignName || row.utmCampaign || `row-${i}`;
                                const isSelected = selectedIds.has(id);
                                return (
                                    <TableRow key={id} className={!isSelected ? "opacity-50 grayscale-[50%]" : ""}>
                                        <TableCell className="px-2 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="h-4 w-4 rounded cursor-pointer accent-primary"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">{id}</TableCell>
                                        <TableCell className="text-right">{row.totalVisits.toLocaleString('ru-RU')}</TableCell>
                                        <TableCell className="text-right">{row.totalCost.toLocaleString('ru-RU')} ₽</TableCell>
                                        <TableCell className="text-right font-semibold">{row.leadCount}</TableCell>
                                        <TableCell className="text-right">{row.cpl.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</TableCell>
                                        <TableCell className="text-right">
                                            <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
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
