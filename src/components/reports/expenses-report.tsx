"use client"

import * as React from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
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
import { DateRange } from "react-day-picker"

interface ReportData {
    utmCampaign: string;
    totalCost: number;
    totalVisits: number;
    totalClicks: number;
    leadCount: number;
    cpl: number;
    cpc: number;
    conversion: number;
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
            setData(Array.isArray(json) ? json : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [selectedProjectId, dateRange]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totals = React.useMemo(() => {
        return data.reduce((acc, curr) => ({
            cost: acc.cost + (curr.totalCost || 0),
            visits: acc.visits + (curr.totalVisits || 0),
            leads: acc.leads + (curr.leadCount || 0),
            clicks: acc.clicks + (curr.totalClicks || 0)
        }), { cost: 0, visits: 0, leads: 0, clicks: 0 });
    }, [data]);

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
                        <CardTitle className="text-sm font-medium text-muted-foreground">Всего лидов</CardTitle>
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
                <CardHeader>
                    <CardTitle>Эффективность рекламных кампаний</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Кампания (Маппинг)</TableHead>
                                <TableHead className="text-right">Визиты</TableHead>
                                <TableHead className="text-right">Расход</TableHead>
                                <TableHead className="text-right">Лиды</TableHead>
                                <TableHead className="text-right">CPL</TableHead>
                                <TableHead className="text-right">Конверсия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10">Загрузка данных...</TableCell>
                                </TableRow>
                            ) : data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                                        {selectedProjectId ? "Нет данных за выбранный период. Запустите синхронизацию в настройках проекта." : "Выберите проект для отображения отчета"}
                                    </TableCell>
                                </TableRow>
                            ) : data.map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-medium">{row.utmCampaign || "—"}</TableCell>
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
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
