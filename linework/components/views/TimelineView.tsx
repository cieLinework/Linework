'use client'

import { useMemo } from 'react'
import type { Task, Project } from '@/types'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, isToday } from 'date-fns'

interface Props {
  tasks: Task[]; projects: Project[]; onTaskClick: (t: Task) => void
}

export default function TimelineView({ tasks, projects, onTaskClick }: Props) {
  const today = new Date()
  const start = startOfMonth(today)
  const end   = endOfMonth(addMonths(today, 2))
  const days  = eachDayOfInterval({ start, end })

  const DAY_W = 32 // px per day

  const tasksWithDates = tasks.filter(t => t.start_date && t.due_date)

  const months = useMemo(() => {
    const m: { label: string; days: number }[] = []
    let cur = start
    while (cur <= end) {
      const mo = { label: format(cur, 'MMM yyyy'), days: 0 }
      while (cur <= end && format(cur, 'MMM yyyy') === mo.label) {
        mo.days++; cur = new Date(cur.getTime() + 86400000)
      }
      m.push(mo)
    }
    return m
  }, [start, end])

  const dayOffset = (date: Date) => {
    const diff = Math.floor((date.getTime() - start.getTime()) / 86400000)
    return diff * DAY_W
  }

  const totalW = days.length * DAY_W

  if (!tasksWithDates.length) {
    return (
      <div className="flex items-center justify-center h-full text-text3 text-sm">
        No tasks with start and due dates. Add dates to tasks to see the timeline.
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6 pb-12">
      <div className="min-w-max">
        {/* Month headers */}
        <div className="flex border-b border-border mb-0 sticky top-0 bg-bg z-10">
          <div className="w-56 flex-shrink-0 border-r border-border" />
          <div className="flex">
            {months.map(m => (
              <div key={m.label} className="border-r border-border text-text3 text-[10px] uppercase tracking-wide px-2 py-2 text-center"
                style={{ width: m.days * DAY_W }}>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Day headers */}
        <div className="flex border-b border-border sticky top-8 bg-bg z-10">
          <div className="w-56 flex-shrink-0 border-r border-border" />
          <div className="flex">
            {days.map(d => (
              <div key={d.toISOString()}
                className={`border-r border-border text-[9px] text-center py-1 flex-shrink-0
                  ${isToday(d) ? 'bg-accent/20 text-accent font-bold' : 'text-text3'}`}
                style={{ width: DAY_W }}>
                {format(d, 'd')}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {tasksWithDates.map(task => {
          const s = new Date(task.start_date!)
          const e = new Date(task.due_date!)
          const left  = Math.max(0, dayOffset(s))
          const width = Math.max(DAY_W, (Math.floor((e.getTime() - s.getTime()) / 86400000) + 1) * DAY_W)
          const proj  = projects.find(p => p.id === task.project_id)
          return (
            <div key={task.id} className="flex border-b border-border hover:bg-surface2 transition-colors group">
              <div className="w-56 flex-shrink-0 border-r border-border px-4 py-2.5 flex items-center gap-2">
                {proj && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: proj.color }} />}
                <span className="text-text2 text-xs truncate">{task.title}</span>
              </div>
              <div className="relative flex-1" style={{ width: totalW, minWidth: totalW }}>
                {/* Today line */}
                <div className="absolute top-0 bottom-0 w-px bg-accent/40 z-10 pointer-events-none"
                  style={{ left: dayOffset(today) }} />
                {/* Bar */}
                <div onClick={() => onTaskClick(task)}
                  className="absolute top-1.5 h-7 rounded-lg cursor-pointer flex items-center px-2 transition-all hover:brightness-110"
                  style={{
                    left, width,
                    background: proj?.color || '#4f8eff',
                    opacity: 0.85
                  }}>
                  <span className="text-white text-[10px] font-medium truncate">{task.title}</span>
                  {task.progress > 0 && (
                    <div className="absolute bottom-0 left-0 h-1 rounded-b-lg bg-white/30"
                      style={{ width: `${task.progress}%` }} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
