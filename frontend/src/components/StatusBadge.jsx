import React from 'react'

const STATUS_CONFIG = {
  idle:             { label: 'Idle',             cls: 'badge-gray'   },
  offered:          { label: 'Offer Open',        cls: 'badge-blue'   },
  locked:           { label: 'Order Locked',      cls: 'badge-yellow' },
  paid:             { label: 'Fiat Paid',         cls: 'badge-purple' },
  released:         { label: 'Released',          cls: 'badge-green'  },
  disputed:         { label: 'Disputed',          cls: 'badge-red'    },
  arbitrated:       { label: 'AI Decided',         cls: 'badge-purple' },
  settled:          { label: 'Settled',           cls: 'badge-green'  },
  finalized:         { label: 'Finalized',          cls: 'badge-green'  },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, cls: 'badge-gray' }
  return (
    <span className={`status-badge ${cfg.cls}`}>{cfg.label}</span>
  )
}
