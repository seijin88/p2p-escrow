import React from 'react'

const STEMPEL = {
  open:      'BUKA',
  locked:    'TERKUNCI',
  released:  'RILIS ✓',
  refunded:  'REFUND',
  cancelled: 'BATAL',
  expired:   'KEDALUWARSA',
}

export default function StatusBadge({ status }) {
  return <span className={`stempel st-${status || 'unknown'}`}>{STEMPEL[status] || status}</span>
}
