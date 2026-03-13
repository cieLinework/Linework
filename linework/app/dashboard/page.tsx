import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import DashboardClient from './DashboardClient'
import { supabaseAdmin } from '@/lib/supabase'

export default async function DashboardLayout() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Load initial data server-side
  const [projects, tasks, users, statuses, priorities] = await Promise.all([
    supabaseAdmin.from('projects').select('*').order('name').then(r => r.data || []),
    supabaseAdmin.from('tasks').select(`
      *,
      project:projects(id,name,color),
      assignee:users!assignee_id(id,name,initials,color),
      comments(id,author_name,text,created_at),
      drawing_stages(id,stage_key,collapsed,sort_order,items:drawing_items(id,name,progress,sort_order))
    `).order('created_at', { ascending: false }).then(r => r.data || []),
    supabaseAdmin.from('users').select('id,name,initials,color,is_admin,email').order('created_at').then(r => r.data || []),
    supabaseAdmin.from('statuses').select('*').order('sort_order').then(r => r.data || []),
    supabaseAdmin.from('priorities').select('*').order('sort_order').then(r => r.data || []),
  ])

  // Get task dependencies
  const taskIds = tasks.map((t: { id: string }) => t.id)
  const { data: deps } = taskIds.length
    ? await supabaseAdmin.from('task_dependencies').select('task_id,blocked_by_id').in('task_id', taskIds)
    : { data: [] }

  const depsMap: Record<string, string[]> = {}
  ;(deps || []).forEach((d: { task_id: string; blocked_by_id: string }) => {
    if (!depsMap[d.task_id]) depsMap[d.task_id] = []
    depsMap[d.task_id].push(d.blocked_by_id)
  })

  const tasksWithDeps = tasks.map((t: Record<string, unknown>) => ({
    ...t,
    blocked_by: depsMap[t.id as string] || [],
    drawing_stages: (t.drawing_stages as { sort_order: number }[] || [])
      .sort((a, b) => a.sort_order - b.sort_order)
  }))

  return (
    <DashboardClient
      initialProjects={projects}
      initialTasks={tasksWithDeps}
      initialUsers={users}
      initialStatuses={statuses}
      initialPriorities={priorities}
      currentUser={session}
    />
  )
}
