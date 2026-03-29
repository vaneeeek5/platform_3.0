"use client"

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Clock, FileSpreadsheet, CheckCircle2, AlertCircle, GitMerge } from "lucide-react";
import * as XLSX from "xlsx";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";

export function SyncSettings({ projectId }: { projectId: number }) {
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [fileData, setFileData] = useState<any[] | null>(null);
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
     stage: "" 
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
         targetRaw: rawTarget,
         targetMap: mappedTarget,
         qualRaw: rawQual,
         qualMap: mappedQual,
         stageRaw: rawStage,
         stageMap: mappedStage,
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
           setColMapping({ clientId: "", date: "", target: "", qual: "", stage: "" });
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

  return (
    <div className="space-y-6">
      
      <Dialog open={!!syncReport} onOpenChange={(open) => !open && setSyncReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Отчет о результатах сверки</DialogTitle>
            <DialogDescription>
              Обработано строк из вашего файла: {syncReport?.totalRows || 0}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 flex-1 min-h-0">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                   <p className="text-sm font-semibold text-green-800 mb-1">Успешно сопоставлено</p>
                   <p className="text-2xl font-bold text-green-700">{syncReport?.updated || 0}</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                   <p className="text-sm font-semibold text-amber-800 mb-1">Пропущено (Не найдено)</p>
                   <p className="text-2xl font-bold text-amber-700">{syncReport?.skippedRows || syncReport?.skipped || 0}</p>
                </div>
             </div>
             
             {syncReport?.unmatchedRows && syncReport.unmatchedRows.length > 0 && (
                <div className="flex flex-col min-h-0 border rounded-md shadow-sm">
                   <div className="bg-muted px-4 py-2 font-medium text-sm text-foreground border-b">
                      Список лидов, которые не удалось найти в Платформе:
                   </div>
                   <div className="overflow-auto max-h-[300px]">
                      <Table>
                         <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                            <TableRow>
                               <TableHead>Client ID (_ym_uid)</TableHead>
                               <TableHead>Дата в файле</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {syncReport.unmatchedRows.map((r: any, i: number) => (
                               <TableRow key={i}>
                                  <TableCell className="font-mono text-xs">{r.clientId || '—'}</TableCell>
                                  <TableCell className="text-xs">{r.date || '—'}</TableCell>
                               </TableRow>
                            ))}
                         </TableBody>
                      </Table>
                   </div>
                </div>
             )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSyncReport(null)}>Закрыть окно</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card>
        <CardHeader>
          <CardTitle>Синхронизация данных Яндекса</CardTitle>
          <CardDescription>
            Автоматический сбор данных из Яндекс.Метрики и Директа.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1">
                 <p className="text-sm font-medium">Ручной запуск</p>
                 <p className="text-xs text-muted-foreground">Запустить немедленное обновление данных за выбранный период.</p>
              </div>
              <div className="flex items-center gap-2">
                 <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                 <Button onClick={handleManualSync} disabled={syncing} size="sm">
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? "Запуск..." : "Запустить"}
                 </Button>
              </div>
           </div>
           <p className="text-[10px] text-muted-foreground mt-2 bg-muted p-2 rounded italic">
              * Внимание: Яндекс отдает полные данные (Logs API) только за вчера и ранее. Попытка синхронизации за сегодня может не вернуть новых лидов.
           </p>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-between items-center text-xs text-muted-foreground">
           <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Последняя синхронизация: по расписанию раз в сутки</span>
           </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Умная сверка архива CRM</CardTitle>
          <CardDescription>
            Загрузите Excel/CSV с колонкой _ym_uid. Лиды будут мгновенно сопоставлены, а статусы обновлены на основе ячеек "ДА"/"НЕТ".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 bg-muted/20 hover:bg-muted/30 transition-colors relative">
              <input 
                 type="file" 
                 accept=".xlsx,.xls,.csv" 
                 onChange={handleFileUpload}
                 className="absolute inset-0 opacity-0 cursor-pointer"
                 ref={fileInputRef}
              />
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Кликните или перетащите архив сюда</p>
              <p className="text-xs text-muted-foreground mt-1">Поддерживаются .xlsx, .csv</p>
           </div>

           {fileData && headers.length > 0 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                 <div className="p-4 border rounded-lg bg-background space-y-4">
                     <div className="flex items-center justify-between">
                         <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Маппинг колонок</p>
                         <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            Найдено {fileData.length} строк
                         </p>
                     </div>
                     
                     <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 bg-neutral-50 p-4 rounded-md border">
                        <div className="space-y-1.5">
                           <label className="text-[10px] uppercase font-bold text-blue-700">Client ID (_ym_uid)*</label>
                           <select 
                              className="w-full h-8 text-xs border rounded px-2"
                              value={colMapping.clientId}
                              onChange={(e) => setColMapping({...colMapping, clientId: e.target.value})}
                           >
                              <option value="">(Не выбрано)</option>
                              {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] uppercase font-bold text-neutral-700">Дата (запасной)*</label>
                           <select 
                              className="w-full h-8 text-xs border rounded px-2"
                              value={colMapping.date}
                              onChange={(e) => setColMapping({...colMapping, date: e.target.value})}
                           >
                              <option value="">(Не выбрано)</option>
                              {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] uppercase font-bold text-green-700">Текст Целевой</label>
                           <select 
                              className="w-full h-8 text-xs border rounded px-2"
                              value={colMapping.target}
                              onChange={(e) => setColMapping({...colMapping, target: e.target.value})}
                           >
                              <option value="">(Не выбрано)</option>
                              {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] uppercase font-bold text-amber-700">Текст Квал</label>
                           <select 
                              className="w-full h-8 text-xs border rounded px-2"
                              value={colMapping.qual}
                              onChange={(e) => setColMapping({...colMapping, qual: e.target.value})}
                           >
                              <option value="">(Не выбрано)</option>
                              {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] uppercase font-bold text-purple-700">Текст Этапа (Stage)</label>
                           <select 
                              className="w-full h-8 text-xs border rounded px-2"
                              value={colMapping.stage}
                              onChange={(e) => setColMapping({...colMapping, stage: e.target.value})}
                           >
                              <option value="">(Не выбрано)</option>
                              {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                           </select>
                        </div>
                     </div>
                 </div>

                 {uniqueTargets.length > 0 && (
                     <div className="p-4 border rounded-lg bg-green-50/50 space-y-4">
                         <p className="text-xs font-bold uppercase tracking-wider text-green-800">Маппинг Целевых Статусов</p>
                         <div className="space-y-3">
                             {uniqueTargets.map(valStr => {
                                const currentMap = targetValMapping[valStr] || 'auto';
                                return (
                                 <div key={valStr} className="flex items-center gap-4 bg-white p-2 px-3 rounded-md border shadow-sm">
                                     <div className="flex-1 font-medium text-sm text-neutral-800 break-all">{valStr}</div>
                                     <div className="flex-shrink-0 text-muted-foreground text-xs font-semibold mr-2">➔</div>
                                     <select 
                                         className="w-[280px] h-8 text-xs border rounded px-2 bg-neutral-50"
                                         value={currentMap}
                                         onChange={(e) => {
                                             const v = e.target.value;
                                             setTargetValMapping(prev => ({ ...prev, [valStr]: v === 'ignore' || v === 'auto' ? v : parseInt(v) }));
                                         }}
                                     >
                                         <option value="auto">Создать статус автоматически</option>
                                         <option value="ignore">Пропустить (Не изменять)</option>
                                         {internalStatuses.targets.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                     </select>
                                 </div>
                                );
                             })}
                         </div>
                     </div>
                 )}

                 {uniqueQuals.length > 0 && (
                     <div className="p-4 border rounded-lg bg-amber-50/50 space-y-4">
                         <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Маппинг Квалификаций</p>
                         <div className="space-y-3">
                             {uniqueQuals.map(valStr => {
                                const currentMap = qualValMapping[valStr] || 'auto';
                                return (
                                 <div key={valStr} className="flex items-center gap-4 bg-white p-2 px-3 rounded-md border shadow-sm">
                                     <div className="flex-1 font-medium text-sm text-neutral-800 break-all">{valStr}</div>
                                     <div className="flex-shrink-0 text-muted-foreground text-xs font-semibold mr-2">➔</div>
                                     <select 
                                         className="w-[280px] h-8 text-xs border rounded px-2 bg-neutral-50"
                                         value={currentMap}
                                         onChange={(e) => {
                                             const v = e.target.value;
                                             setQualValMapping(prev => ({ ...prev, [valStr]: v === 'ignore' || v === 'auto' ? v : parseInt(v) }));
                                         }}
                                     >
                                         <option value="auto">Создать статус автоматически</option>
                                         <option value="ignore">Пропустить (Не изменять)</option>
                                         {internalStatuses.quals.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                     </select>
                                 </div>
                                );
                             })}
                         </div>
                     </div>
                 )}

                 {uniqueStages.length > 0 && (
                     <div className="p-4 border rounded-lg bg-purple-50/50 space-y-4">
                         <p className="text-xs font-bold uppercase tracking-wider text-purple-800">Маппинг Этапов Сделки</p>
                         <div className="space-y-3">
                             {uniqueStages.map(stageStr => {
                                const currentMap = stageValMapping[stageStr] || 'auto';
                                return (
                                 <div key={stageStr} className="flex items-center gap-4 bg-white p-2 px-3 rounded-md border shadow-sm">
                                     <div className="flex-1 font-medium text-sm text-neutral-800 break-all">{stageStr}</div>
                                     <div className="flex-shrink-0 text-muted-foreground text-xs font-semibold mr-2">➔</div>
                                     <select 
                                         className="w-[280px] h-8 text-xs border rounded px-2 bg-neutral-50"
                                         value={currentMap}
                                         onChange={(e) => {
                                             const v = e.target.value;
                                             setStageValMapping(prev => ({ ...prev, [stageStr]: v === 'ignore' || v === 'auto' ? v : parseInt(v) }));
                                         }}
                                     >
                                         <option value="auto">Создать этап автоматически</option>
                                         <option value="ignore">Пропустить (Не изменять)</option>
                                         {internalStatuses.stages.map((s: any) => <option key={s.id} value={s.id}>{s.name || s.label}</option>)}
                                     </select>
                                 </div>
                                );
                             })}
                         </div>
                     </div>
                 )}

                 <div className="pt-2 flex justify-end gap-3 text-xs">
                    <Button variant="outline" size="sm" onClick={() => { setFileData(null); setColMapping({ clientId: "", date: "", target: "", qual: "", stage: "" }); }}>Отмена</Button>
                    <Button size="sm" onClick={handleSmartImport} disabled={uploading || (!colMapping.clientId && !colMapping.date)} className="bg-blue-600 hover:bg-blue-700 text-white">
                       <GitMerge className="w-4 h-4 mr-2" />
                       {uploading ? "Сверка..." : "Запустить Сверку"}
                    </Button>
                 </div>
              </div>
           )}
        </CardContent>
        <CardFooter className="bg-muted/10 flex gap-2">
           <AlertCircle className="h-4 w-4 text-emerald-600" />
           <p className="text-[10px] leading-relaxed text-muted-foreground">
              Алгоритм v3: Поиск выполняется по 100% совпадению Client ID.
              Статусы могут создаваться автоматически на основе текста напрямую из CRM файлов.
           </p>
        </CardFooter>
      </Card>
    </div>
  );
}
