'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { Project } from '@/types'

const SWATCHES = ['#4f8eff','#7c5cfc','#2dce89','#ffb800','#ff4757','#ff7730','#e91e8c','#00c9b1','#b000ff','#a0a8c0','#ff7730','#4f8eff']

interface Props { projects: Project[]; onClose: () => void; onUpdated: () => Promise<void> }

export default function ProjectModal({ projects, onClose, onUpdated }: Props) {
  const [name, setName]     = useState('')
  const [desc, setDesc]     = useState('')
  const [color, setColor]   = useState('#4f8eff')
  const [start, setStart]   = useState('')
  const [end, setEnd]       = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function addProject() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc, color, start_date: start || null, end_date: end || null })
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
      toast.success('Project created')
      setName(''); setDesc(''); setColor('#4f8eff'); setStart(''); setEnd('')
      setShowForm(false)
      await onUpdated()
    } finally { setAdding(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal w-[520px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-syne font-bold text-base text-text1">📁 Projects</h2>
          <button onClick={onClose} className="text-text3 hover:text-text1 text-lg">✕</button>
        </div>

        {/* List */}
        <div className="max-h-64 overflow-y-auto divide-y divide-border">
          {projects.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-6 py-3">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <div className="flex-1">
                <div className="text-text1 text-sm font-semibold">{p.name}</div>
                {p.description && <div className="text-text3 text-xs">{p.description}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Add form */}
        <div className="px-6 py-4 border-t border-border">
          {!showForm ? (
            <button className="btn-ghost text-xs w-full py-2" onClick={() => setShowForm(true)}>
              + Add New Project
            </button>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="text-text3 text-[10px] uppercase tracking-widest">New Project</div>
              <input className="input text-xs py-1.5" value={name} onChange={e => setName(e.target.value)} placeholder="Project name *" />
              <textarea className="input text-xs py-1.5 resize-none" rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="input text-xs py-1.5" value={start} onChange={e => setStart(e.target.value)} />
                <input type="date" className="input text-xs py-1.5" value={end} onChange={e => setEnd(e.target.value)} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {SWATCHES.map(c => (
                  <button key={c} onClick={() => setColor(c)} className="w-5 h-5 rounded-full transition-all"
                    style={{ background: c, border: `2px solid ${c === color ? '#fff' : 'transparent'}`, transform: c === color ? 'scale(1.2)' : 'scale(1)' }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs flex-1" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary text-xs flex-1" onClick={addProject} disabled={adding}>
                  {adding ? 'Creating…' : 'Create Project'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border flex justify-end">
          <button className="btn-ghost text-xs" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
