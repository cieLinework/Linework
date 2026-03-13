import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { DRAWING_STAGE_TEMPLATES } from '@/types'

// GET /api/tasks — list tasks with joins
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  let query = supabaseAdmin
    .from('tasks')
    .select(`
      *,
      project:projects(id, name, color),
      assignee:users!assignee_id(id, name, initials, color),
      comments(id, author_name, text, created_at, author:users!author_id(id, name, initials, color)),
      drawing_stages(id, stage_key, collapsed, sort_order, items:drawing_items(id, name, progress, sort_order))
    `)
    .order('created_at', { ascending: false })

  if (projectId && projectId !== 'all') {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach blocked_by for each task
  const taskIds = (data || []).map((t: { id: string }) => t.id)
  const { data: deps } = await supabaseAdmin
    .from('task_dependencies')
    .select('task_id, blocked_by_id')
    .in('task_id', taskIds)

  const depsMap: Record<string, string[]> = {}
  ;(deps || []).forEach((d: { task_id: string; blocked_by_id: string }) => {
    if (!depsMap[d.task_id]) depsMap[d.task_id] = []
    depsMap[d.task_id].push(d.blocked_by_id)
  })

  const tasks = (data || []).map((t: Record<string, unknown>) => ({
    ...t,
    blocked_by: depsMap[t.id as string] || [],
    drawing_stages: (t.drawing_stages as { sort_order: number }[] || []).sort((a, b) => a.sort_order - b.sort_order)
  }))

  return NextResponse.json(tasks)
}

// POST /api/tasks — create task
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { blocked_by, ...taskData } = body

  const { data: task, error } = await supabaseAdmin
    .from('tasks')
    .insert({ ...taskData, created_by: session.sub })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert dependencies
  if (blocked_by?.length) {
    await supabaseAdmin.from('task_dependencies').insert(
      blocked_by.map((bid: string) => ({ task_id: task.id, blocked_by_id: bid }))
    )
  }

  // Auto-create drawing breakdown
  for (let i = 0; i < DRAWING_STAGE_TEMPLATES.length; i++) {
    const tmpl = DRAWING_STAGE_TEMPLATES[i]
    const { data: stage } = await supabaseAdmin
      .from('drawing_stages')
      .insert({ task_id: task.id, stage_key: tmpl.key, collapsed: true, sort_order: i })
      .select().single()

    if (stage) {
      await supabaseAdmin.from('drawing_items').insert(
        tmpl.items.map((name, j) => ({ drawing_stage_id: stage.id, name, progress: 0, sort_order: j }))
      )
    }
  }

  return NextResponse.json(task)
}
