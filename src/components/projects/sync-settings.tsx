"use client"

import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, Clock, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays } from "date-fns";

export function SyncSettings({ projectId }: { projectId: number }) {
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 2),
    to: subDays(new Date(), 1)
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
           dateFrom: dateRange.from.toISOString(),
           dateTo: dateRange.to.toISOString()
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

  const [mapping, setMapping] = useState({
     clientId: "",
     status: "",
     amount: "",
     date: ""
  });

  const handleImport = async () => {
     if (!mapping.clientId || !mapping.status) {
        toast.error("Выберите как минимум колонки для Client ID и Статуса");
        return;
     }

     setUploading(true);
     try {
        const res = await fetch(`/api/projects/${projectId}/crm/import`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ 
              data: fileData, 
              mapping,
              headers 
           })
        });

        if (res.ok) {
           const result = await res.json();
           toast.success(`Импорт завершен: ${result.updated} обновлено, ${result.created} создано`);
           setFileData(null);
           if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
           toast.error("Ошибка при импорте");
        }
     } catch (e) {
        toast.error("Произошла ошибка при отправке данных");
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
          <CardTitle>Импорт данных из CRM (Manual)</CardTitle>
          <CardDescription>
            Загрузите Excel или CSV файл с данными из вашей CRM системы.
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
              <Upload className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium">Кликните или перетащите файл сюда</p>
              <p className="text-xs text-muted-foreground mt-1">Поддерживаются .xlsx, .csv</p>
           </div>

           {fileData && (
              <div className="space-y-4 p-4 border rounded-lg bg-background animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <p className="text-sm font-semibold">Файл прочитан: {fileData.length} строк</p>
                 </div>
                 
                 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-muted-foreground">Client ID / ID</label>
                       <select 
                          className="w-full h-8 text-xs border rounded px-2"
                          value={mapping.clientId}
                          onChange={(e) => setMapping({...mapping, clientId: e.target.value})}
                       >
                          <option value="">Выберите колонку</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-muted-foreground">Статус</label>
                       <select 
                          className="w-full h-8 text-xs border rounded px-2"
                          value={mapping.status}
                          onChange={(e) => setMapping({...mapping, status: e.target.value})}
                       >
                          <option value="">Выберите колонку</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-muted-foreground">Сумма (опц.)</label>
                       <select 
                          className="w-full h-8 text-xs border rounded px-2"
                          value={mapping.amount}
                          onChange={(e) => setMapping({...mapping, amount: e.target.value})}
                       >
                          <option value="">Выберите колонку</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] uppercase font-bold text-muted-foreground">Дата (опц.)</label>
                       <select 
                          className="w-full h-8 text-xs border rounded px-2"
                          value={mapping.date}
                          onChange={(e) => setMapping({...mapping, date: e.target.value})}
                       >
                          <option value="">Выберите колонку</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                       </select>
                    </div>
                 </div>

                 <div className="pt-4 flex justify-end gap-2 text-xs">
                    <Button variant="ghost" size="sm" onClick={() => setFileData(null)}>Отмена</Button>
                    <Button size="sm" onClick={handleImport} disabled={uploading}>
                       {uploading ? "Загрузка..." : "Начать импорт"}
                    </Button>
                 </div>
              </div>
           )}
        </CardContent>
        <CardFooter className="bg-muted/10 flex gap-2">
           <AlertCircle className="h-4 w-4 text-amber-500" />
           <p className="text-[10px] leading-relaxed text-muted-foreground">
              Совет: Для точности данных убедитесь, что в файле есть колонка с Client ID (из Яндекс.Метрики) 
              или хотя бы уникальным ID заявки.
           </p>
        </CardFooter>
      </Card>
    </div>
  );
}
