'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { User } from '@/types'

const SWATCHES = ['#4f8eff','#7c5cfc','#2dce89','#ffb800','#ff4757','#ff7730','#e91e8c','#00c9b1','#b000ff','#a0a8c0']

interface Props { users: User[]; onClose: () => void; onUpdated: () => Promise<void> }

export default function AdminModal({ users, onClose, onUpdated }: Props) {
  const [name, setName]         = useState('')
  const [initials, setInitials] = useState('')
  const [pin, setPin]           = useState('')
  const [color, setColor]       = useState('#4f8eff')
  const [adding, setAdding]     = useState(false)

  async function addUser() {
    if (!name || !initials || !pin) { toast.error('All fields required'); return }
    if (!/^\d{4}$/.test(pin)) { toast.error('PIN must be 4 digits'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, initials: initials.toUpperCase(), pin, color })
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error); return }
      toast.success(`${name} added`)
      setName(''); setInitials(''); setPin(''); setColor('#4f8eff')
      await onUpdated()
    } finally { setAdding(false) }
  }

  async function resetPin(userId: string, userName: string) {
    const pin = prompt(`Enter new 4-digit PIN for ${userName}:`)
    if (!pin) return
    if (!/^\d{4}$/.test(pin)) { toast.error('PIN must be 4 digits'); return }
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    })
    if (res.ok) { toast.success('PIN reset'); await onUpdated() }
  }

  async function removeUser(userId: string, userName: string) {
    if (!confirm(`Remove ${userName}? They will no longer be able to log in.`)) return
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    if (res.ok) { toast.success(`${userName} removed`); await onUpdated() }
    else { const d = await res.json(); toast.error(d.error) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal w-[560px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-syne font-bold text-base text-text1">🔐 Admin — User Management</h2>
          <button onClick={onClose} className="text-text3 hover:text-text1 text-lg">✕</button>
        </div>

        {/* User list */}
        <div className="max-h-64 overflow-y-auto divide-y divide-border">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-6 py-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: u.color }}>{u.initials}</div>
              <div className="flex-1">
                <div className="text-text1 text-sm font-semibold">
                  {u.name} {u.is_admin && <span className="text-accent text-[9px] font-normal ml-1">ADMIN</span>}
                </div>
                <div className="text-text3 text-[10px]">{u.email || 'No email set'}</div>
              </div>
              <button onClick={() => resetPin(u.id, u.name)}
                className="btn-ghost text-[10px] px-2.5 py-1">Reset PIN</button>
              {!u.is_admin && (
                <button onClick={() => removeUser(u.id, u.name)}
                  className="btn-ghost text-[10px] px-2.5 py-1 text-red border-red/30 hover:bg-red/10">Remove</button>
              )}
            </div>
          ))}
        </div>

        {/* Add user */}
        <div className="px-6 py-4 border-t border-border">
          <div className="text-text3 text-[10px] uppercase tracking-widest mb-3">Add New User</div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className="input text-xs py-1.5" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            <input className="input text-xs py-1.5 uppercase" maxLength={3} value={initials}
              onChange={e => setInitials(e.target.value.toUpperCase())} placeholder="Initials" />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input className="input text-xs py-1.5" type="password" inputMode="numeric" maxLength={4}
              value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN (4 digits)" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {SWATCHES.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-full transition-all flex-shrink-0"
                  style={{ background: c, border: `2px solid ${c === color ? '#fff' : 'transparent'}`, transform: c === color ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>
          <button className="btn-primary text-xs w-full py-2" onClick={addUser} disabled={adding}>
            {adding ? 'Adding…' : 'Add User'}
          </button>
        </div>

        <div className="px-6 py-3 border-t border-border flex justify-end">
          <button className="btn-ghost text-xs" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
