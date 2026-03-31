import * as React from "react"
import { format, subDays, startOfMonth, startOfQuarter, startOfYear, isSameDay } from "date-fns"
import { ru } from "date-fns/locale"
import { Calendar as CalendarIcon, Check } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const presets = [
  {
    label: "Сегодня",
    getValue: () => ({ from: new Date(), to: new Date() })
  },
  {
    label: "Вчера",
    getValue: () => {
      const d = subDays(new Date(), 1);
      return { from: d, to: d };
    }
  },
  {
    label: "Последние 7 дней",
    getValue: () => ({ 
      from: subDays(new Date(), 7), 
      to: subDays(new Date(), 1) 
    })
  },
  {
    label: "Последние 30 дней",
    getValue: () => ({ 
      from: subDays(new Date(), 30), 
      to: subDays(new Date(), 1) 
    })
  },
  {
    label: "Текущий месяц",
    getValue: () => ({ 
      from: startOfMonth(new Date()), 
      to: new Date() 
    })
  },
  {
      label: "Прошлый месяц",
      getValue: () => {
          const firstOfThis = startOfMonth(new Date());
          const lastOfPrev = subDays(firstOfThis, 1);
          return { from: startOfMonth(lastOfPrev), to: lastOfPrev };
      }
  },
  {
    label: "Квартал",
    getValue: () => ({ 
      from: startOfQuarter(new Date()), 
      to: new Date() 
    })
  },
  {
    label: "Год",
    getValue: () => ({ 
      from: startOfYear(new Date()), 
      to: new Date() 
    })
  }
];

export function DatePickerWithRange({
  className,
  date,
  setDate,
}: {
  className?: string
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}) {
  const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date)
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null)

  React.useEffect(() => {
    setMounted(true)
    setTempDate(date)
  }, [date])

  const handleApply = (d?: DateRange) => {
      const finalDate = d || tempDate;
      setDate(finalDate);
      setOpen(false);
  }

  const isPresetActive = (preset: typeof presets[0]) => {
      if (!date || !date.from || !date.to) return false;
      const pValue = preset.getValue();
      return isSameDay(date.from, pValue.from) && isSameDay(date.to, pValue.to);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal h-9 text-xs",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {mounted ? (
              date?.from ? (
                date.to && !isSameDay(date.from, date.to) ? (
                  <>
                    {format(date.from, "dd MMM y", { locale: ru })} -{" "}
                    {format(date.to, "dd MMM y", { locale: ru })}
                  </>
                ) : (
                  format(date.from, "dd MMMM yyyy", { locale: ru })
                )
              ) : (
                <span>Выберите период</span>
              )
            ) : (
              <span>Загрузка дат...</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-row" align="start">
          <div className="flex flex-col border-r border-border p-2 bg-muted/10 min-w-[160px]">
            <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 mb-1 uppercase tracking-wider">Быстрый выбор</div>
            {(() => {
              const activePreset = presets.find(p => isPresetActive(p));
              return presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className={cn(
                      "justify-start text-xs font-normal h-8 px-2",
                      isPresetActive(preset) && "bg-primary/10 text-primary font-medium"
                  )}
                  onClick={() => {
                     const val = preset.getValue();
                     setTempDate(val);
                     setSelectedPreset(preset.label);
                     handleApply(val);
                  }}
                >
                  {preset.label}
                  {selectedPreset === preset.label && <Check className="ml-auto h-3 w-3" />}
                </Button>
              ))
            })()}
          </div>
          <div className="flex flex-col">
            <div className="p-3 border-b border-border flex justify-between items-center bg-muted/20">
              <span className="text-xs font-medium uppercase tracking-tight text-muted-foreground">Выбор в календаре</span>
              <Button 
                  size="sm" 
                  className="h-7 text-xs px-4" 
                  onClick={() => handleApply()}
                  disabled={!tempDate?.from}
              >
                Применить
              </Button>
            </div>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={tempDate?.from}
              selected={tempDate}
              onSelect={(val) => {
                setTempDate(val);
                setSelectedPreset(null);
              }}
              numberOfMonths={2}
              locale={ru}
              className="p-3"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
