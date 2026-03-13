'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import type { Task, Project, User, Status, Priority, SessionUser, DrawingStage } from '@/types'
import { DRAWING_STAGE_TEMPLATES } from '@/types'

interface Props {
  task: Task; tasks: Task[]; users: User[]; statuses: Status[]
  priorities: Priority[]; projects: Project[]; currentUser: SessionUser
  onClose: () => void
  onUpdate: (id: string, u: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (t: Task) => void
  onRefresh: () => Promise<void>
}

export default function TaskDetail({ task, users, statuses, priorities, projects, currentUser, onClose, onUpdate, onDelete, onEdit, onRefresh }: Props) {
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [drawings, setDrawings] = useState<DrawingStage[]>(task.drawing_stages || [])
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(drawings.map(d => d.id)))

  useEffect(() => {
    setDrawings(task.drawing_stages || [])
    setExpandedStages(new Set((task.drawing_stages || []).map(d => d.id)))
  }, [task.id])

  const isDone = (s: string) => statuses.find(st => st.name === s)?.is_done
  const isOverdue = task.due_date && !isDone(task.status) && new Date(task.due_date) < new Date()
  const statusColor = statuses.find(s => s.name === task.status)?.color || '#4a5275'

  async function postComment() {
    if (!comment.trim()) return
    setPosting(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: comment.trim(), author_id: currentUser.sub, author_name: currentUser.name })
      })
      if (res.ok) { setComment(''); await onRefresh(); toast.success('Comment added') }
    } finally { setPosting(false) }
  }

  async function updateDrawingItem(stageId: string, itemId: string, progress: number) {
    const res = await fetch(`/api/tasks/${task.id}/drawings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageId, itemId, progress })
    })
    if (res.ok) {
      const updated = await res.json()
      setDrawings(updated.stages)
      await onUpdate(task.id, { progress: updated.overallProgress })
    }
  }

  const overallDrawingProgress = drawings.length
    ? Math.round(drawings.flatMap(s => s.items).reduce((a, i) => a + i.progress, 0) /
        Math.max(1, drawings.flatMap(s => s.items).length))
    : task.progress

  const tmplMap = Object.fromEntries(DRAWING_STAGE_TEMPLATES.map(t => [t.key, t]))

  return (
    <div className="fixed top-0 right-0 w-[420px] h-full bg-surface border-l border-border z-40 flex flex-col shadow-2xl slide-in overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border flex-shrink-0">
        <button onClick={() => onEdit(task)} className="btn-ghost text-xs px-3 py-1.5">✏ Edit</button>
        <button onClick={() => onDelete(task.id)} className="btn-ghost text-xs px-3 py-1.5 text-red border-red/40 hover:bg-red/10">🗑 Delete</button>
        <button onClick={async () => {
          const copy = { ...task, title: task.title + ' (copy)', progress: 0, blocked_by: [] }
          const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copy) })
          if (res.ok) { await onRefresh(); toast.success('Task duplicated') }
        }} className="btn-ghost text-xs px-3 py-1.5">⧉ Duplicate</button>
        <button onClick={onClose} className="ml-auto text-text3 hover:text-text1 text-lg">✕</button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 border-b border-border">
          {task.project && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ background: task.project.color }} />
              <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: task.project.color }}>{task.project.name}</span>
            </div>
          )}
          <h2 className="font-syne font-bold text-lg text-text1 leading-snug mb-3">{task.title}</h2>

          {/* Progress */}
          <div className="mb-1">
            <div className="flex justify-between mb-1">
              <span className="text-text3 text-[10px] uppercase tracking-widest">Progress</span>
              <span className="text-text2 text-[11px] font-semibold">{overallDrawingProgress}%</span>
            </div>
            <div className="progress-bar h-2">
              <div className="progress-fill h-full"
                style={{ width: `${overallDrawingProgress}%`, background: overallDrawingProgress===100?'#2dce89':'#4f8eff' }} />
            </div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-3 px-5 py-4 border-b border-border text-xs">
          <div>
            <div className="text-text3 text-[10px] uppercase tracking-widest mb-1">Status</div>
            <span className="badge" style={{ background: `${statusColor}22`, color: statusColor }}>{task.status}</span>
          </div>
          <div>
            <div className="text-text3 text-[10px] uppercase tracking-widest mb-1">Priority</div>
            {task.priority
              ? <span className="badge" style={{ background: `${getPC(task.priority)}22`, color: getPC(task.priority) }}>{task.priority}</span>
              : <span className="text-text3">—</span>}
          </div>
          <div>
            <div className="text-text3 text-[10px] uppercase tracking-widest mb-1">Assignee</div>
            {task.assignee
              ? <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: task.assignee.color }}>{task.assignee.initials}</div>
                  <span className="text-text2">{task.assignee.name}</span>
                </div>
              : <span className="text-text3">—</span>}
          </div>
          <div>
            <div className="text-text3 text-[10px] uppercase tracking-widest mb-1">Due Date</div>
            <span className={isOverdue ? 'text-red' : 'text-text2'}>
              {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
              {isOverdue && ' ⚠'}
            </span>
          </div>
        </div>

        {task.description && (
          <div className="px-5 py-3 border-b border-border">
            <div className="text-text3 text-[10px] uppercase tracking-widest mb-1.5">Description</div>
            <p className="text-text2 text-xs leading-relaxed whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        {task.file_ref && (
          <div className="px-5 py-3 border-b border-border">
            <div className="text-text3 text-[10px] uppercase tracking-widest mb-1.5">File Reference</div>
            <p className="text-accent text-xs font-mono">{task.file_ref}</p>
          </div>
        )}

        {/* Drawing Breakdown */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📐</span>
            <span className="text-text2 text-xs font-semibold uppercase tracking-wider">Drawing Breakdown</span>
            <span className="text-text3 text-[10px] ml-auto">{overallDrawingProgress}%</span>
          </div>
          {drawings.map(stage => {
            const tmpl = tmplMap[stage.stage_key] || { icon: '📄', label: stage.stage_key }
            const isExpanded = expandedStages.has(stage.id)
            const avgPct = stage.items.length
              ? Math.round(stage.items.reduce((a, i) => a + i.progress, 0) / stage.items.length) : 0
            const fillColor = avgPct === 100 ? '#2dce89' : avgPct > 50 ? '#4f8eff' : avgPct > 0 ? '#ffb800' : '#4a5275'

            return (
              <div key={stage.id} className="mb-2 border border-border rounded-lg overflow-hidden">
                <button className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface2 hover:bg-surface3 transition-colors"
                  onClick={() => setExpandedStages(es => { const n = new Set(es); n.has(stage.id) ? n.delete(stage.id) : n.add(stage.id); return n })}>
                  <span className="text-sm">{tmpl.icon}</span>
                  <span className="text-text2 text-xs font-semibold flex-1 text-left">{tmpl.label}</span>
                  <div className="w-16 h-1 bg-surface3 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${avgPct}%`, background: fillColor }} />
                  </div>
                  <span className="text-text3 text-[10px] w-8 text-right">{avgPct}%</span>
                  <span className="text-text3 text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                </button>
                {isExpanded && (
                  <div className="divide-y divide-border">
                    {stage.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                        <span className={`text-xs flex-1 ${item.progress === 100 ? 'line-through text-text3' : 'text-text2'}`}>{item.name}</span>
                        <div className="flex gap-1">
                          {[0, 25, 50, 75, 100].map(p => (
                            <button key={p} onClick={() => updateDrawingItem(stage.id, item.id, p)}
                              className={`text-[9px] px-1.5 py-0.5 rounded transition-all
                                ${item.progress === p ? 'bg-accent text-white' : 'bg-surface3 text-text3 hover:bg-surface2'}`}>
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Comments */}
        <div className="px-5 py-4">
          <div className="text-text2 text-xs font-semibold uppercase tracking-wider mb-3">
            💬 Comments ({task.comments?.length || 0})
          </div>
          <div className="flex flex-col gap-3 mb-4">
            {(task.comments || []).map(c => (
              <div key={c.id} className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ background: c.author?.color || '#4f8eff' }}>{c.author?.initials || c.author_name[0]}</div>
                <div className="flex-1 bg-surface2 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-text1 text-[11px] font-semibold">{c.author_name}</span>
                    <span className="text-text3 text-[9px]">{new Date(c.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</span>
                  </div>
                  <p className="text-text2 text-xs leading-relaxed">{c.text}</p>
                </div>
              </div>
            ))}
            {(!task.comments || !task.comments.length) && (
              <p className="text-text3 text-xs">No comments yet</p>
            )}
          </div>
          {/* Comment input */}
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
              style={{ background: currentUser.color }}>{currentUser.initials}</div>
            <div className="flex-1 flex gap-2">
              <textarea className="input resize-none py-1.5 flex-1" rows={2} value={comment}
                onChange={e => setComment(e.target.value)} placeholder="Add a comment…"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() } }} />
              <button onClick={postComment} disabled={posting || !comment.trim()}
                className="btn-primary px-3 text-sm self-end">↑</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getPC(p: string) {
  const m: Record<string,string> = { Low:'#2dce89',Medium:'#ffb800',High:'#ff7730',Critical:'#ff4757',RAYNEAU:'#b000ff' }
  return m[p] || '#9aa5cc'
}
