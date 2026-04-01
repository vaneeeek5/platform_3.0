"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface SyncLog {
  id: number
  type: string
  status: string
  error: string | null
  recordsProcessed: number
  recordsCreated: number
  recordsUpdated: number
  startedAt: string
}

export default function LogsPage() {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/logs")
      const data = await res.json()
      setLogs(data)
    } catch (error) {
      toast.error("Не удалось загрузить логи")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
          Логи синхронизации
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">История запусков и результаты работы воркеров.</p>
      </div>
{/* TODO: next replace */}
      <div className="glass-card border-none overflow-hidden shadow-2xl rounded-[2.5rem]">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-6">Время</TableHead>
              <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Тип</TableHead>
              <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Статус</TableHead>
              <TableHead className="h-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Детали</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i} className="border-white/5 h-16">
                  <TableCell className="px-6"><Skeleton className="h-4 w-32 rounded-lg" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 rounded-lg" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-64 rounded-lg" /></TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground font-medium italic">
                  Логов пока нет.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="border-white/5 h-16 hover:bg-white/5 transition-colors group">
                  <TableCell className="px-6 text-[11px] font-mono font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                    {new Date(log.startedAt).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-xl border-primary/20 text-primary font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5">
                        {log.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={cn(
                        "rounded-full font-black uppercase text-[9px] tracking-widest px-3 py-1",
                        (log.status === "COMPLETED" || log.status === "SUCCESS")
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : (log.status === "FAILED" || log.status === "ERROR")
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-primary/10 text-primary border-primary/20"
                      )}
                    >
                      {log.status === "SUCCESS" || log.status === "COMPLETED" ? "Успех" : 
                       log.status === "ERROR" || log.status === "FAILED" ? "Ошибка" : 
                       log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-bold text-foreground/80 max-w-md">
                    <div className="truncate" title={log.error || ''}>
                        {log.error ? (
                        <span className="text-destructive">{log.error}</span>
                        ) : (
                        <div className="flex gap-4">
                            {log.recordsProcessed > 0 && <span className="flex items-center gap-1.5 opacity-60"><div className="w-1 h-1 bg-foreground rounded-full" /> {log.recordsProcessed}</span>}
                            {log.recordsCreated > 0 && <span className="flex items-center gap-1.5 text-green-500"><div className="w-1 h-1 bg-green-500 rounded-full" /> {log.recordsCreated}</span>}
                            {log.recordsUpdated > 0 && <span className="flex items-center gap-1.5 text-blue-500"><div className="w-1 h-1 bg-blue-500 rounded-full" /> {log.recordsUpdated}</span>}
                            {!log.recordsProcessed && !log.recordsCreated && !log.recordsUpdated && <span className="opacity-30">—</span>}
                        </div>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
