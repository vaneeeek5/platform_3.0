"use client"

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Clock, FileSpreadsheet, CheckCircle2, AlertCircle, GitMerge, Download, Plus, Trash2, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import { cn } from "@/lib/utils";

export function SyncSettings({ projectId }: { projectId: number }) {
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [syncReport, setSyncReport] = useState<any>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalStatuses, setInternalStatuses] = useState<{ targets: any[], quals: any[], stages: any[] }>({ targets: [], quals: [], stages: [] });

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/statuses/target`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/statuses/qualification`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/statuses/stages`).then(r => r.json()),
    ]).then(([targets, quals, stages]) => {
      setInternalStatuses({ 
        targets: Array.isArray(targets) ? targets : [], 
        quals: Array.isArray(quals) ? quals : [], 
        stages: Array.isArray(stages) ? stages : [] 
      });
    });
  }, [projectId]);

  const handleManualSync = async () => {
    if (!dateRange?.from || !dateRange?.to) {
        toast.error("Выберите период для синхронизации");
        return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           dateFrom: format(dateRange.from, 'yyyy-MM-dd'),
           dateTo: format(dateRange.to, 'yyyy-MM-dd')
        })
      });
      if (res.ok) {
        toast.success("Задание на синхронизацию добавлено в очередь");
      } else {
        toast.error("Ошибка при запуске синхронизации");
      }
    } catch (e) {
      toast.error("Произошла ошибка");
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
      
      if (json.length > 0) {
        setHeaders(json[0] as string[]);
        setFileData(json.slice(1));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const [colMapping, setColMapping] = useState({ 
     clientId: "", 
     date: "", 
     target: "", 
     qual: "", 
     stage: "",
     utmSource: "",
     utmCampaign: ""
  });

  const [uniqueTargets, setUniqueTargets] = useState<string[]>([]);
  const [targetValMapping, setTargetValMapping] = useState<Record<string, number | "auto" | "ignore">>({});

  const [uniqueQuals, setUniqueQuals] = useState<string[]>([]);
  const [qualValMapping, setQualValMapping] = useState<Record<string, number | "auto" | "ignore">>({});

  const [uniqueStages, setUniqueStages] = useState<string[]>([]);
  const [stageValMapping, setStageValMapping] = useState<Record<string, number | "auto" | "ignore">>({});

  const extractUnique = (columnName: string, setter: any, mapSetter: any) => {
      if (columnName && fileData) {
         const idx = headers.indexOf(columnName);
         if (idx !== -1) {
             const items = Array.from(new Set(fileData.map(row => row[idx]))).filter(Boolean).map(String) as string[];
             setter(items);
             const initMap: any = {};
             // По умолчанию все создается автоматически
             items.forEach(s => initMap[s] = 'auto');
             mapSetter(initMap);
         }
      } else {
         setter([]);
      }
  };

  useEffect(() => {
     extractUnique(colMapping.target, setUniqueTargets, setTargetValMapping);
     extractUnique(colMapping.qual, setUniqueQuals, setQualValMapping);
     extractUnique(colMapping.stage, setUniqueStages, setStageValMapping);
  }, [colMapping.target, colMapping.qual, colMapping.stage, fileData, headers]);

  const handleSmartImport = async () => {
     if (!colMapping.clientId && !colMapping.date) {
        toast.error("Для сверки необходимо выбрать хотя бы колонку Client ID или Дату");
        return;
     }

     setUploading(true);
     // Преобразовываем данные для API
     const rows = fileData?.map(r => {
       const rawTarget = colMapping.target ? String(r[headers.indexOf(colMapping.target)] || "") : "";
       const mappedTarget = rawTarget ? targetValMapping[rawTarget] : 'ignore';

       const rawQual = colMapping.qual ? String(r[headers.indexOf(colMapping.qual)] || "") : "";
       const mappedQual = rawQual ? qualValMapping[rawQual] : 'ignore';

       const rawStage = colMapping.stage ? String(r[headers.indexOf(colMapping.stage)] || "") : "";
       const mappedStage = rawStage ? stageValMapping[rawStage] : 'ignore';

       return {
         clientId: colMapping.clientId ? r[headers.indexOf(colMapping.clientId)] : null,
         date: colMapping.date ? r[headers.indexOf(colMapping.date)] : null,
          utmSource: colMapping.utmSource ? r[headers.indexOf(colMapping.utmSource)] : null,
          utmCampaign: colMapping.utmCampaign ? r[headers.indexOf(colMapping.utmCampaign)] : null,
         targetRaw: rawTarget,
         targetMap: mappedTarget,
         qualRaw: rawQual,
         qualMap: mappedQual,
         stageRaw: rawStage,
         stageMap: mappedStage,
          fullRow: r,
       };
     }) || [];

     try {
        const res = await fetch(`/api/leads/merge-archive`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ 
              projectId,
              rows
           })
        });

        if (res.ok) {
           const result = await res.json();
           setSyncReport(result);
           setFileData(null);
           setColMapping({ clientId: "", date: "", target: "", qual: "", stage: "", utmSource: "", utmCampaign: "" });
           if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
           toast.error("Ошибка при сверке архива");
        }
     } catch (e) {
        toast.error("Произошла ошибка сети");
     } finally {
        setUploading(false);
     }
  };

  const downloadUnmatchedCSV = () => {
    if (!syncReport?.unmatchedRows) return;
    
    // Берем заголовки из оригинального файла (если они есть) + добавляем префикс если надо
    const csvHeaders = headers.join(",");
    const csvRows = syncReport.unmatchedRows.map((r: any) => {
        // r.fullRow содержит оригинальный массив данных
        return (r.fullRow || []).map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvHeaders + "\n" + csvRows.join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `unmatched_leads_full_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleForceAdd = async () => {
    if (!syncReport?.unmatchedRows || syncReport.unmatchedRows.length === 0) return;
    
    setUploading(true);
    try {
        const res = await fetch(`/api/leads/force-add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                projectId,
                rows: syncReport.unmatchedRows
            })
        });

        if (res.ok) {
            const result = await res.json();
            toast.success(`Успешно добавлено ${result.count} новых лидов`);
            setSyncReport(null); // Закрываем отчет после успеха
        } else {
            toast.error("Ошибка при принудительном добавлении");
        }
    } catch (e) {
        toast.error("Ошибка сети");
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      
      <Dialog open={!!syncReport} onOpenChange={(open) => !open && setSyncReport(null)}>
        <DialogContent className="max-w-3xl glass-card border-white/20 shadow-2xl rounded-[2.5rem] overflow-hidden p-0 flex flex-col max-h-[90vh]">
          <div className="p-8 border-b border-white/5 bg-muted/30">
            <DialogHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-3xl font-black tracking-tight">Отчет о синхронизации</DialogTitle>
                        <DialogDescription className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mt-1">
                            Обработано строк: {syncReport?.totalRows || 0}
                        </DialogDescription>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <GitMerge className="h-6 w-6" />
                    </div>
                </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-6 rounded-[1.5rem] bg-[#71D878]/10 border border-[#71D878]/20 flex items-center justify-between group overflow-hidden relative">
                    <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <CheckCircle2 className="h-24 w-24 text-[#71D878]" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#71D878]/80 mb-1">Сопоставлено</p>
                        <p className="text-4xl font-black text-[#71D878]">{syncReport?.updated || 0}</p>
                    </div>
                </div>
                <div className="p-6 rounded-[1.5rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-between group overflow-hidden relative">
                    <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <AlertCircle className="h-24 w-24 text-amber-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/80 mb-1">Не найдено</p>
                        <p className="text-4xl font-black text-amber-500">{syncReport?.skippedRows || syncReport?.skipped || 0}</p>
                    </div>
                </div>
             </div>
             
             {syncReport?.unmatchedRows && syncReport.unmatchedRows.length > 0 && (
                <div className="flex flex-col bg-white/5 border border-white/5 rounded-[2rem] overflow-hidden">
                   <div className="px-8 py-5 flex items-center justify-between border-b border-white/5 bg-muted/20">
                      <span className="text-[11px] font-black uppercase tracking-tight text-muted-foreground">Архивные лиды (не в CRM)</span>
                      <Button variant="ghost" size="sm" onClick={downloadUnmatchedCSV} className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/10 text-primary hover:bg-primary/5">
                        <Download className="h-4 w-4 mr-2" />
                        Скачать CSV
                      </Button>
                   </div>
                   <div className="overflow-auto max-h-[350px]">
                      <Table>
                         <TableHeader className="bg-muted/10 h-14">
                            <TableRow className="border-white/5 hover:bg-transparent">
                               <TableHead className="pl-8 text-[10px] font-black uppercase tracking-widest">Client ID (_ym_uid)</TableHead>
                               <TableHead className="text-[10px] font-black uppercase tracking-widest">Дата</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {syncReport.unmatchedRows.map((r: any, i: number) => (
                               <TableRow key={i} className="border-white/5 hover:bg-primary/5 h-14">
                                  <TableCell className="pl-8 font-mono text-[10px] font-medium text-foreground/70">{r.clientId || '—'}</TableCell>
                                  <TableCell className="text-[11px] font-bold text-muted-foreground">{r.date || '—'}</TableCell>
                               </TableRow>
                            ))}
                         </TableBody>
                      </Table>
                   </div>
                </div>
             )}
          </div>

          <div className="p-8 border-t border-white/5 bg-muted/20 flex flex-col sm:flex-row gap-4 justify-end">
            <Button variant="outline" className="h-14 px-10 rounded-2xl font-bold border-white/10" onClick={() => setSyncReport(null)}>Закрыть</Button>
            {syncReport?.unmatchedRows?.length > 0 && (
                <Button onClick={handleForceAdd} disabled={uploading} className="h-14 px-10 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-primary/20">
                   {uploading ? "Добавление..." : "Перенести всё в Платформу"}
                </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Card className="border-none shadow-2xl glass-card overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-muted/30 border-b border-white/5 p-10">
          <CardTitle className="text-2xl font-black tracking-tight">Синхронизация Яндекса</CardTitle>
          <CardDescription className="text-sm font-medium mt-2">
            Автоматический сбор данных из Яндекс.Метрики и Директа за выбранный период.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-10">
           <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 p-8 rounded-[2rem] bg-primary/5 border border-primary/10">
              <div className="space-y-2">
                 <p className="text-lg font-black tracking-tight">Ручной запуск</p>
                 <p className="text-[11px] font-medium text-muted-foreground max-w-md">Платформа сформирует задание на импорт данных через Logs API. Результаты появятся в ленте лидов.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
                 <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                 <Button onClick={handleManualSync} disabled={syncing} className="h-12 px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                    <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
                    {syncing ? "В очереди..." : "Запустить"}
                 </Button>
              </div>
           </div>
           
           <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] font-medium leading-relaxed text-amber-700/80">
                 <span className="font-black uppercase tracking-tight mr-1">Внимание:</span> 
                 Яндекс отдает полные данные (Logs API) только за вчера и ранее. Попытка синхронизации за сегодня может не вернуть новых лидов или данных по UTM.
              </p>
           </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t border-white/5 p-6 px-10 flex flex-col sm:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              <Clock className="h-4 w-4 text-primary/40" />
              <span>Расписание: 1 раз в 24 часа (ночью)</span>
           </div>
           <div className="flex items-center gap-2 px-4 py-2 bg-[#71D878]/10 text-[#71D878] rounded-full text-[9px] font-black uppercase tracking-widest">
                <CheckCircle2 className="h-3 w-3" />
                Система активна
           </div>
        </CardFooter>
      </Card>
      
      <Card className="border-none shadow-2xl glass-card overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-muted/30 border-b border-white/5 p-10">
          <CardTitle className="text-2xl font-black tracking-tight">Умная сверка архива CRM</CardTitle>
          <CardDescription className="text-sm font-medium mt-2">
            Загрузите Excel с колонкой Client ID. Мы автоматически сопоставим лиды и обновим их статусы.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-10 p-10">
           <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[2.5rem] p-16 bg-muted/10 hover:bg-muted/20 hover:border-primary/20 transition-all duration-500 relative group">
              <input 
                 type="file" 
                 accept=".xlsx,.xls,.csv" 
                 onChange={handleFileUpload}
                 className="absolute inset-0 opacity-0 cursor-pointer z-10"
                 ref={fileInputRef}
              />
              <div className="p-6 bg-white/5 rounded-3xl mb-6 shadow-sm border border-white/5 group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/10 transition-all duration-500">
                <FileSpreadsheet className="h-12 w-12 text-primary opacity-50 group-hover:opacity-100 transition-all" />
              </div>
              <p className="text-lg font-black tracking-tight">Кликните или перетащите архив</p>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mt-2 opacity-60">Поддерживаются .xlsx, .csv и .xls</p>
           </div>

           {fileData && headers.length > 0 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
                  <div className="p-8 rounded-[2rem] bg-white border border-white/10 shadow-xl space-y-8">
                      <div className="flex items-center justify-between">
                          <p className="text-[12px] font-black uppercase tracking-[0.2em] text-muted-foreground">1. Маппинг колонок</p>
                          <div className="px-4 py-2 bg-[#71D878]/10 text-[#71D878] rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                             <CheckCircle2 className="w-4 h-4" />
                             Найдено {fileData.length} строк
                          </div>
                      </div>
                      
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        <MappingSelect label="Client ID (_ym_uid)*" color="text-primary" value={colMapping.clientId} headers={headers} onChange={(val: string) => setColMapping({...colMapping, clientId: val})} />
                        <MappingSelect label="Дата (запасной)*" color="text-slate-600" value={colMapping.date} headers={headers} onChange={(val: string) => setColMapping({...colMapping, date: val})} />
                        <MappingSelect label="Текст Целевой" color="text-[#71D878]" value={colMapping.target} headers={headers} onChange={(val: string) => setColMapping({...colMapping, target: val})} />
                        <MappingSelect label="Текст Квал" color="text-amber-500" value={colMapping.qual} headers={headers} onChange={(val: string) => setColMapping({...colMapping, qual: val})} />
                        <MappingSelect label="Этап (Stage)" color="text-purple-600" value={colMapping.stage} headers={headers} onChange={(val: string) => setColMapping({...colMapping, stage: val})} />
                        <MappingSelect label="UTM Source" color="text-slate-400" value={colMapping.utmSource} headers={headers} onChange={(val: string) => setColMapping({...colMapping, utmSource: val})} />
                        <MappingSelect label="UTM Campaign" color="text-slate-400" value={colMapping.utmCampaign} headers={headers} onChange={(val: string) => setColMapping({...colMapping, utmCampaign: val})} />
                      </div>
                  </div>

                  {uniqueTargets.length > 0 && (
                      <MappingGroup title="2. Маппинг Целевых Статусов" color="primary" items={uniqueTargets} mapping={targetValMapping} setMapping={setTargetValMapping} statuses={internalStatuses.targets} icon={Plus} />
                  )}

                  {uniqueQuals.length > 0 && (
                      <MappingGroup title="3. Маппинг Квалификаций" color="amber" items={uniqueQuals} mapping={qualValMapping} setMapping={setQualValMapping} statuses={internalStatuses.quals} icon={CheckCircle2} />
                  )}

                  {uniqueStages.length > 0 && (
                      <MappingGroup title="4. Маппинг Этапов Сделки" color="purple" items={uniqueStages} mapping={stageValMapping} setMapping={setStageValMapping} statuses={internalStatuses.stages} icon={GitMerge} />
                  )}

                  <div className="pt-6 flex flex-col sm:flex-row justify-end gap-4">
                     <Button variant="ghost" className="h-14 px-10 rounded-2xl font-bold text-muted-foreground hover:bg-muted" onClick={() => { setFileData(null); setColMapping({ clientId: "", date: "", target: "", qual: "", stage: "", utmSource: "", utmCampaign: "" }); }}>Отмена</Button>
                     <Button className="h-14 px-12 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-primary/30" onClick={handleSmartImport} disabled={uploading || (!colMapping.clientId && !colMapping.date)}>
                        <GitMerge className="w-5 h-5 mr-3" />
                        {uploading ? "Сверка..." : "Запустить Сверку"}
                     </Button>
                  </div>
              </div>
           )}
        </CardContent>
        <CardFooter className="bg-muted/30 border-t border-white/5 p-8 px-10 flex gap-5">
           <div className="p-3 bg-emerald-500/10 rounded-2xl shrink-0">
             <AlertCircle className="h-6 w-6 text-emerald-500" />
           </div>
           <div className="space-y-1">
                <p className="text-[12px] font-black uppercase tracking-tight text-foreground/80 leading-none">Smart Import Algorithm v3</p>
                <p className="text-[11px] font-medium leading-relaxed text-muted-foreground opacity-70">
                    Приоритетный поиск по Client ID. Если статус в файле не найден в платформе, вы можете создать его на лету или пропустить.
                </p>
           </div>
        </CardFooter>
      </Card>
    </div>
  );
}

function MappingSelect({ label, color, value, headers, onChange }: any) {
    return (
        <div className="space-y-2.5">
            <label className={cn("text-[10px] uppercase font-black tracking-widest ml-1", color)}>{label}</label>
            <select 
                className="w-full h-12 text-[11px] font-black bg-white border border-slate-100 rounded-2xl px-4 focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer hover:border-primary/30 transition-all shadow-sm"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">(Пропустить)</option>
                {headers.map((h: string, i: number) => <option key={i} value={h}>{h}</option>)}
            </select>
        </div>
    );
}

function MappingGroup({ title, color, items, mapping, setMapping, statuses, icon: Icon }: any) {
    const bgColor = color === 'primary' ? 'bg-primary/5 border-primary/20' : 
                   color === 'amber' ? 'bg-amber-500/5 border-amber-500/20' : 
                   'bg-purple-600/5 border-purple-600/20';
    
    const labelColor = color === 'primary' ? 'text-primary' : 
                      color === 'amber' ? 'text-amber-600' : 
                      'text-purple-600';

    return (
        <div className={cn("p-8 rounded-[2.5rem] border shadow-sm space-y-6", bgColor)}>
            <div className="flex items-center gap-3 mb-2">
                <div className={cn("p-2 rounded-xl bg-white", labelColor)}>
                    <Icon className="w-4 h-4" />
                </div>
                <p className={cn("text-[12px] font-black uppercase tracking-[0.2em]", labelColor)}>{title}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((valStr: string) => {
                const currentMap = mapping[valStr] || 'auto';
                return (
                    <div key={valStr} className="flex flex-col gap-3 bg-white p-5 rounded-[1.5rem] border border-white/10 shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="font-black text-[12px] text-slate-800 break-all leading-tight">{valStr}</div>
                        <div className="flex items-center gap-3">
                            <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                            <select 
                                className="flex-1 h-10 text-[11px] font-black border border-slate-100 rounded-xl px-3 bg-slate-50/50"
                                value={currentMap}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setMapping((prev: any) => ({ ...prev, [valStr]: v === 'ignore' || v === 'auto' ? v : parseInt(v) }));
                                }}
                            >
                                <option value="auto">Создать автоматически</option>
                                <option value="ignore">Не изменять в CRM</option>
                                {statuses.map((s: any) => <option key={s.id} value={s.id}>{s.name || s.label}</option>)}
                            </select>
                        </div>
                    </div>
                );
                })}
            </div>
        </div>
    );
}
