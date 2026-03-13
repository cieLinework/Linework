'use client'

import type { Status, Priority } from '@/types'

interface Props {
  statuses: Status[]; priorities: Priority[]
  onClose: () => void; onUpdated: () => Promise<void>
}

export default function StatusModal({ statuses, priorities, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal w-[480px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-syne font-bold text-base text-text1">⬡ Statuses & Priorities</h2>
          <button onClick={onClose} className="text-text3 hover:text-text1 text-lg">✕</button>
        </div>

        <div className="px-6 py-4">
          <div className="text-text3 text-[10px] uppercase tracking-widest mb-3">Statuses</div>
          <div className="flex flex-col gap-2 mb-5">
            {statuses.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border">
                <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                <span className="text-text1 text-sm flex-1">{s.name}</span>
                {s.is_done && <span className="text-green text-[10px]">✓ Done</span>}
              </div>
            ))}
          </div>

          <div className="text-text3 text-[10px] uppercase tracking-widest mb-3">Priorities</div>
          <div className="flex flex-col gap-2">
            {priorities.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface2 border border-border">
                <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                <span className="text-text1 text-sm flex-1">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border flex justify-end">
          <button className="btn-ghost text-xs" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
