'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { Task, Status, Project, User } from '@/types'

interface Props {
  tasks: Task[]; statuses: Status[]; projects: Project[]; users: User[]
  onTaskClick: (t: Task) => void
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
  onAddTask: () => void
  onRefresh: () => Promise<void>
}

export default function KanbanView({ tasks, statuses, onTaskClick, onUpdateTask, onRefresh }: Props) {
  const [dragId, setDragId]     = useState<string | null>(null)
  const [overCol, setOverCol]   = useState<string | null>(null)
  const [quickAdd, setQuickAdd] = useState<Record<string, string>>({})

  async function handleDrop(statusName: string) {
    if (!dragId) return
    await onUpdateTask(dragId, { status: statusName })
    setDragId(null); setOverCol(null)
  }

  async function addQuick(statusName: string) {
    const title = quickAdd[statusName]?.trim()
    if (!title) return
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, status: statusName })
    })
    if (res.ok) {
      setQuickAdd(q => ({ ...q, [statusName]: '' }))
      await onRefresh()
      toast.success('Task added')
    }
  }

  const isDone = (s: string) => statuses.find(st => st.name === s)?.is_done

  return (
    <div className="flex gap-4 h-full overflow-x-auto overflow-y-hidden p-6 pb-12">
      {statuses.map(status => {
        const col = tasks.filter(t => t.status === status.name)
        const isOver = overCol === status.name
        return (
          <div key={status.id}
            className={`flex-shrink-0 w-72 flex flex-col rounded-xl border transition-all
              ${isOver ? 'border-accent bg-accent/5' : 'border-border bg-surface'}`}
            onDragOver={e => { e.preventDefault(); setOverCol(status.name) }}
            onDragLeave={() => setOverCol(null)}
            onDrop={() => handleDrop(status.name)}>

            {/* Column header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: status.color }} />
              <span className="text-text2 text-xs font-semibold flex-1">{status.name}</span>
              <span className="text-text3 text-[10px] bg-surface3 px-1.5 py-0.5 rounded-full">{col.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {col.map(task => {
                const isBlocked = task.blocked_by && task.blocked_by.length > 0 &&
                  !task.blocked_by.every(bid => isDone(tasks.find(t => t.id === bid)?.status || ''))
                return (
                  <div key={task.id}
                    draggable
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => { setDragId(null); setOverCol(null) }}
                    onClick={() => onTaskClick(task)}
                    className={`bg-surface2 border border-border rounded-xl p-3 cursor-pointer
                      hover:border-accent hover:-translate-y-0.5 transition-all select-none
                      ${dragId === task.id ? 'opacity-40' : ''}`}>

                    {/* Project */}
                    {task.project && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: task.project.color }} />
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: task.project.color }}>
                          {task.project.name}
                        </span>
                      </div>
                    )}

                    <p className="text-text1 text-xs font-medium leading-snug mb-2">{task.title}</p>

                    {/* Blocked badge */}
                    {isBlocked && (
                      <span className="badge bg-red/10 text-red border border-red/20 mb-2">🔒 Blocked</span>
                    )}

                    {/* Progress */}
                    {task.progress > 0 && (
                      <div className="progress-bar mb-2">
                        <div className="progress-fill"
                          style={{ width: `${task.progress}%`, background: task.progress === 100 ? '#2dce89' : '#4f8eff' }} />
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-2 mt-1">
                      {task.priority && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: `${getPriorityColor(task.priority)}22`, color: getPriorityColor(task.priority) }}>
                          {task.priority}
                        </span>
                      )}
                      {task.due_date && (
                        <span className={`text-[9px] ml-auto ${
                          new Date(task.due_date) < new Date() && !isDone(task.status) ? 'text-red' : 'text-text3'
                        }`}>
                          {new Date(task.due_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}
                        </span>
                      )}
                      {task.assignee && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ background: task.assignee.color }}>{task.assignee.initials}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick add */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-1.5">
                <input
                  className="input text-[11px] py-1.5 flex-1"
                  placeholder="Quick add task…"
                  value={quickAdd[status.name] || ''}
                  onChange={e => setQuickAdd(q => ({ ...q, [status.name]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addQuick(status.name)}
                />
                <button onClick={() => addQuick(status.name)}
                  className="w-7 h-7 rounded-lg bg-surface3 text-text3 hover:text-accent hover:bg-surface2 text-sm transition-all">
                  ↵
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function getPriorityColor(priority: string) {
  const map: Record<string, string> = {
    Low: '#2dce89', Medium: '#ffb800', High: '#ff7730', Critical: '#ff4757', RAYNEAU: '#b000ff'
  }
  return map[priority] || '#9aa5cc'
}
