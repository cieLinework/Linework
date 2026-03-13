import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

// GET /api/presence — who's online (last seen within 2 minutes)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('presence')
    .select('user_id, user_name, initials, color, last_seen')
    .gte('last_seen', twoMinsAgo)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/presence — heartbeat
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { error } = await supabaseAdmin.from('presence').upsert({
    user_id:   session.sub,
    user_name: session.name,
    initials:  session.initials,
    color:     session.color,
    last_seen: new Date().toISOString()
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
