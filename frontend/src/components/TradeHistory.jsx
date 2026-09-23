import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { getAllTrades, getMyTrades, fmt, shortAddr } from '../p2pClient.js'
import StatusBadge from './StatusBadge.jsx'

export default function TradeHistory({ onViewTrade, defaultTab }) {
  const { address } = useWallet()
  const [tab, setTab] = useState(defaultTab === 'mine' ? 'mine' : 'all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = tab === 'mine' && address ? await getMyTrades(address) : await getAllTrades()
      setRows(Array.isArray(list) ? list : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [tab, address])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="buku-kas">
      <div className="board-header">
        <div>
          <h2 className="board-title">{tab === 'mine' ? 'Transaksiku' : 'Buku Kas'}</h2>
          <p className="board-subtitle">{rows.length} nota</p>
        </div>
        <div className="tab-row">
          <button className={`nav-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>Semua</button>
          <button className={`nav-btn ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')} disabled={!address}>Punyaku</button>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>{loading ? '…' : '↻'}</button>
        </div>
      </div>

      {rows.length === 0 && !loading && (
        <div className="empty-state"><p className="empty-big">Belum ada catatan.</p></div>
      )}

      <div className="kas-daftar">
        {rows.map(t => (
          <button key={t.trade_id} className="kas-baris" onClick={() => onViewTrade?.(Number(t.trade_id))}>
            <span className="kas-no mono">#{t.trade_id}</span>
            <span className="kas-jumlah mono">{fmt.fmtWei(t.crypto_amount)} {t.token}</span>
            <span className="kas-arah">⇄ Rp{Number(t.fiat_amount).toLocaleString('id-ID')}</span>
            <span className="kas-pihak mono">{shortAddr(t.seller)} → {shortAddr(t.buyer)}</span>
            <StatusBadge status={t.status} />
          </button>
        ))}
      </div>
    </div>
  )
}
