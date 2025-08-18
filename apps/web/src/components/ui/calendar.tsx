"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export interface CalendarProps {
  mode?: "single" | "multiple" | "range"
  selected?: Date | Date[] | undefined
  onSelect?: (date: Date | undefined) => void
  className?: string
  showOutsideDays?: boolean
  initialFocus?: boolean
}

function Calendar({
  className,
  selected,
  onSelect,
  showOutsideDays = true,
  initialFocus = false,
  ...props
}: CalendarProps) {
  // Simple calendar implementation without react-day-picker
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  
  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentYear, currentMonth, i))
  }

  const handleDayClick = (date: Date) => {
    onSelect?.(date)
  }

  return (
    <div className={cn("p-3", className)}>
      <div className="flex justify-center pt-1 relative items-center mb-4">
        <span className="text-sm font-medium">
          {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center">
            {day}
          </div>
        ))}
        
        {days.map((date, index) => (
          <div key={index} className="h-9 w-9 text-center text-sm p-0 relative">
            {date ? (
              <button
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-9 w-9 p-0 font-normal",
                  selected === date && "bg-primary text-primary-foreground"
                )}
                onClick={() => handleDayClick(date)}
              >
                {date.getDate()}
              </button>
            ) : (
              <div className="h-9 w-9" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar } 