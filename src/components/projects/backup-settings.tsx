"use client"

import * as React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Database, Download, Upload, Server, Loader2, AlertCircle, CheckCircle2, History } from "lucide-react"
import { toast } from "sonner"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"

interface BackupSettingsProps {
    projectId: number;
}

export function BackupSettings({ projectId }: BackupSettingsProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isRestoreOpen, setIsRestoreOpen] = useState(false);
    const [lastBackup, setLastBackup] = useState<string | null>(null);

    // Save to Server
    const handleSaveToServer = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/backup`, { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                toast.success("Бэкап успешно сохранен на сервере");
                setLastBackup(data.timestamp);
            } else {
                toast.error(data.error || "Ошибка сохранения");
            }
        } catch (e) {
            toast.error("Сетевая ошибка");
        } finally {
            setIsLoading(false);
        }
    }

    // Download Backup
    const handleDownload = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/backup`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `backup_project_${projectId}_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                toast.success("Файл бэкапа успешно скачан");
            } else {
                toast.error("Не удалось сформировать бэкап");
            }
        } catch (e) {
            toast.error("Ошибка при скачивании");
        } finally {
            setIsLoading(false);
        }
    }

    // Upload & Restore
    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = JSON.parse(e.target?.result as string);
                setIsLoading(true);
                const res = await fetch(`/api/projects/${projectId}/restore`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(content)
                });
                
                if (res.ok) {
                    toast.success("Данные проекта успешно восстановлены");
                    setIsRestoreOpen(false);
                    // Refresh current view
                    window.location.reload();
                } else {
                    const errorData = await res.json();
                    toast.error(errorData.error || "Ошибка восстановления");
                }
            } catch (err) {
                toast.error("Некорректный формат файла бэкапа");
            } finally {
                setIsLoading(false);
                // Clear input
                event.target.value = "";
            }
        };
        reader.readAsText(file);
    }

    return (
        <div className="space-y-6">
            <Card className="glass-card overflow-hidden">
                <CardHeader className="border-b border-white/10 bg-white/5 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl">
                            <Database className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black tracking-tight">Резервное копирование данных</CardTitle>
                            <CardDescription className="text-muted-foreground font-medium">Управление состоянием проекта и восстановление из сохраненных копий.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-10">
                    {/* Backup Actions */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-6 glass-card bg-white/40 dark:bg-black/20 border-white/10 hover:border-primary/30 transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary transition-colors">
                                    <Server className="h-5 w-5 text-primary group-hover:text-white" />
                                </div>
                                {lastBackup && (
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground bg-white/50 px-2 py-1 rounded-md">
                                        <History className="h-3 w-3" />
                                        Последний: {new Date(lastBackup).toLocaleString()}
                                    </div>
                                )}
                            </div>
                            <h4 className="text-lg font-black uppercase tracking-tight mb-2">Бэкап на сервер</h4>
                            <p className="text-sm text-muted-foreground font-medium mb-6">Создает актуальную копию проекта прямо на сервере. Предыдущий файл будет заменен.</p>
                            <Button 
                                onClick={handleSaveToServer} 
                                disabled={isLoading}
                                className="w-full h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Server className="h-4 w-4 mr-2" />}
                                Сохранить на сервере
                            </Button>
                        </div>

                        <div className="p-6 glass-card bg-white/40 dark:bg-black/20 border-white/10 hover:border-primary/30 transition-all group">
                            <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary transition-colors w-fit mb-4">
                                <Download className="h-5 w-5 text-primary group-hover:text-white" />
                            </div>
                            <h4 className="text-lg font-black uppercase tracking-tight mb-2">Скачать на ПК</h4>
                            <p className="text-sm text-muted-foreground font-medium mb-6">Экспортирует все данные проекта (настройки, лиды, цели) в JSON файл на ваше устройство.</p>
                            <Button 
                                variant="outline"
                                onClick={handleDownload} 
                                disabled={isLoading}
                                className="w-full h-12 rounded-2xl border-primary/20 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5"
                            >
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                                Экспортировать JSON
                            </Button>
                        </div>
                    </div>

                    {/* Restore Section */}
                    <div className="pt-6 border-t border-white/5">
                        <div className="flex flex-col sm:flex-row items-center justify-between p-8 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 gap-6">
                            <div className="flex items-center gap-6 text-center sm:text-left">
                                <div className="p-4 bg-amber-500/10 rounded-3xl">
                                    <AlertCircle className="h-8 w-8 text-amber-500" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-xl font-black tracking-tight text-amber-500">Восстановление данных</h4>
                                    <p className="text-sm text-muted-foreground font-medium max-w-lg">
                                        Загрузите файл бэкапа, чтобы восстановить состояние проекта. 
                                        <span className="text-destructive font-bold underline"> Текущие данные будут полностью заменены.</span>
                                    </p>
                                </div>
                            </div>
                            
                            <Dialog open={isRestoreOpen} onOpenChange={setIsRestoreOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" className="h-14 px-8 rounded-2xl bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-500 transition-all border border-amber-500/20 font-black uppercase text-[10px] tracking-widest">
                                        <Upload className="h-4 w-4 mr-2" /> Импорт бэкапа
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="glass-card border-white/20 shadow-2xl rounded-[3rem]">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl font-black tracking-tight">Подтвердите восстановление</DialogTitle>
                                        <DialogDescription className="text-muted-foreground font-medium py-4">
                                            Все текущие настройки, лиды и финансовые данные проекта будут удалены и заменены данными из выбранного файла. 
                                            <br /><br />
                                            Это действие <span className="text-destructive font-black">необратимо</span>. Вы уверены, что хотите продолжить?
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter className="gap-3">
                                        <Button variant="outline" className="rounded-xl h-11" onClick={() => setIsRestoreOpen(false)}>Отмена</Button>
                                        <label className="cursor-pointer">
                                            <div className="h-11 px-6 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-all flex items-center justify-center font-black uppercase text-[10px] tracking-widest">
                                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                                Выбрать файл и восстановить
                                            </div>
                                            <input type="file" accept=".json" className="hidden" onChange={handleUpload} disabled={isLoading} />
                                        </label>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
