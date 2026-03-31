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

  if (loading) return (
    <div className="p-10 flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Загрузка лидов...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
            Все Лиды
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Общий список заявок по всем проектам.</p>
        </div>
        
        <div className="w-full md:w-72">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 ml-1">Фильтр по проекту</div>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="glass-card h-12 border-white/10 shadow-lg">
                    <SelectValue placeholder="Все проекты" />
                </SelectTrigger>
                <SelectContent className="glass-card border-white/10">
                    {user?.role === "SUPER_ADMIN" && <SelectItem value="all">Все проекты</SelectItem>}
                    {projects.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      <Card className="border-none p-0 overflow-hidden shadow-2xl">
         <CardContent className="p-0">
            <LeadsList 
               projectId={selectedProjectId === "all" ? 0 : parseInt(selectedProjectId)} 
               showProjectColumn={selectedProjectId === "all"}
            />
         </CardContent>
      </Card>
    </div>
  )
}
