'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import type { Task, Project, User, Status, Priority, SessionUser } from '@/types'

interface Props {
  tasks: Task[]; projects: Project[]; users: User[]
  statuses: Status[]; priorities: Priority[]
  editTask: Task | null; currentUser: SessionUser
  activeProject: string
  onClose: () => void; onSaved: () => Promise<void>
}

export default function TaskModal({ tasks, projects, users, statuses, priorities, editTask, currentUser, activeProject, onClose, onSaved }: Props) {
  const [title, setTitle]           = useState(editTask?.title || '')
  const [description, setDesc]      = useState(editTask?.description || '')
  const [projectId, setProjectId]   = useState(editTask?.project_id || (activeProject !== 'all' ? activeProject : ''))
  const [assigneeId, setAssigneeId] = useState(editTask?.assignee_id || currentUser.sub)
  const [status, setStatus]         = useState(editTask?.status || statuses[0]?.name || 'Backlog')
  const [priority, setPriority]     = useState(editTask?.priority || priorities[1]?.name || 'Medium')
  const [progress, setProgress]     = useState(editTask?.progress || 0)
  const [dueDate, setDueDate]       = useState(editTask?.due_date?.slice(0,10) || '')
  const [startDate, setStartDate]   = useState(editTask?.start_date?.slice(0,10) || '')
  const [fileRef, setFileRef]       = useState(editTask?.file_ref || '')
  const [blockedBy, setBlockedBy]   = useState<string[]>(editTask?.blocked_by || [])
  const [saving, setSaving]         = useState(false)

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const body = {
        title: title.trim(), description, project_id: projectId || null,
        assignee_id: assigneeId || null, status, priority,
        progress, due_date: dueDate || null, start_date: startDate || null,
        file_ref: fileRef || null, blocked_by: blockedBy
      }
      const res = editTask
        ? await fetch(`/api/tasks/${editTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Save failed'); return }
      toast.success(editTask ? 'Task updated' : 'Task created')
      await onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal w-[560px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-syne font-bold text-base text-text1">{editTask ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-text3 hover:text-text1 text-lg">✕</button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Task Title *</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?" autoFocus />
          </div>

          {/* Description */}
          <div>
            <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Description</label>
            <textarea className="input resize-none" rows={3} value={description}
              onChange={e => setDesc(e.target.value)} placeholder="Notes, scope, details…" />
          </div>

          {/* Project + Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Project</label>
              <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">— No project —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Assignee</label>
              <select className="input" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Status</label>
              <select className="input" value={status} onChange={e => setStatus(e.target.value)}>
                {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Priority</label>
              <select className="input" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="">— None —</option>
                {priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Start Date</label>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Due Date</label>
              <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Progress */}
          <div>
            <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Progress — {progress}%</label>
            <input type="range" min={0} max={100} value={progress}
              onChange={e => setProgress(parseInt(e.target.value))}
              className="w-full accent-accent" />
          </div>

          {/* File ref */}
          <div>
            <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">File Reference</label>
            <input className="input" value={fileRef} onChange={e => setFileRef(e.target.value)}
              placeholder="Drawing number or file path…" />
          </div>

          {/* Blocked by */}
          <div>
            <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Blocked By</label>
            <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto">
              {tasks.filter(t => t.id !== editTask?.id).map(t => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="accent-accent"
                    checked={blockedBy.includes(t.id)}
                    onChange={e => setBlockedBy(bb => e.target.checked ? [...bb, t.id] : bb.filter(id => id !== t.id))} />
                  <span className="text-text2 text-xs">{t.title}</span>
                  {t.project && <span className="text-text3 text-[10px]">({t.project.name})</span>}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editTask ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
