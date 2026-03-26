"use client"

import * as React from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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

  // Sync tempDate when prop date changes (e.g. externally)
  React.useEffect(() => {
    setTempDate(date)
  }, [date])

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal h-9 text-xs",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd MMM y", { locale: ru })} -{" "}
                  {format(date.to, "dd MMM y", { locale: ru })}
                </>
              ) : (
                format(date.from, "dd MMM y", { locale: ru })
              )
            ) : (
              <span>Выберите период</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-border flex justify-between items-center bg-muted/20">
            <span className="text-xs font-medium">Выберите период</span>
            <Button 
                size="sm" 
                className="h-7 text-xs" 
                onClick={() => {
                    setDate(tempDate)
                    setOpen(false)
                }}
            >
              Применить
            </Button>
          </div>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={tempDate?.from}
            selected={tempDate}
            onSelect={setTempDate}
            numberOfMonths={2}
            locale={ru}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
