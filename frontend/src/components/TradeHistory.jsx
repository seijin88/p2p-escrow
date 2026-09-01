import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { getTradeHistory, getMyActiveTrades } from '../p2pClient.js'

export default function TradeHistory({ onViewTrade }) {
  const { address }         = useWallet()
  const [tab, setTab]       = useState('all')   // 'all' | 'mine'
  const [history, setHistory] = useState([])
  const [myTrades, setMyTrades] = useState([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(0)
  const [loading, setLoading] = useState(false)
  const PAGE_SIZE = 10

  const fetchAll = useCallback(async (pg = 0) => {
    setLoading(true)
    try {
      const data = await getTradeHistory(pg, PAGE_SIZE)
      setHistory(data?.trades || [])
      setTotal(Number(data?.total || 0))
      setPage(pg)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const fetchMine = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const data = await getMyActiveTrades(address)
      setMyTrades(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [address])

  useEffect(() => {
    if (tab === 'all') fetchAll(0)
    else fetchMine()
  }, [tab, fetchAll, fetchMine])

  const trades = tab === 'all' ? history : myTrades
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="trade-history">
      <div className="history-header">
        <h2 className="board-title">📋 Trade History</h2>
        <div className="history-tabs">
          <button className={`htab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
            All Settled
          </button>
          <button className={`htab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')} disabled={!address}>
            My Trades
          </button>
        </div>
      </div>

      {loading && (
        <div className="empty-state"><span className="spinner">⟳</span><p>Loading…</p></div>
      )}

      {!loading && trades.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>{tab === 'mine' && !address ? 'Connect wallet to see your trades.' : 'No trades yet.'}</p>
        </div>
      )}

      <div className="history-list">
        {trades.map(trade => (
          <TradeRow key={trade.trade_id} trade={trade} address={address} onView={() => onViewTrade?.(trade.trade_id)} />
        ))}
      </div>

      {tab === 'all' && totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" onClick={() => fetchAll(page - 1)} disabled={page === 0 || loading}>
            ← Prev
          </button>
          <span className="page-info">Page {page + 1} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => fetchAll(page + 1)} disabled={page >= totalPages - 1 || loading}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function TradeRow({ trade, address, onView }) {
  const isSeller = address?.toLowerCase() === trade.seller?.toLowerCase()
  const isBuyer  = address?.toLowerCase() === trade.buyer?.toLowerCase()
  const isSettled = trade.status === 'settled'
  const fiatAmt = Number(trade.fiat_amount).toLocaleString()
  const cryptoAmt = formatAmount(trade.crypto_amount)

  return (
    <div className={`history-row ${isSettled ? 'settled' : 'active-trade'}`} onClick={onView}>
      <div className="history-row-left">
        <div className="history-id">#{trade.trade_id}</div>
        <div className="history-amounts">
          <span className="amount">{cryptoAmt} {trade.token}</span>
          <span className="history-arrow">→</span>
          <span className="amount-fiat">{fiatAmt} {trade.fiat_currency}</span>
        </div>
        <div className="history-meta">
          {isSeller && <span className="role-badge seller">You sold</span>}
          {isBuyer  && <span className="role-badge buyer">You bought</span>}
          <span className="address">{shortenAddr(trade.seller)}</span>
          <span className="history-sep">→</span>
          <span className="address">{shortenAddr(trade.buyer)}</span>
        </div>
      </div>

      <div className="history-row-right">
        {isSettled ? (
          <span className={`verdict-pill ${trade.verdict}`}>
            {trade.verdict === 'release' ? '✅ Released' : '🔄 Refunded'}
          </span>
        ) : (
          <span className={`status-pill status-${trade.status}`}>{STATUS_LABELS[trade.status] || trade.status}</span>
        )}
        <span className="history-time">{timeAgo(trade.settled_at || trade.created_at)}</span>
        <span className="history-view-btn">View →</span>
      </div>
    </div>
  )
}

// ── Constants & helpers ───────────────────────────────────────────────────────
const STATUS_LABELS = { active: 'Active', paid: 'Awaiting Release', disputed: 'Disputed' }

function formatAmount(wei) {
  try { return (Number(BigInt(wei)) / 1e18).toFixed(4) } catch { return wei }
}

function shortenAddr(addr) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
