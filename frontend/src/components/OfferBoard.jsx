import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { getOpenOffers, getCounters, lockOrder, cancelOffer, waitForTransaction } from '../p2pClient.js'

export default function OfferBoard({ onTradeCreated }) {
  const { address, walletClient } = useWallet()
  const [offers, setOffers]       = useState([])
  const [counters, setCounters]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [actionState, setActionState] = useState({}) // { [offerId]: { loading, status, error } }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [o, c] = await Promise.all([getOpenOffers(), getCounters()])
      setOffers(Array.isArray(o) ? o : [])
      setCounters(c)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleLock(offerId) {
    if (!walletClient || !address) return
    setActionState(s => ({ ...s, [offerId]: { loading: true, status: 'AI validating rate…', error: '' } }))
    try {
      const hash = await lockOrder(walletClient, offerId)
      setActionState(s => ({ ...s, [offerId]: { loading: true, status: 'Confirming…', error: '' } }))
      const receipt = await waitForTransaction(hash)
      // Extract trade_id from receipt logs if possible, fallback to refresh
      setActionState(s => ({ ...s, [offerId]: { loading: false, status: '✅ Order locked!', error: '' } }))
      await refresh()
      onTradeCreated?.()
    } catch (err) {
      setActionState(s => ({ ...s, [offerId]: { loading: false, status: '', error: err.message || 'Failed' } }))
    }
  }

  async function handleCancel(offerId) {
    if (!walletClient || !address) return
    setActionState(s => ({ ...s, [offerId]: { loading: true, status: 'Cancelling…', error: '' } }))
    try {
      const hash = await cancelOffer(walletClient, offerId)
      await waitForTransaction(hash)
      setActionState(s => ({ ...s, [offerId]: { loading: false, status: '✅ Offer cancelled', error: '' } }))
      await refresh()
    } catch (err) {
      setActionState(s => ({ ...s, [offerId]: { loading: false, status: '', error: err.message || 'Failed' } }))
    }
  }

  return (
    <div className="offer-board">
      <div className="board-header">
        <div>
          <h2 className="board-title">⚡ Open Offers</h2>
          {counters && (
            <p className="board-subtitle">
              {counters.open_offers} open · {counters.total_trades} trades total
            </p>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
          {loading ? '⟳' : '↻ Refresh'}
        </button>
      </div>

      {loading && offers.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">⟳</span>
          <p>Loading offers…</p>
        </div>
      )}

      {!loading && offers.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>No open offers right now.</p>
          <p className="empty-sub">Be the first to post one!</p>
        </div>
      )}

      <div className="offers-grid">
        {offers.map(offer => {
          const state   = actionState[offer.offer_id] || {}
          const isMine  = address && offer.seller?.toLowerCase() === address.toLowerCase()
          const cryptoAmt = formatAmount(offer.crypto_amount)
          const fiatAmt   = Number(offer.fiat_amount).toLocaleString()

          return (
            <div key={offer.offer_id} className={`offer-card ${isMine ? 'my-offer' : ''}`}>
              <div className="offer-card-header">
                <div className="offer-token-badge">{offer.token}</div>
                <span className="offer-id">#{offer.offer_id}</span>
                {isMine && <span className="my-badge">Your offer</span>}
              </div>

              <div className="offer-amounts">
                <div className="offer-crypto">
                  <span className="offer-amount-big">{cryptoAmt}</span>
                  <span className="offer-token-label">{offer.token}</span>
                </div>
                <div className="offer-arrow">→</div>
                <div className="offer-fiat">
                  <span className="offer-amount-big offer-fiat-amount">{fiatAmt}</span>
                  <span className="offer-token-label">{offer.fiat_currency}</span>
                </div>
              </div>

              <div className="offer-meta">
                <div className="offer-meta-row">
                  <span className="label">Rate</span>
                  <span>{Number(offer.rate).toLocaleString()} {offer.fiat_currency}/{offer.token}</span>
                </div>
                <div className="offer-meta-row">
                  <span className="label">Payment</span>
                  <span className="offer-methods">{offer.payment_methods}</span>
                </div>
                <div className="offer-meta-row">
                  <span className="label">Seller</span>
                  <span className="address">{shortenAddr(offer.seller)}</span>
                </div>
                <div className="offer-meta-row">
                  <span className="label">Posted</span>
                  <span>{timeAgo(offer.created_at)}</span>
                </div>
              </div>

              {state.status && (
                <div className={`alert ${state.error ? 'alert-error' : 'alert-info'} offer-alert`}>
                  {state.status}
                </div>
              )}
              {state.error && (
                <div className="alert alert-error offer-alert">❌ {state.error}</div>
              )}

              <div className="offer-actions">
                {isMine ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleCancel(offer.offer_id)}
                    disabled={state.loading}
                  >
                    {state.loading ? '⟳' : '✕ Cancel Offer'}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary offer-lock-btn"
                    onClick={() => handleLock(offer.offer_id)}
                    disabled={state.loading || !address}
                  >
                    {state.loading ? '⟳ AI verifying…' : '🔒 Buy — Lock Order'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
