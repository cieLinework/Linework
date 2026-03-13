'use client'

import { useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import type { Task, Status, Priority, Project, User } from '@/types'

interface Props {
  tasks: Task[]; statuses: Status[]; priorities: Priority[]
  projects: Project[]; users: User[]
  onTaskClick: (t: Task) => void
  onUpdateTask: (id: string, u: Partial<Task>) => Promise<void>
  onDeleteTask: (id: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export default function ListView({ tasks, statuses, priorities, projects, users, onTaskClick, onUpdateTask, onDeleteTask, onRefresh }: Props) {
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => tasks.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || t.title.toLowerCase().includes(q) ||
      t.project?.name?.toLowerCase().includes(q) ||
      t.assignee?.name?.toLowerCase().includes(q)
    const matchStatus   = !filterStatus   || t.status === filterStatus
    const matchAssignee = !filterAssignee || t.assignee_id === filterAssignee
    return matchSearch && matchStatus && matchAssignee
  }), [tasks, search, filterStatus, filterAssignee])

  const allSelected = filtered.length > 0 && filtered.every(t => selected.has(t.id))

  function toggleAll() {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map(t => t.id)))
  }

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function bulkUpdate(field: string, value: string) {
    await Promise.all([...selected].map(id => onUpdateTask(id, { [field]: value })))
    toast.success(`Updated ${selected.size} tasks`)
    setSelected(new Set())
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} tasks? This cannot be undone.`)) return
    await Promise.all([...selected].map(id => onDeleteTask(id)))
    setSelected(new Set())
  }

  const isDone = (s: string) => statuses.find(st => st.name === s)?.is_done

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-shrink-0">
        <input className="input w-56 text-xs py-1.5" placeholder="Search tasks…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-36 text-xs py-1.5" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select className="input w-36 text-xs py-1.5" value={filterAssignee}
          onChange={e => setFilterAssignee(e.target.value)}>
          <option value="">All Assignees</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto bg-surface2 border border-border rounded-lg px-3 py-1.5">
            <span className="text-text3 text-[11px]">{selected.size} selected</span>
            <select className="bg-transparent text-text2 text-[11px] outline-none cursor-pointer"
              onChange={e => e.target.value && bulkUpdate('status', e.target.value)}>
              <option value="">Set status…</option>
              {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="bg-transparent text-text2 text-[11px] outline-none cursor-pointer"
              onChange={e => e.target.value && bulkUpdate('assignee_id', e.target.value)}>
              <option value="">Assign to…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button onClick={bulkDelete} className="text-red text-[11px] hover:opacity-80">🗑 Delete</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto pb-12">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-2.5">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="accent-accent cursor-pointer" />
              </th>
              <th className="text-left text-[9px] uppercase tracking-widest text-text3 px-3 py-2.5 font-normal">Task</th>
              <th className="text-left text-[9px] uppercase tracking-widest text-text3 px-3 py-2.5 font-normal">Project</th>
              <th className="text-left text-[9px] uppercase tracking-widest text-text3 px-3 py-2.5 font-normal">Assignee</th>
              <th className="text-left text-[9px] uppercase tracking-widest text-text3 px-3 py-2.5 font-normal">Status</th>
              <th className="text-left text-[9px] uppercase tracking-widest text-text3 px-3 py-2.5 font-normal">Priority</th>
              <th className="text-left text-[9px] uppercase tracking-widest text-text3 px-3 py-2.5 font-normal">Progress</th>
              <th className="text-left text-[9px] uppercase tracking-widest text-text3 px-3 py-2.5 font-normal">Due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(task => {
              const overdue = task.due_date && !isDone(task.status) && new Date(task.due_date) < new Date()
              return (
                <tr key={task.id} onClick={() => onTaskClick(task)}
                  className="border-b border-border hover:bg-surface2 cursor-pointer transition-colors">
                  <td className="px-4 py-2.5" onClick={e => { e.stopPropagation(); toggle(task.id) }}>
                    <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggle(task.id)}
                      className="accent-accent cursor-pointer" onClick={e => e.stopPropagation()} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-text1 text-xs font-medium">{task.title}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {task.project && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: task.project.color }} />
                        <span className="text-text2 text-xs truncate max-w-32">{task.project.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {task.assignee && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ background: task.assignee.color }}>{task.assignee.initials}</div>
                        <span className="text-text2 text-xs">{task.assignee.name.split(' ')[0]}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="badge text-[9px]"
                      style={{ background: `${statuses.find(s=>s.name===task.status)?.color||'#4a5275'}22`,
                               color: statuses.find(s=>s.name===task.status)?.color||'#9aa5cc' }}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {task.priority && (
                      <span className="badge text-[9px]"
                        style={{ background: `${getPriorityColor(task.priority)}22`, color: getPriorityColor(task.priority) }}>
                        {task.priority}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="progress-bar w-16">
                        <div className="progress-fill"
                          style={{ width: `${task.progress}%`, background: task.progress===100?'#2dce89':'#4f8eff' }} />
                      </div>
                      <span className="text-text3 text-[10px]">{task.progress}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs ${overdue ? 'text-red' : 'text-text3'}`}>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '—'}
                      {overdue ? ' ⚠' : ''}
                    </span>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-text3 text-sm py-12">No tasks found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function getPriorityColor(p: string) {
  const m: Record<string,string> = { Low:'#2dce89',Medium:'#ffb800',High:'#ff7730',Critical:'#ff4757',RAYNEAU:'#b000ff' }
  return m[p] || '#9aa5cc'
}
