"use client"

import { useState, useEffect } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog"
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
import { Loader2 } from "lucide-react"

interface LeadEditDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  lead: any
  projectId: number
}

export function LeadEditDialog({ isOpen, onClose, onSave, lead, projectId }: LeadEditDialogProps) {
  const [targetStatuses, setTargetStatuses] = useState<any[]>([])
  const [qualStatuses, setQualStatuses] = useState<any[]>([])
  const [leadStages, setLeadStages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  const achievement = lead?.achievements?.[0]
  const leadData = lead?.lead
  
  const [form, setForm] = useState({
    targetStatusId: "",
    qualificationStatusId: "",
    stageId: "",
    saleAmount: ""
  })

  useEffect(() => {
    if (isOpen && projectId) {
      fetchStatuses()
      setForm({
        targetStatusId: achievement?.targetStatusId?.toString() || "none",
        qualificationStatusId: achievement?.qualificationStatusId?.toString() || "none",
        stageId: leadData?.stageId?.toString() || "none",
        saleAmount: achievement?.saleAmount || "0"
      })
    }
  }, [isOpen, projectId, lead])

  const fetchStatuses = async () => {
    const [tRes, qRes, sRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/statuses/target`),
      fetch(`/api/projects/${projectId}/statuses/qualification`),
      fetch(`/api/projects/${projectId}/statuses/stages`)
    ])
    if (tRes.ok) setTargetStatuses(await tRes.json())
    if (qRes.ok) setQualStatuses(await qRes.json())
    if (sRes.ok) setLeadStages(await sRes.json())
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: achievement?.id,
          leadId: leadData?.id,
          stageId: form.stageId === "none" ? null : parseInt(form.stageId),
          targetStatusId: form.targetStatusId === "none" ? null : parseInt(form.targetStatusId),
          qualificationStatusId: form.qualificationStatusId === "none" ? null : parseInt(form.qualificationStatusId),
          saleAmount: form.saleAmount
        })
      })

      if (res.ok) {
        toast.success("Данные лида обновлены")
        onSave()
        onClose()
      } else {
        toast.error("Ошибка при сохранении")
      }
    } catch (e) {
      toast.error("Произошла ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Редактирование лида</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label className="text-xs font-bold text-neutral-500 uppercase">Этап сделки</Label>
            <Select 
              value={form.stageId} 
              onValueChange={(val) => setForm({...form, stageId: val})}
            >
              <SelectTrigger className="h-10 border-neutral-200">
                <SelectValue placeholder="Выберите этап" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не выбрано</SelectItem>
                {leadStages.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label className="text-xs font-bold text-neutral-500 uppercase">Целевой статус</Label>
                <Select 
                value={form.targetStatusId} 
                onValueChange={(val) => setForm({...form, targetStatusId: val})}
                >
                <SelectTrigger className="h-10 border-neutral-200">
                    <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Не выбрано</SelectItem>
                    {targetStatuses.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.label}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2">
                <Label className="text-xs font-bold text-neutral-500 uppercase">Квал</Label>
                <Select 
                value={form.qualificationStatusId} 
                onValueChange={(val) => setForm({...form, qualificationStatusId: val})}
                >
                <SelectTrigger className="h-10 border-neutral-200">
                    <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Не выбрано</SelectItem>
                    {qualStatuses.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.label}</SelectItem>
                    ))}
                </SelectContent>
                </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs font-bold text-neutral-500 uppercase">Сумма продажи (₽)</Label>
            <Input 
              type="number"
              value={form.saleAmount}
              onChange={(e) => setForm({...form, saleAmount: e.target.value})}
              className="h-10 border-neutral-200 font-bold"
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-4 mt-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Отмена</Button>
          <Button onClick={handleSave} disabled={loading} className="min-w-[150px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
