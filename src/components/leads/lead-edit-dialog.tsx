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
  const [loading, setLoading] = useState(false)
  
  // We assume lead has achievements and we edit the first one for simplicity, 
  // or add a switcher if there are multiple.
  const achievement = lead?.achievements?.[0]
  
  const [form, setForm] = useState({
    targetStatusId: "",
    qualificationStatusId: "",
    saleAmount: ""
  })

  useEffect(() => {
    if (isOpen && projectId) {
      fetchStatuses()
      if (achievement) {
        setForm({
          targetStatusId: achievement.targetStatusId?.toString() || "none",
          qualificationStatusId: achievement.qualificationStatusId?.toString() || "none",
          saleAmount: achievement.saleAmount || "0"
        })
      }
    }
  }, [isOpen, projectId, achievement])

  const fetchStatuses = async () => {
    const [tRes, qRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/statuses/target`),
      fetch(`/api/projects/${projectId}/statuses/qualification`)
    ])
    if (tRes.ok) setTargetStatuses(await tRes.json())
    if (qRes.ok) setQualStatuses(await qRes.json())
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: achievement.id,
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
          <DialogTitle>Редактирование лида</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="targetStatus">Целевой статус</Label>
            <Select 
              value={form.targetStatusId} 
              onValueChange={(val) => setForm({...form, targetStatusId: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите статус" />
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
            <Label htmlFor="qualStatus">Статус квалификации</Label>
            <Select 
              value={form.qualificationStatusId} 
              onValueChange={(val) => setForm({...form, qualificationStatusId: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не выбрано</SelectItem>
                {qualStatuses.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Сумма продажи (₽)</Label>
            <Input 
              id="amount" 
              type="number"
              value={form.saleAmount}
              onChange={(e) => setForm({...form, saleAmount: e.target.value})}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
