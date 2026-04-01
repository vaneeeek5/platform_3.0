"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, Edit, Trash2, Settings, Briefcase, Calendar, CheckCircle2, PauseCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Project {
  id: number
  name: string
  slug: string
  isActive: boolean
  createdAt: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects")
      const data = await res.json()
      setProjects(data)
    } catch (error) {
      toast.error("Не удалось загрузить список проектов")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Вы уверены, что хотите удалить этот проект?")) return

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Проект удален")
        fetchProjects()
      } else {
        toast.error("Ошибка при удалении проекта")
      }
    } catch (error) {
      toast.error("Произошла ошибка")
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-4 mb-2">
              <div className="p-3 glass-card rounded-2xl shadow-xl border-none">
                <Briefcase className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                Проекты
              </h1>
           </div>
           <p className="text-muted-foreground/60 font-black uppercase tracking-[0.2em] text-[10px] pl-1">Управление маркетинговыми площадками</p>
        </div>
        
        <Button asChild size="lg" className="h-14 px-8 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20">
          <Link href="/admin/projects/new">
            <Plus className="mr-3 h-5 w-5" /> Новый проект
          </Link>
        </Button>
      </div>

      <div className="glass-card border-none shadow-2xl rounded-[2rem] overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-white/5 hover:bg-transparent h-16">
              <TableHead className="text-[10px] font-black uppercase tracking-widest pl-8">Название</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Slug</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Статус</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Создан</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest pr-8">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-white/5 h-20">
                  <TableCell className="pl-8"><Skeleton className="h-6 w-48 rounded-lg" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 rounded-lg" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 rounded-lg" /></TableCell>
                  <TableCell className="text-right pr-8"><Skeleton className="h-10 w-32 ml-auto rounded-xl" /></TableCell>
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-60 text-center text-muted-foreground italic uppercase text-[10px] font-black tracking-widest">
                  Проектов пока нет. Создайте первый проект!
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id} className="border-white/5 hover:bg-primary/5 transition-all h-20 group">
                  <TableCell className="pl-8">
                     <div className="flex items-center gap-3">
                        <div className="w-1.5 h-10 bg-primary/20 rounded-full group-hover:bg-primary transition-all" />
                        <span className="font-black text-lg tracking-tight">{project.name}</span>
                     </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-black text-[10px] uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 text-muted-foreground">
                      {project.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                        project.isActive 
                            ? "bg-[#71D878]/10 text-[#71D878] border border-[#71D878]/10" 
                            : "bg-muted text-muted-foreground border border-white/5 shadow-inner"
                    )}>
                      {project.isActive ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Активен
                          </>
                      ) : (
                          <>
                            <PauseCircle className="w-3.5 h-3.5" />
                            Пауза
                          </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center gap-2 text-muted-foreground/60 text-xs font-bold">
                        <Calendar className="w-4 h-4 opacity-40" />
                        {new Date(project.createdAt).toLocaleDateString("ru-RU")}
                     </div>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2 opacity-40 group-hover:opacity-100 transition-all">
                        <Button variant="ghost" size="icon" asChild title="Настройки" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary">
                        <Link href={`/admin/projects/${project.id}/settings`}>
                            <Settings className="h-4 w-4" />
                        </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild title="Редактировать" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
                        <Link href={`/admin/projects/${project.id}`}>
                            <Edit className="h-4 w-4" />
                        </Link>
                        </Button>
                        <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                        onClick={() => handleDelete(project.id)}
                        title="Удалить"
                        >
                        <Trash2 className="h-4 w-4" />
                        </Button>
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
