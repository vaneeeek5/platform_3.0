"use client"

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Clock, FileSpreadsheet, CheckCircle2, AlertCircle, GitMerge } from "lucide-react";
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

  const [colMapping, setColMapping] = useState({ 
     clientId: "", 
     date: "", 
     target: "", 
     qual: "", 
     stage: "" 
  });

  const handleSmartImport = async () => {
     if (!colMapping.clientId && !colMapping.date) {
        toast.error("Для сверки необходимо выбрать хотя бы колонку Client ID или Дату");
        return;
     }

     setUploading(true);
     const rows = fileData?.map(r => ({
       clientId: colMapping.clientId ? r[headers.indexOf(colMapping.clientId)] : null,
       date: colMapping.date ? r[headers.indexOf(colMapping.date)] : null,
       target: colMapping.target ? String(r[headers.indexOf(colMapping.target)] || "").toLowerCase().includes("да") : false,
       qual: colMapping.qual ? String(r[headers.indexOf(colMapping.qual)] || "").toLowerCase().includes("да") : false,
       stage: colMapping.stage ? String(r[headers.indexOf(colMapping.stage)] || "").toLowerCase().includes("да") : false,
     })) || [];

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
           toast.success(`Сверка выполнена: ${result.updated} обновлено, ${result.skipped} пропущено`);
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
                           <label className="text-[10px] uppercase font-bold text-green-700">Флаг "Целевой"</label>
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
                           <label className="text-[10px] uppercase font-bold text-amber-700">Флаг "Квал"</label>
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
                           <label className="text-[10px] uppercase font-bold text-purple-700">Флаг "Продажа"</label>
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
              Алгоритм v2: Поиск выполняется по 100% совпадению Client ID.
              Если в выбранной колонке для флага находится слово «ДА» — системе будет передан сигнал об изменении статуса.
           </p>
        </CardFooter>
      </Card>
    </div>
  );
}
