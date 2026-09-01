import React from 'react'

const STATUS_CONFIG = {
  idle:             { label: 'Idle',             cls: 'badge-gray',   icon: '○' },
  offered:          { label: 'Offer Open',        cls: 'badge-blue',   icon: '📢' },
  locked:           { label: 'Order Locked',      cls: 'badge-yellow', icon: '🔒' },
  paid:             { label: 'Fiat Paid',         cls: 'badge-purple', icon: '💸' },
  released:         { label: 'Released',          cls: 'badge-green',  icon: '✅' },
  disputed:         { label: 'Disputed',          cls: 'badge-red',    icon: '⚠️' },
  settled:          { label: 'Settled',           cls: 'badge-green',  icon: '🏁' },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'badge-gray', icon: '?' }
  return (
    <span className={`status-badge ${cfg.cls}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}
