"use client"

import { useState, useEffect } from "react"
import { LeadsList } from "@/components/leads/leads-list"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function GlobalLeadsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all")

  useEffect(() => {
    fetch("/api/projects").then(res => res.json()).then(setProjects)
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Все Лиды</h1>
          <p className="text-muted-foreground">Общий список заявок по всем проектам.</p>
        </div>
        <div className="w-64">
           <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                 <SelectValue placeholder="Все проекты" />
              </SelectTrigger>
              <SelectContent>
                 <SelectItem value="all">Все проекты</SelectItem>
                 {projects.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                 ))}
              </SelectContent>
           </Select>
        </div>
      </div>

      <Card>
         <CardContent className="pt-6">
            <LeadsList 
               projectId={selectedProjectId === "all" ? 0 : parseInt(selectedProjectId)} 
               showProjectColumn={selectedProjectId === "all"}
            />
         </CardContent>
      </Card>
    </div>
  )
}
