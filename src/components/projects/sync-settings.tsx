"use client"

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Clock, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Calendar as CalendarIcon, GitMerge } from "lucide-react";
import * as XLSX from "xlsx";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
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
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (json.length > 0) {
        setHeaders(json[0] as string[]);
        setFileData(json.slice(1));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const [colMapping, setColMapping] = useState({ date: "", status: "", campaign: "" });
  const [uniqueStatuses, setUniqueStatuses] = useState<string[]>([]);
  const [statusValMapping, setStatusValMapping] = useState<Record<string, { type: "target" | "qual" | "stage" | "ignore", id?: number }>>({});

  useEffect(() => {
     if (colMapping.status && fileData) {
         const statuses = Array.from(new Set(fileData.map(row => row[colMapping.status]))).filter(Boolean) as string[];
         setUniqueStatuses(statuses);
         const initMap: any = {};
         statuses.forEach(s => initMap[s] = { type: 'ignore' });
         setStatusValMapping(initMap);
     }
  }, [colMapping.status, fileData]);

  const handleSmartImport = async () => {
     if (!colMapping.date || !colMapping.status) {
        toast.error("Выберите колонки для Даты и Статуса");
        return;
     }

     setUploading(true);
     // Преобразовываем данные так, чтобы API получал стандартизированные ключи: date, campaign, status
     const rows = fileData?.map(r => ({
       date: r[colMapping.date],
       campaign: colMapping.campaign ? r[colMapping.campaign] : null,
       status: r[colMapping.status]
     })) || [];

     try {
        const res = await fetch(`/api/leads/merge-archive`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ 
              projectId,
              rows,
              statusMapping: statusValMapping
           })
        });

        if (res.ok) {
           const result = await res.json();
           toast.success(`Сверка выполнена: ${result.updated} обновлено, ${result.skipped} пропущено`);
           setFileData(null);
           setColMapping({ date: "", status: "", campaign: "" });
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
            Загрузите Excel или CSV выгрузку из CRM. Алгоритм жестко сопоставит лидов с данными Яндекс Метрики по времени, без создания дублей.
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
                     <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">1. Маппинг колонок (Чтение)</p>
                     <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                           <label className="text-[10px] uppercase font-bold text-muted-foreground">Дата и время *</label>
                           <select 
                              className="w-full h-8 text-xs border rounded px-2"
                              value={colMapping.date}
                              onChange={(e) => setColMapping({...colMapping, date: e.target.value})}
                           >
                              <option value="">Выберите колонку</option>
                              {headers.map(h => <option key={h} value={h}>{h}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] uppercase font-bold text-muted-foreground">Статус CRM *</label>
                           <select 
                              className="w-full h-8 text-xs border rounded px-2"
                              value={colMapping.status}
                              onChange={(e) => setColMapping({...colMapping, status: e.target.value})}
                           >
                              <option value="">Выберите колонку</option>
                              {headers.map(h => <option key={h} value={h}>{h}</option>)}
                           </select>
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] uppercase font-bold text-muted-foreground">UTM Кампания (опц.)</label>
                           <select 
                              className="w-full h-8 text-xs border rounded px-2"
                              value={colMapping.campaign}
                              onChange={(e) => setColMapping({...colMapping, campaign: e.target.value})}
                           >
                              <option value="">Выберите колонку</option>
                              {headers.map(h => <option key={h} value={h}>{h}</option>)}
                           </select>
                        </div>
                     </div>
                 </div>

                 {uniqueStatuses.length > 0 && (
                     <div className="p-4 border rounded-lg bg-blue-50/50 space-y-4">
                         <p className="text-xs font-bold uppercase tracking-wider text-blue-800">2. Настройка статусов</p>
                         <p className="text-xs text-blue-600/80 mb-2">Найдено {uniqueStatuses.length} уникальных статусов в вашем файле. Назначьте им роль в платформе.</p>
                         
                         <div className="space-y-3">
                             {uniqueStatuses.map(statusStr => {
                                const currentMap = statusValMapping[statusStr] || { type: 'ignore' };
                                const selectVal = currentMap.type === 'ignore' ? 'ignore' : `${currentMap.type}_${currentMap.id}`;
                                return (
                                 <div key={statusStr} className="flex items-center gap-4 bg-white p-2 px-3 rounded-md border shadow-sm">
                                     <div className="flex-1 font-medium text-sm text-neutral-800 break-all">{statusStr}</div>
                                     <div className="flex-shrink-0 text-muted-foreground text-xs font-semibold mr-2">➔</div>
                                     <select 
                                         className="w-[240px] h-8 text-xs border rounded px-2 bg-neutral-50"
                                         value={selectVal}
                                         onChange={(e) => {
                                             const v = e.target.value;
                                             if (v === 'ignore') {
                                                setStatusValMapping(prev => ({ ...prev, [statusStr]: { type: 'ignore' } }));
                                             } else {
                                                const [t, idStr] = v.split('_');
                                                setStatusValMapping(prev => ({ ...prev, [statusStr]: { type: t as any, id: parseInt(idStr) } }));
                                             }
                                         }}
                                     >
                                         <option value="ignore">Пропустить (Не учитывать)</option>
                                         <optgroup label="Целевые действия">
                                             {internalStatuses.targets.map(t => <option key={`target_${t.id}`} value={`target_${t.id}`}>[Целевой] {t.label}</option>)}
                                         </optgroup>
                                         <optgroup label="Квалификация">
                                             {internalStatuses.quals.map(q => <option key={`qual_${q.id}`} value={`qual_${q.id}`}>[Квал] {q.label}</option>)}
                                         </optgroup>
                                         <optgroup label="Этапы лида">
                                             {internalStatuses.stages.map(s => <option key={`stage_${s.id}`} value={`stage_${s.id}`}>[Этап] {s.name}</option>)}
                                         </optgroup>
                                     </select>
                                 </div>
                                );
                             })}
                         </div>
                     </div>
                 )}

                 <div className="pt-2 flex justify-end gap-3 text-xs">
                    <Button variant="outline" size="sm" onClick={() => { setFileData(null); setColMapping({ date: "", status: "", campaign: "" }); }}>Отмена</Button>
                    <Button size="sm" onClick={handleSmartImport} disabled={uploading || !colMapping.date || !colMapping.status} className="bg-blue-600 hover:bg-blue-700 text-white">
                       <GitMerge className="w-4 h-4 mr-2" />
                       {uploading ? "Сверка..." : "Выполнить Умную Сверку"}
                    </Button>
                 </div>
              </div>
           )}
        </CardContent>
        <CardFooter className="bg-muted/10 flex gap-2">
           <AlertCircle className="h-4 w-4 text-amber-500" />
           <p className="text-[10px] leading-relaxed text-muted-foreground">
              Smart Sync использует 3-х уровневую систему сверки (до секунды, в окне 10 минут, и один лид за день).
              Отсутствующие лиды будут проигнорированы.
           </p>
        </CardFooter>
      </Card>
    </div>
  );
}
