"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"
import { toast } from "sonner"

interface Project {
  id: number
  name: string
  slug: string
  isActive: boolean
}

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<Project | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setProject(data)
        setLoading(false)
      })
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return
    setSaving(true)

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          slug: project.slug,
          isActive: project.isActive,
        }),
      })

      if (res.ok) {
        toast.success("Проект обновлен")
        router.push("/admin/projects")
      } else {
        toast.error("Ошибка при обновлении")
      }
    } catch (error) {
      toast.error("Произошла ошибка")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Загрузка...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/projects">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Редактирование проекта</h2>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Общая информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название проекта</Label>
              <Input
                id="name"
                value={project?.name}
                onChange={(e) => setProject({ ...project!, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (ссылка)</Label>
              <Input
                id="slug"
                value={project?.slug}
                onChange={(e) => setProject({ ...project!, slug: e.target.value })}
                required
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={project?.isActive}
                onChange={(e) => setProject({ ...project!, isActive: e.target.checked })}
              />
              <Label htmlFor="active">Активный проект</Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-4 border-t px-6 py-4">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="border-destructive/20 bg-destructive/5">
         <CardHeader>
            <CardTitle className="text-destructive">Интеграции</CardTitle>
         </CardHeader>
         <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
               Настройки Яндекса, CRM и расписания находятся в отдельном разделе.
            </p>
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" asChild>
               <Link href={`/admin/projects/${id}/settings`}>
                  Перейти к настройкам проекта
               </Link>
            </Button>
         </CardContent>
      </Card>
    </div>
  )
}
