"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Simple chart components for progress visualization
interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("w-full h-64 relative", className)}
      {...props}
    >
      {children}
    </div>
  )
)
ChartContainer.displayName = "ChartContainer"

interface BarChartProps {
  data: Array<{ name: string; value: number; color?: string }>
  className?: string
}

const BarChart: React.FC<BarChartProps> = ({ data, className }) => {
  const maxValue = Math.max(...data.map(item => item.value))
  
  return (
    <div className={cn("flex items-end justify-between h-full gap-2", className)}>
      {data.map((item, index) => (
        <div key={index} className="flex flex-col items-center flex-1">
          <div className="w-full flex flex-col justify-end h-full">
            <div
              className={cn(
                "w-full rounded-t-sm transition-all duration-300",
                item.color || "bg-primary"
              )}
              style={{
                height: `${(item.value / maxValue) * 100}%`,
                minHeight: item.value > 0 ? '4px' : '0px'
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground mt-2 text-center">
            {item.name}
          </span>
        </div>
      ))}
    </div>
  )
}

interface LineChartProps {
  data: Array<{ name: string; value: number }>
  className?: string
}

const LineChart: React.FC<LineChartProps> = ({ data, className }) => {
  const maxValue = Math.max(...data.map(item => item.value))
  const minValue = Math.min(...data.map(item => item.value))
  const range = maxValue - minValue || 1
  
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = 100 - ((item.value - minValue) / range) * 100
    return `${x},${y}`
  }).join(' ')
  
  return (
    <div className={cn("w-full h-full relative", className)}>
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          points={points}
          vectorEffect="non-scaling-stroke"
        />
        {data.map((item, index) => {
          const x = (index / (data.length - 1)) * 100
          const y = 100 - ((item.value - minValue) / range) * 100
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2"
              fill="hsl(var(--primary))"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground">
        {data.map((item, index) => (
          <span key={index} className="text-center">
            {item.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export { ChartContainer, BarChart, LineChart }