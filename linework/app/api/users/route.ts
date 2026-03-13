import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPin, getSession } from '@/lib/auth'

// GET /api/users — list all users (public for login screen)
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, initials, color, is_admin, email')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/users — add user (admin only)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, initials, color, pin, email } = await req.json()
  if (!name || !initials || !pin) {
    return NextResponse.json({ error: 'Name, initials and PIN required' }, { status: 400 })
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
  }

  const pin_hash = await hashPin(pin)
  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({ name, initials, color: color || '#4f8eff', pin_hash, is_admin: false, email })
    .select('id, name, initials, color, is_admin, email').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/users — update own profile
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { name, initials, color, pin, currentPin } = await req.json()
  const updates: Record<string, string> = {}

  if (name) updates.name = name
  if (initials) updates.initials = initials
  if (color) updates.color = color

  if (pin) {
    // Verify current PIN first
    const { data: user } = await supabaseAdmin
      .from('users').select('pin_hash').eq('id', session.sub).single()
    const { verifyPin } = await import('@/lib/auth')
    const valid = await verifyPin(currentPin, user?.pin_hash || '')
    if (!valid) return NextResponse.json({ error: 'Current PIN incorrect' }, { status: 401 })
    if (!/^\d{4}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4 digits' }, { status: 400 })
    updates.pin_hash = await hashPin(pin)
  }

  const { data, error } = await supabaseAdmin
    .from('users').update(updates).eq('id', session.sub)
    .select('id, name, initials, color, is_admin').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
