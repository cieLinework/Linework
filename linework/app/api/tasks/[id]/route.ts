import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// PATCH /api/tasks/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { blocked_by, ...taskData } = body

  const { data, error } = await supabaseAdmin
    .from('tasks').update(taskData).eq('id', params.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update dependencies
  if (blocked_by !== undefined) {
    await supabaseAdmin.from('task_dependencies').delete().eq('task_id', params.id)
    if (blocked_by.length > 0) {
      await supabaseAdmin.from('task_dependencies').insert(
        blocked_by.map((bid: string) => ({ task_id: params.id, blocked_by_id: bid }))
      )
    }
  }

  return NextResponse.json(data)
}

// DELETE /api/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { error } = await supabaseAdmin.from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
