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

interface SyncLog {
  id: number
  type: string
  status: string
  details: string
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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Логи синхронизации</h2>
        <p className="text-muted-foreground">История запусков и результаты работы воркеров.</p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Время</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Детали</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Логов пока нет.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs font-mono">
                    {new Date(log.startedAt).toLocaleString("ru-RU")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        log.status === "COMPLETED" || log.status === "SUCCESS" 
                          ? "default" 
                          : log.status === "FAILED" || log.status === "ERROR"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {log.status === "SUCCESS" || log.status === "COMPLETED" ? "Успех" : 
                       log.status === "ERROR" || log.status === "FAILED" ? "Ошибка" : 
                       log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-md truncate" title={log.details}>
                    {log.details}
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
