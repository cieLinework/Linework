import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function RootPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  // Check if any users exist — if not, redirect to setup
  const { count } = await supabaseAdmin
    .from('users').select('*', { count: 'exact', head: true })

  if (!count || count === 0) redirect('/login?setup=1')
  redirect('/login')
}
