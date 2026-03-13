import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPin, getSession } from '@/lib/auth'

// PATCH /api/users/[id] — admin: reset PIN or toggle admin
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { pin, is_admin } = await req.json()
  const updates: Record<string, unknown> = {}

  if (pin !== undefined) {
    if (!/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
    updates.pin_hash = await hashPin(pin)
  }
  if (is_admin !== undefined) updates.is_admin = is_admin

  const { data, error } = await supabaseAdmin
    .from('users').update(updates).eq('id', params.id)
    .select('id, name, initials, color, is_admin').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/users/[id] — admin remove user
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (params.id === session.sub) return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })

  const { error } = await supabaseAdmin.from('users').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
