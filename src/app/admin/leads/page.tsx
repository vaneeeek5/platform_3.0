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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
        try {
            const [meRes, projRes] = await Promise.all([
                fetch("/api/admin/me").then(r => r.json()),
                fetch("/api/projects").then(r => r.json())
            ]);
            
            setUser(meRes);
            const isSuper = meRes.role === "SUPER_ADMIN";
            
            // Filter projects where canViewLeads is true
            const allowedProjects = projRes.filter((p: any) => {
                if (isSuper) return true;
                const link = meRes.links?.find((l: any) => l.projectId === p.id);
                return link?.canViewLeads;
            });
            
            setProjects(allowedProjects);
            
            if (!isSuper && allowedProjects.length > 0) {
                setSelectedProjectId(allowedProjects[0].id.toString());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    init();
  }, []);

  if (loading) return <div className="p-10 text-center text-muted-foreground animate-pulse">Загрузка лидов...</div>;

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
                 {user?.role === "SUPER_ADMIN" && <SelectItem value="all">Все проекты</SelectItem>}
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
