'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { SessionUser } from '@/types'

const SWATCHES = ['#4f8eff','#7c5cfc','#2dce89','#ffb800','#ff4757','#ff7730','#e91e8c','#00c9b1','#b000ff','#a0a8c0']

interface Props {
  currentUser: SessionUser
  onClose: () => void; onSignOut: () => void; onUpdated: () => void
}

export default function ProfilePanel({ currentUser, onClose, onSignOut, onUpdated }: Props) {
  const [name, setName]           = useState(currentUser.name)
  const [initials, setInitials]   = useState(currentUser.initials)
  const [color, setColor]         = useState(currentUser.color)
  const [curPin, setCurPin]       = useState('')
  const [newPin, setNewPin]       = useState('')
  const [confPin, setConfPin]     = useState('')
  const [saving, setSaving]       = useState(false)

  async function saveProfile() {
    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, initials: initials.toUpperCase(), color })
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
      toast.success('Profile updated')
      onUpdated()
    } finally { setSaving(false) }
  }

  async function changePin() {
    if (!curPin || !newPin || !confPin) { toast.error('Fill in all PIN fields'); return }
    if (newPin !== confPin) { toast.error('New PINs do not match'); return }
    if (!/^\d{4}$/.test(newPin)) { toast.error('PIN must be 4 digits'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin, currentPin: curPin })
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
      toast.success('PIN updated')
      setCurPin(''); setNewPin(''); setConfPin('')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute top-14 right-4 w-72 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden slide-in">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: color }}>{initials || currentUser.initials}</div>
          <div>
            <div className="text-text1 text-sm font-bold font-syne">{currentUser.name}</div>
            <div className="text-text3 text-[10px]">CIE Projects Department</div>
          </div>
          <button onClick={onClose} className="ml-auto text-text3 hover:text-text1">✕</button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          {/* Edit profile */}
          <div className="px-5 py-4 border-b border-border">
            <div className="text-text3 text-[9px] uppercase tracking-widest mb-3">Edit Profile</div>
            <div className="flex flex-col gap-2.5">
              <input className="input text-xs py-1.5" value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
              <input className="input text-xs py-1.5 uppercase" maxLength={3} value={initials}
                onChange={e => setInitials(e.target.value.toUpperCase())} placeholder="Initials" />
              <div>
                <div className="text-text3 text-[10px] mb-2">Colour</div>
                <div className="flex gap-2 flex-wrap">
                  {SWATCHES.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className="w-5 h-5 rounded-full transition-all"
                      style={{ background: c, border: `2px solid ${c === color ? '#fff' : 'transparent'}`, transform: c === color ? 'scale(1.2)' : 'scale(1)' }} />
                  ))}
                </div>
              </div>
              <button className="btn-primary text-xs py-1.5 w-full" onClick={saveProfile} disabled={saving}>
                Save Changes
              </button>
            </div>
          </div>

          {/* Change PIN */}
          <div className="px-5 py-4 border-b border-border">
            <div className="text-text3 text-[9px] uppercase tracking-widest mb-3">Change PIN</div>
            <div className="flex flex-col gap-2">
              <input className="input text-xs py-1.5" type="password" inputMode="numeric" maxLength={4}
                value={curPin} onChange={e => setCurPin(e.target.value)} placeholder="Current PIN" />
              <input className="input text-xs py-1.5" type="password" inputMode="numeric" maxLength={4}
                value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="New PIN (4 digits)" />
              <input className="input text-xs py-1.5" type="password" inputMode="numeric" maxLength={4}
                value={confPin} onChange={e => setConfPin(e.target.value)} placeholder="Confirm new PIN" />
              <button className="btn-ghost text-xs py-1.5 w-full" onClick={changePin} disabled={saving}>
                Update PIN
              </button>
            </div>
          </div>

          {/* Sign out */}
          <div className="px-5 py-4">
            <button onClick={onSignOut}
              className="w-full btn-ghost text-xs text-red border-red/30 hover:bg-red/10">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
