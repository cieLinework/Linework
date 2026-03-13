'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Task, Project, User, Status, Priority, SessionUser } from '@/types'

// Views
import KanbanView   from '@/components/views/KanbanView'
import TimelineView from '@/components/views/TimelineView'
import ListView     from '@/components/views/ListView'
import OverviewView from '@/components/views/OverviewView'

// Panels & Modals
import TaskDetail    from '@/components/TaskDetail'
import TaskModal     from '@/components/TaskModal'
import ProfilePanel  from '@/components/ProfilePanel'
import AdminModal    from '@/components/AdminModal'
import ProjectModal  from '@/components/ProjectModal'
import StatusModal   from '@/components/StatusModal'

type View = 'kanban' | 'timeline' | 'list' | 'overview'

interface Props {
  initialProjects:   Project[]
  initialTasks:      Task[]
  initialUsers:      User[]
  initialStatuses:   Status[]
  initialPriorities: Priority[]
  currentUser:       SessionUser
}

export default function DashboardClient({
  initialProjects, initialTasks, initialUsers,
  initialStatuses, initialPriorities, currentUser
}: Props) {
  const router = useRouter()

  const [view, setView]               = useState<View>('kanban')
  const [projects, setProjects]       = useState(initialProjects)
  const [tasks, setTasks]             = useState(initialTasks)
  const [users, setUsers]             = useState(initialUsers)
  const [statuses, setStatuses]       = useState(initialStatuses)
  const [priorities, setPriorities]   = useState(initialPriorities)
  const [activeProject, setActiveProject] = useState<string>('all')
  const [selectedTask, setSelectedTask]   = useState<Task | null>(null)
  const [search, setSearch]           = useState('')
  const [searchOpen, setSearchOpen]   = useState(false)
  const [searchResults, setSearchResults] = useState<Task[]>([])

  // Modal states
  const [taskModalOpen, setTaskModalOpen]     = useState(false)
  const [editingTask, setEditingTask]         = useState<Task | null>(null)
  const [profileOpen, setProfileOpen]         = useState(false)
  const [adminOpen, setAdminOpen]             = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [statusModalOpen, setStatusModalOpen] = useState(false)

  // Refresh from server
  const refresh = useCallback(async () => {
    const [tRes, pRes] = await Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ])
    if (Array.isArray(tRes)) setTasks(tRes)
    if (Array.isArray(pRes)) setProjects(pRes)
  }, [])

  // Poll every 30s
  useEffect(() => {
    const id = setInterval(refresh, 30000)
    return () => clearInterval(id)
  }, [refresh])

  // Global search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const q = search.toLowerCase()
    setSearchResults(
      tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.project?.name?.toLowerCase().includes(q) ||
        t.assignee?.name?.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q)
      ).slice(0, 8)
    )
  }, [search, tasks])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'n' || e.key === 'N') { setEditingTask(null); setTaskModalOpen(true) }
      if (e.key === '/') { e.preventDefault(); setSearchOpen(true) }
      if (e.key === 'Escape') {
        setTaskModalOpen(false); setSelectedTask(null)
        setProfileOpen(false); setAdminOpen(false)
        setSearch(''); setSearchOpen(false)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTask) {
        e.preventDefault(); deleteTask(selectedTask.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedTask])

  // Filtered tasks
  const filteredTasks = activeProject === 'all'
    ? tasks
    : tasks.filter(t => t.project_id === activeProject)

  // Project health
  const getHealth = (projectId: string) => {
    const pts = tasks.filter(t => t.project_id === projectId)
    if (!pts.length) return 'none'
    const doneStatus = statuses.find(s => s.is_done)
    const overdue = pts.filter(t => t.due_date && !statuses.find(s => s.name === t.status)?.is_done && new Date(t.due_date) < new Date())
    if (overdue.length) return 'red'
    const active = pts.filter(t => t.status !== 'Backlog' && !statuses.find(s => s.name === t.status)?.is_done)
    if (active.length) return 'yellow'
    return 'green'
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task? This cannot be undone.')) return
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks(ts => ts.filter(t => t.id !== id))
      setSelectedTask(null)
      toast.success('Task deleted')
    }
  }

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(ts => ts.map(t => t.id === id ? { ...t, ...updated } : t))
      if (selectedTask?.id === id) setSelectedTask(t => t ? { ...t, ...updated } : t)
    }
  }

  async function signOut() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    router.push('/login')
  }

  const healthColors: Record<string, string> = { green: '#2dce89', yellow: '#ffb800', red: '#ff4757', none: '#9aa5cc' }

  // Stats
  const done     = filteredTasks.filter(t => statuses.find(s => s.name === t.status)?.is_done).length
  const inProg   = filteredTasks.filter(t => !statuses.find(s => s.name === t.status)?.is_done && t.status !== 'Backlog').length
  const overdue  = filteredTasks.filter(t => t.due_date && !statuses.find(s => s.name === t.status)?.is_done && new Date(t.due_date) < new Date()).length
  const avgProg  = filteredTasks.length ? Math.round(filteredTasks.reduce((a, t) => a + t.progress, 0) / filteredTasks.length) : 0

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── HEADER ───────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3 px-5 h-14 bg-surface border-b border-border flex-shrink-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
               style={{ background: 'linear-gradient(135deg,#2d3561,#4f8eff)' }}>✏</div>
          <span className="font-syne font-extrabold text-base text-accent tracking-tight">LINEWORK</span>
        </div>

        {/* View tabs */}
        <div className="flex gap-1">
          {(['kanban','timeline','list','overview'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all capitalize
                ${view === v ? 'bg-surface3 text-accent' : 'text-text3 hover:text-text2 hover:bg-surface2'}`}>
              {v === 'kanban' ? '⊞ Kanban' : v === 'timeline' ? '▬ Timeline' : v === 'list' ? '≡ List' : '📋 Overview'}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search */}
          <div className="relative">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              placeholder="Search…"
              className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-[11px] font-mono text-text1 placeholder-text3 outline-none focus:border-accent w-36 focus:w-52 transition-all"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1.5 bg-surface border border-border rounded-xl shadow-2xl z-50 w-72 overflow-hidden">
                {searchResults.map(t => (
                  <button key={t.id} onClick={() => { setSelectedTask(t); setSearch(''); setSearchOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface2 border-b border-border last:border-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.project?.color || '#4a5275' }} />
                    <div>
                      <div className="text-text1 text-xs font-medium truncate">{t.title}</div>
                      <div className="text-text3 text-[10px]">{t.project?.name} · {t.status}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { setEditingTask(null); setTaskModalOpen(true) }}
            className="btn-ghost text-[11px] px-2.5 py-1.5" title="Team">👥</button>
          <button onClick={() => setStatusModalOpen(true)}
            className="btn-ghost text-[11px] px-2.5 py-1.5" title="Statuses">⬡</button>
          <button onClick={() => setProjectModalOpen(true)}
            className="btn-ghost text-[11px] px-2.5 py-1.5" title="Projects">📁</button>
          {currentUser.isAdmin && (
            <button onClick={() => setAdminOpen(true)}
              className="btn-ghost text-[11px] px-2.5 py-1.5" title="Admin">🔐</button>
          )}

          {/* User chip */}
          <button onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-border bg-surface2 hover:border-accent transition-all">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                 style={{ background: currentUser.color }}>{currentUser.initials}</div>
            <span className="text-text1 text-[11px] font-semibold">{currentUser.name.split(' ')[0]}</span>
          </button>

          <button onClick={() => { setEditingTask(null); setTaskModalOpen(true) }}
            className="btn-primary text-xs px-3.5 py-1.5">+ Task</button>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <nav className="w-52 flex-shrink-0 bg-surface border-r border-border overflow-y-auto flex flex-col">
          <div className="px-4 pt-4 pb-2 text-[9px] uppercase tracking-widest text-text3">Projects</div>

          {/* All Projects */}
          <button onClick={() => setActiveProject('all')}
            className={`flex items-center gap-2.5 px-4 py-2.5 text-xs transition-all border-l-2
              ${activeProject === 'all' ? 'border-accent text-text1 bg-surface2' : 'border-transparent text-text3 hover:text-text2 hover:bg-surface2'}`}>
            <span className="font-semibold">All Projects</span>
            <span className="ml-auto bg-surface3 text-text3 text-[9px] px-1.5 py-0.5 rounded-full">{tasks.length}</span>
          </button>

          {projects.map(p => {
            const count  = tasks.filter(t => t.project_id === p.id).length
            const health = getHealth(p.id)
            return (
              <button key={p.id} onClick={() => setActiveProject(p.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-xs transition-all border-l-2 group
                  ${activeProject === p.id ? 'border-accent text-text1 bg-surface2' : 'border-transparent text-text3 hover:text-text2 hover:bg-surface2'}`}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                <span className="truncate flex-1 text-left">{p.name}</span>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: healthColors[health] }} />
                <span className="bg-surface3 text-text3 text-[9px] px-1.5 py-0.5 rounded-full">{count}</span>
              </button>
            )
          })}
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-hidden flex flex-col">

          {/* Stats bar */}
          <div className="grid grid-cols-5 gap-3 px-6 py-4 flex-shrink-0 border-b border-border">
            {[
              { label: 'Total Tasks',  value: filteredTasks.length, color: 'text-text1' },
              { label: 'Completed',    value: `${filteredTasks.length ? Math.round(done/filteredTasks.length*100) : 0}%`, color: 'text-green' },
              { label: 'In Progress',  value: inProg,   color: 'text-accent' },
              { label: 'Overdue',      value: overdue,  color: overdue > 0 ? 'text-red' : 'text-text1' },
              { label: 'Avg Progress', value: `${avgProg}%`, color: 'text-accent2' },
            ].map(s => (
              <div key={s.label} className="bg-surface border border-border rounded-xl px-4 py-3">
                <div className="text-text3 text-[9px] uppercase tracking-widest mb-1.5">{s.label}</div>
                <div className={`font-syne font-extrabold text-2xl ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Active project bar */}
          {activeProject !== 'all' && (
            <div className="flex items-center gap-2 px-6 py-2 bg-surface2 border-b border-border flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: projects.find(p=>p.id===activeProject)?.color }} />
              <span className="text-text2 text-xs font-semibold">{projects.find(p=>p.id===activeProject)?.name}</span>
              <button onClick={() => setActiveProject('all')} className="ml-auto text-text3 text-[10px] hover:text-text2">✕ Clear filter</button>
            </div>
          )}

          {/* View content */}
          <div className="flex-1 overflow-hidden">
            {view === 'kanban' && (
              <KanbanView tasks={filteredTasks} statuses={statuses} projects={projects} users={users}
                onTaskClick={setSelectedTask} onUpdateTask={updateTask} onAddTask={() => setTaskModalOpen(true)}
                onRefresh={refresh} />
            )}
            {view === 'timeline' && (
              <TimelineView tasks={filteredTasks} projects={projects} onTaskClick={setSelectedTask} />
            )}
            {view === 'list' && (
              <ListView tasks={filteredTasks} statuses={statuses} priorities={priorities}
                projects={projects} users={users} onTaskClick={setSelectedTask}
                onUpdateTask={updateTask} onDeleteTask={deleteTask} onRefresh={refresh} />
            )}
            {view === 'overview' && (
              <OverviewView tasks={tasks} projects={projects} statuses={statuses}
                users={users} onTaskClick={setSelectedTask} />
            )}
          </div>
        </main>
      </div>

      {/* ── PANELS & MODALS ──────────────────────────────────── */}
      {selectedTask && (
        <TaskDetail task={selectedTask} tasks={tasks} users={users} statuses={statuses}
          priorities={priorities} projects={projects} currentUser={currentUser}
          onClose={() => setSelectedTask(null)} onUpdate={updateTask}
          onDelete={deleteTask} onEdit={t => { setEditingTask(t); setTaskModalOpen(true) }}
          onRefresh={refresh} />
      )}

      {taskModalOpen && (
        <TaskModal tasks={tasks} projects={projects} users={users} statuses={statuses}
          priorities={priorities} editTask={editingTask} currentUser={currentUser}
          activeProject={activeProject} onClose={() => { setTaskModalOpen(false); setEditingTask(null) }}
          onSaved={async () => { await refresh(); setTaskModalOpen(false); setEditingTask(null) }} />
      )}

      {profileOpen && (
        <ProfilePanel currentUser={currentUser} onClose={() => setProfileOpen(false)}
          onSignOut={signOut} onUpdated={() => router.refresh()} />
      )}

      {adminOpen && (
        <AdminModal users={users} onClose={() => setAdminOpen(false)}
          onUpdated={async () => {
            const data = await fetch('/api/users').then(r => r.json())
            if (Array.isArray(data)) setUsers(data)
          }} />
      )}

      {projectModalOpen && (
        <ProjectModal projects={projects} onClose={() => setProjectModalOpen(false)}
          onUpdated={async () => {
            const data = await fetch('/api/projects').then(r => r.json())
            if (Array.isArray(data)) setProjects(data)
          }} />
      )}

      {statusModalOpen && (
        <StatusModal statuses={statuses} priorities={priorities}
          onClose={() => setStatusModalOpen(false)}
          onUpdated={async () => {
            const [s, p] = await Promise.all([
              fetch('/api/statuses').then(r => r.json()),
              fetch('/api/priorities').then(r => r.json()),
            ])
            if (Array.isArray(s)) setStatuses(s)
            if (Array.isArray(p)) setPriorities(p)
          }} />
      )}

      {/* Copyright bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border px-5 py-1.5 flex items-center justify-between text-[9px] text-text3 pointer-events-none">
        <span>© 2026 Kahlil Ambrose · CIE Ltd. Projects Department</span>
        <span>Linework™ — Proprietary software. Unauthorised use prohibited.</span>
      </div>
    </div>
  )
}
