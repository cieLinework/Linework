'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

const SWATCHES = ['#4f8eff','#7c5cfc','#2dce89','#ffb800','#ff4757','#ff7730','#e91e8c','#00c9b1','#b000ff','#a0a8c0']

interface UserCard { id: string; name: string; initials: string; color: string; is_admin: boolean }

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const isSetup = params.get('setup') === '1'

  const [users, setUsers]           = useState<UserCard[]>([])
  const [step, setStep]             = useState<'pick' | 'pin' | 'setup'>(isSetup ? 'setup' : 'pick')
  const [selected, setSelected]     = useState<UserCard | null>(null)
  const [pin, setPin]               = useState('')
  const [pinError, setPinError]     = useState('')
  const [shaking, setShaking]       = useState(false)
  const [loading, setLoading]       = useState(false)

  // Setup form
  const [setupName, setSetupName]         = useState('')
  const [setupInitials, setSetupInitials] = useState('')
  const [setupPin, setSetupPin]           = useState('')
  const [setupPinConf, setSetupPinConf]   = useState('')
  const [setupColor, setSetupColor]       = useState('#4f8eff')
  const [setupError, setSetupError]       = useState('')

  useEffect(() => {
    if (!isSetup) {
      fetch('/api/users').then(r => r.json()).then(data => {
        if (Array.isArray(data)) setUsers(data)
      })
    }
  }, [isSetup])

  const selectUser = (u: UserCard) => {
    setSelected(u)
    setPin('')
    setPinError('')
    setStep('pin')
  }

  const pressPin = useCallback((n: string) => {
    setPin(prev => {
      const next = prev.length < 4 ? prev + n : prev
      return next
    })
  }, [])

  const backPin  = () => setPin(p => p.slice(0, -1))
  const clearPin = () => setPin('')

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && step === 'pin') {
      const timer = setTimeout(() => attemptLogin(), 150)
      return () => clearTimeout(timer)
    }
  }, [pin, step])

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (step !== 'pin') return
      if (e.key >= '0' && e.key <= '9') pressPin(e.key)
      if (e.key === 'Backspace') backPin()
      if (e.key === 'Escape') { setStep('pick'); setPin('') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, pressPin])

  async function attemptLogin() {
    if (!selected || pin.length !== 4) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', userId: selected.id, pin })
      })
      const data = await res.json()
      if (!res.ok) {
        setShaking(true)
        setPinError(data.error || 'Incorrect PIN')
        setPin('')
        setTimeout(() => { setShaking(false); setPinError('') }, 1500)
      } else {
        toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`)
        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  async function completeSetup() {
    setSetupError('')
    if (!setupName)                           { setSetupError('Please enter your full name'); return }
    if (!setupInitials || setupInitials.length < 2) { setSetupError('Initials must be 2–3 characters'); return }
    if (!/^\d{4}$/.test(setupPin))            { setSetupError('PIN must be exactly 4 digits'); return }
    if (setupPin !== setupPinConf)            { setSetupError('PINs do not match'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', name: setupName, initials: setupInitials.toUpperCase(), color: setupColor, pin: setupPin })
      })
      const data = await res.json()
      if (!res.ok) { setSetupError(data.error || 'Setup failed'); return }
      toast.success(`Welcome to Linework, ${setupName.split(' ')[0]}!`)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg">
      <div className="w-[400px] max-w-[96vw] bg-surface border border-border rounded-2xl p-10 shadow-2xl fade-in">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
               style={{ background: 'linear-gradient(135deg,#2d3561,#4f8eff)' }}>✏</div>
          <span className="font-syne font-extrabold text-2xl text-accent tracking-tight">LINEWORK</span>
        </div>
        <p className="text-text3 text-xs mb-8">CIE Ltd. Projects Department</p>

        {/* ── SETUP WIZARD ── */}
        {step === 'setup' && (
          <div className="fade-in">
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 mb-6 text-xs text-text2 leading-relaxed">
              👋 <strong className="text-text1">Welcome!</strong> Set up the administrator account to get started.
            </div>
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Full Name</label>
                <input className="input" value={setupName} onChange={e => setSetupName(e.target.value)} placeholder="e.g. Kahlil Ambrose" />
              </div>
              <div>
                <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Initials <span className="text-text3 normal-case">(2–3 chars)</span></label>
                <input className="input uppercase" maxLength={3} value={setupInitials} onChange={e => setSetupInitials(e.target.value.toUpperCase())} placeholder="KA" />
              </div>
              <div>
                <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">PIN <span className="text-text3 normal-case">(4 digits)</span></label>
                <input className="input" type="password" inputMode="numeric" maxLength={4} value={setupPin} onChange={e => setSetupPin(e.target.value)} placeholder="••••" />
              </div>
              <div>
                <label className="text-text3 text-[10px] uppercase tracking-widest block mb-1.5">Confirm PIN</label>
                <input className="input" type="password" inputMode="numeric" maxLength={4} value={setupPinConf}
                  onChange={e => setSetupPinConf(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && completeSetup()}
                  placeholder="••••" />
              </div>
              <div>
                <label className="text-text3 text-[10px] uppercase tracking-widest block mb-2">Avatar Colour</label>
                <div className="flex gap-2 flex-wrap">
                  {SWATCHES.map(c => (
                    <button key={c} onClick={() => setSetupColor(c)}
                      className="w-6 h-6 rounded-full transition-all"
                      style={{ background: c, border: `2px solid ${c === setupColor ? '#fff' : 'transparent'}`, transform: c === setupColor ? 'scale(1.25)' : 'scale(1)' }} />
                  ))}
                </div>
              </div>
            </div>
            {setupError && <p className="text-red text-xs mb-3 text-center">{setupError}</p>}
            <button className="btn-primary w-full py-3" onClick={completeSetup} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Administrator Account →'}
            </button>
          </div>
        )}

        {/* ── PICK USER ── */}
        {step === 'pick' && (
          <div className="fade-in">
            <p className="text-text3 text-[10px] uppercase tracking-widest mb-3">Select your profile</p>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {users.length === 0 && (
                <p className="text-text3 text-xs text-center py-6">Loading users…</p>
              )}
              {users.map(u => (
                <button key={u.id} onClick={() => selectUser(u)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface2 hover:border-accent hover:bg-surface3 transition-all text-left">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                       style={{ background: u.color }}>{u.initials}</div>
                  <div>
                    <div className="text-text1 text-sm font-semibold">{u.name}</div>
                    <div className="text-text3 text-xs">{u.is_admin ? 'Administrator' : 'Team Member'}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PIN ENTRY ── */}
        {step === 'pin' && selected && (
          <div className="fade-in">
            {/* Selected user */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border mb-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                   style={{ background: selected.color }}>{selected.initials}</div>
              <div>
                <div className="text-text1 text-sm font-semibold">{selected.name}</div>
                <div className="text-text3 text-xs">Enter your PIN</div>
              </div>
            </div>

            {/* PIN dots */}
            <div className={`flex gap-3 justify-center mb-6 ${shaking ? 'shake' : ''}`}>
              {[0,1,2,3].map(i => (
                <div key={i} className="w-4 h-4 rounded-full border-2 transition-all"
                     style={{
                       background: i < pin.length ? selected.color : 'transparent',
                       borderColor: i < pin.length ? selected.color : 'var(--border)'
                     }} />
              ))}
            </div>

            {/* Error */}
            {pinError && <p className="text-red text-xs text-center mb-3">{pinError}</p>}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1','2','3','4','5','6','7','8','9'].map(n => (
                <button key={n} onClick={() => pressPin(n)}
                  className="py-4 rounded-xl border border-border bg-surface2 text-text1 font-syne font-bold text-xl hover:bg-surface3 hover:border-accent active:scale-95 transition-all">
                  {n}
                </button>
              ))}
              <button onClick={clearPin}
                className="py-4 rounded-xl border border-border bg-surface2 text-text3 text-sm hover:bg-surface3 transition-all">
                Clear
              </button>
              <button onClick={() => pressPin('0')}
                className="py-4 rounded-xl border border-border bg-surface2 text-text1 font-syne font-bold text-xl hover:bg-surface3 hover:border-accent active:scale-95 transition-all">
                0
              </button>
              <button onClick={backPin}
                className="py-4 rounded-xl border border-border bg-surface2 text-text3 text-xl hover:bg-surface3 transition-all">
                ⌫
              </button>
            </div>

            <button onClick={() => { setStep('pick'); setPin(''); setPinError('') }}
              className="text-text3 text-xs w-full text-center hover:text-text2 transition-colors">
              ← Back
            </button>
          </div>
        )}
      </div>

      {/* Copyright */}
      <p className="text-text3 text-[9px] mt-6 text-center">
        © 2026 Kahlil Ambrose · Linework™ · CIE Ltd. Projects Department
      </p>
    </div>
  )
}
