"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { toast } from "sonner"
import { Upload, CheckCircle2, AlertTriangle, FileText, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"

export function CrmArchiveImport() {
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [mapping, setMapping] = useState({
    date: "",
    campaign: "",
    status: ""
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    fetch("/api/projects").then(res => res.json()).then(setProjects)
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const bstr = evt.target?.result
      const wb = XLSX.read(bstr, { type: 'binary' })
      const wsname = wb.SheetNames[0]
      const ws = wb.Sheets[wsname]
      const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 })
      
      if (jsonData.length > 0) {
        setHeaders(jsonData[0] as string[])
        setData(XLSX.utils.sheet_to_json(ws))
      }
    }
    reader.readAsBinaryString(f)
  }

  const handleImport = async () => {
    if (!selectedProjectId || !mapping.date || !mapping.status) {
      toast.error("Пожалуйста, выберите проект и настройте обязательные поля (Дата и Статус)")
      return
    }

    setLoading(true)
    setResult(null)

    const rows = data.map(row => ({
      date: row[mapping.date],
      campaign: mapping.campaign ? row[mapping.campaign] : null,
      status: row[mapping.status]
    }))

    try {
      const res = await fetch("/api/leads/merge-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: parseInt(selectedProjectId), rows })
      })

      if (res.ok) {
        const stats = await res.json()
        setResult(stats)
        toast.success("Сверка завершена!")
      } else {
        toast.error("Ошибка при выполнении сверки")
      }
    } catch (e) {
      toast.error("Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="shadow-sm border-neutral-200">
      <CardHeader className="bg-neutral-50/50">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
                <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
                <CardTitle className="text-lg">Умная сверка архива CRM</CardTitle>
                <CardDescription>Загрузите Excel-файл для обновления статусов через Smart Sync.</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label>Проект для импорта</Label>
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

            <div className="space-y-2">
                <Label>Файл (Excel/CSV)</Label>
                <div className="flex gap-2">
                    <Input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="cursor-pointer" />
                </div>
            </div>
        </div>

        {headers.length > 0 && (
            <div className="p-4 bg-muted/30 rounded-lg border border-dashed border-neutral-300 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Маппинг колонок</p>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase">Колонка Даты *</Label>
                        <Select value={mapping.date} onValueChange={(v) => setMapping(m => ({ ...m, date: v }))}>
                            <SelectTrigger><SelectValue placeholder="Дата" /></SelectTrigger>
                            <SelectContent>
                                {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase">Колонка Кампании (Опц)</Label>
                        <Select value={mapping.campaign} onValueChange={(v) => setMapping(m => ({ ...m, campaign: v }))}>
                            <SelectTrigger><SelectValue placeholder="Кампания" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Не использовать</SelectItem>
                                {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase">Колонка Статуса *</Label>
                        <Select value={mapping.status} onValueChange={(v) => setMapping(m => ({ ...m, status: v }))}>
                            <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
                            <SelectContent>
                                {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        )}

        {result && (
            <div className="p-4 rounded-lg bg-green-50/50 border border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                    <div>
                        <p className="text-sm font-bold text-green-800">Сверка выполнена успешно!</p>
                        <p className="text-xs text-green-600">
                            Обновлено: {result.updated} лидов. Пропущено: {result.skipped} (не найдены или нет маппинга).
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setResult(null)}>Закрыть</Button>
            </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setFile(null); setHeaders([]); setData([]); setResult(null); }}>
                Сбросить
            </Button>
            <Button onClick={handleImport} disabled={loading || !file || !selectedProjectId} className="min-w-[150px]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Loader2 className="h-4 w-4 mr-2" />}
                {loading ? "Сверяем..." : "Начать импорт"}
            </Button>
        </div>
      </CardContent>
    </Card>
  )
}
