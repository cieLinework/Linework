'use client'

import { useState } from 'react'
import type { Task, Project, Status, User } from '@/types'

interface Props {
  tasks: Task[]; projects: Project[]; statuses: Status[]; users: User[]
  onTaskClick: (t: Task) => void
}

export default function OverviewView({ tasks, projects, statuses, onTaskClick }: Props) {
  const [search, setSearch]       = useState('')
  const [hideDone, setHideDone]   = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const isDone = (s: string) => statuses.find(st => st.name === s)?.is_done

  const toggle = (id: string) =>
    setCollapsed(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n })

  const healthColors: Record<string,string> = { green:'#2dce89', yellow:'#ffb800', red:'#ff4757', none:'#9aa5cc' }

  function getHealth(projectId: string) {
    const pts = tasks.filter(t => t.project_id === projectId)
    if (!pts.length) return 'none'
    const overdue = pts.filter(t => t.due_date && !isDone(t.status) && new Date(t.due_date) < new Date())
    if (overdue.length) return 'red'
    const active = pts.filter(t => t.status !== 'Backlog' && !isDone(t.status))
    if (active.length) return 'yellow'
    return 'green'
  }

  const q = search.toLowerCase()

  return (
    <div className="h-full overflow-auto p-6 pb-12">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input className="input w-56 text-xs py-1.5" placeholder="Filter projects or tasks…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-text3 text-xs cursor-pointer">
          <input type="checkbox" className="accent-accent" checked={hideDone}
            onChange={e => setHideDone(e.target.checked)} />
          Hide completed
        </label>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost text-xs py-1.5 px-3"
            onClick={() => setCollapsed(new Set())}>Expand all</button>
          <button className="btn-ghost text-xs py-1.5 px-3"
            onClick={() => setCollapsed(new Set(projects.map(p => p.id)))}>Collapse all</button>
          <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>

      {/* Projects */}
      {projects.filter(p =>
        !q || p.name.toLowerCase().includes(q) ||
        tasks.some(t => t.project_id === p.id && t.title.toLowerCase().includes(q))
      ).map(proj => {
        let pts = tasks.filter(t => t.project_id === proj.id)
        if (hideDone) pts = pts.filter(t => !isDone(t.status))

        const allPts  = tasks.filter(t => t.project_id === proj.id)
        const done    = allPts.filter(t => isDone(t.status)).length
        const pct     = allPts.length ? Math.round(done / allPts.length * 100) : 0
        const health  = getHealth(proj.id)
        const isOpen  = !collapsed.has(proj.id)
        const progColor = pct === 100 ? '#2dce89' : pct >= 50 ? '#4f8eff' : '#ffb800'

        const displayPts = q && !proj.name.toLowerCase().includes(q)
          ? pts.filter(t => t.title.toLowerCase().includes(q))
          : pts

        return (
          <div key={proj.id} className="bg-surface border border-border rounded-xl mb-3 overflow-hidden hover:border-accent/50 transition-colors">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 bg-surface2 cursor-pointer"
              onClick={() => toggle(proj.id)}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: proj.color }} />
              <div className="flex-1">
                <span className="font-syne font-bold text-sm text-text1">{proj.name}</span>
                {proj.description && <span className="text-text3 text-[10px] ml-2">{proj.description}</span>}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-text3 text-[10px]">{allPts.length} tasks</span>
                <span className="text-green text-[10px]">{done} done</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-surface3 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: progColor }} />
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: progColor }}>{pct}%</span>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: healthColors[health] }} />
                <span className="text-text3 text-xs transition-transform" style={{ transform: isOpen ? 'rotate(90deg)' : '' }}>▶</span>
              </div>
            </div>

            {/* Tasks */}
            {isOpen && (
              <div>
                {/* Header row */}
                <div className="grid gap-2 px-5 py-2 border-b border-border text-[9px] uppercase tracking-widest text-text3"
                  style={{ gridTemplateColumns: '28px 1fr 140px 110px 90px 80px 80px' }}>
                  <span>#</span><span>Task</span><span>Assignee</span>
                  <span>Status</span><span>Priority</span><span>Progress</span><span>Due</span>
                </div>
                {displayPts.length === 0 && (
                  <div className="px-5 py-4 text-text3 text-xs italic">No tasks</div>
                )}
                {displayPts.map((task, i) => {
                  const done   = isDone(task.status)
                  const overdue = task.due_date && !done && new Date(task.due_date) < new Date()
                  return (
                    <div key={task.id} onClick={() => onTaskClick(task)}
                      className={`grid gap-2 px-5 py-2.5 border-b border-border last:border-0
                        hover:bg-surface2 cursor-pointer transition-colors items-center text-xs
                        ${done ? 'opacity-50' : ''}`}
                      style={{ gridTemplateColumns: '28px 1fr 140px 110px 90px 80px 80px' }}>
                      <span className="text-text3 text-[10px]">{i+1}</span>
                      <span className={`text-text1 font-medium truncate ${done ? 'line-through' : ''}`}>{task.title}</span>
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {task.assignee ? (
                          <>
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                              style={{ background: task.assignee.color }}>{task.assignee.initials}</div>
                            <span className="text-text2 text-[10px] truncate">{task.assignee.name}</span>
                          </>
                        ) : <span className="text-text3 text-[10px]">—</span>}
                      </div>
                      <div>
                        <span className="badge text-[9px]"
                          style={{ background: `${statuses.find(s=>s.name===task.status)?.color||'#4a5275'}22`,
                                   color: statuses.find(s=>s.name===task.status)?.color||'#9aa5cc' }}>
                          {task.status}
                        </span>
                      </div>
                      <div>
                        {task.priority && (
                          <span className="badge text-[9px]"
                            style={{ background: `${getPC(task.priority)}22`, color: getPC(task.priority) }}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="progress-bar flex-1">
                          <div className="progress-fill" style={{ width:`${task.progress}%`, background: task.progress===100?'#2dce89':'#4f8eff' }} />
                        </div>
                        <span className="text-text3 text-[9px] w-7">{task.progress}%</span>
                      </div>
                      <span className={`text-[10px] ${overdue ? 'text-red' : 'text-text3'}`}>
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '—'}
                        {overdue ? ' ⚠' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getPC(p: string) {
  const m: Record<string,string> = { Low:'#2dce89',Medium:'#ffb800',High:'#ff7730',Critical:'#ff4757',RAYNEAU:'#b000ff' }
  return m[p] || '#9aa5cc'
}
