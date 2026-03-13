import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// PATCH /api/tasks/[id]/drawings — update a single drawing item progress
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { stageId, itemId, progress } = await req.json()

  // Update the drawing item
  const { error } = await supabaseAdmin
    .from('drawing_items').update({ progress }).eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalculate overall task progress
  const { data: stages } = await supabaseAdmin
    .from('drawing_stages')
    .select('id, stage_key, collapsed, sort_order, items:drawing_items(id, name, progress, sort_order)')
    .eq('task_id', params.id)
    .order('sort_order')

  const allItems = (stages || []).flatMap((s: { items: { progress: number }[] }) => s.items)
  const overallProgress = allItems.length
    ? Math.round(allItems.reduce((a, i) => a + i.progress, 0) / allItems.length)
    : 0

  // Update task progress
  await supabaseAdmin.from('tasks').update({ progress: overallProgress }).eq('id', params.id)

  return NextResponse.json({ stages, overallProgress })
}
