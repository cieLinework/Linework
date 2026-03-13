import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { DRAWING_STAGE_TEMPLATES } from '@/types'

// POST /api/tasks/[id]/comments
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { text, author_name } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Comment text required' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('comments').insert({
    task_id: params.id,
    author_id: session.sub,
    author_name: author_name || session.name,
    text: text.trim()
  }).select('*, author:users!author_id(id,name,initials,color)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
