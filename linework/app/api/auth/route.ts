import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hashPin, verifyPin, createSession, clearSession, getSession } from '@/lib/auth'

// GET /api/auth — get current session
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ user: null })
  return NextResponse.json({ user: session })
}

// POST /api/auth — login or setup
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  // ── SETUP: create first admin ──────────────────────────────
  if (action === 'setup') {
    const { name, initials, color, pin } = body

    // Check no users exist
    const { count } = await supabaseAdmin
      .from('users').select('*', { count: 'exact', head: true })
    if (count && count > 0) {
      return NextResponse.json({ error: 'Setup already complete' }, { status: 400 })
    }

    const pin_hash = await hashPin(pin)
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({ name, initials, color, pin_hash, is_admin: true })
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await createSession(user)
    return NextResponse.json({ user })
  }

  // ── LOGIN ──────────────────────────────────────────────────
  if (action === 'login') {
    const { userId, pin } = body

    const { data: user, error } = await supabaseAdmin
      .from('users').select('*').eq('id', userId).single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const valid = await verifyPin(pin, user.pin_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
    }

    await createSession(user)

    // Update presence
    await supabaseAdmin.from('presence').upsert({
      user_id: user.id, user_name: user.name,
      initials: user.initials, color: user.color, last_seen: new Date().toISOString()
    })

    return NextResponse.json({ user: { id: user.id, name: user.name, initials: user.initials, color: user.color, is_admin: user.is_admin } })
  }

  // ── LOGOUT ────────────────────────────────────────────────
  if (action === 'logout') {
    const session = await getSession()
    if (session) {
      await supabaseAdmin.from('presence').delete().eq('user_id', session.sub)
    }
    await clearSession()
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
