import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../WalletContext.jsx'
import {
  getTrade, markPaid, releaseCrypto, openDispute,
  escalateAfterTimeout, cancelExpiredOrder, arbitrate, waitForTransaction,
} from '../p2pClient.js'

export default function TradeDetail({ tradeId, onBack, onSettled }) {
  const { address, walletClient } = useWallet()
  const [trade, setTrade]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [txStatus, setTxStatus]   = useState('')
  const [error, setError]         = useState('')
  const [proofUrl, setProofUrl]   = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const t = await getTrade(tradeId)
      setTrade(t)
      if (t?.status === 'settled') onSettled?.()
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [tradeId])

  useEffect(() => { refresh() }, [refresh])

  // Auto-refresh every 10s when trade is active
  useEffect(() => {
    if (!trade || trade.status === 'settled') return
    const id = setInterval(refresh, 10000)
    return () => clearInterval(id)
  }, [trade, refresh])

  async function doAction(fn, label) {
    if (!walletClient) return setError('Connect wallet first')
    setError(''); setTxStatus(''); setActionLoading(true)
    try {
      setTxStatus(`${label}…`)
      const hash = await fn()
      setTxStatus('Waiting for confirmation…')
      await waitForTransaction(hash)
      setTxStatus(`✅ ${label} confirmed.`)
      await refresh()
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading && !trade) return <div className="trade-detail-loading"><span className="spinner">⟳</span> Loading trade…</div>
  if (!trade || Object.keys(trade).length === 0) return (
    <div className="empty-state">
      <span className="empty-icon">❓</span>
      <p>Trade #{tradeId} not found.</p>
      <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
    </div>
  )

  const isSeller = address?.toLowerCase() === trade.seller?.toLowerCase()
  const isBuyer  = address?.toLowerCase() === trade.buyer?.toLowerCase()
  const now      = Math.floor(Date.now() / 1000)
  const payDeadlinePassed     = now > trade.payment_deadline
  const releaseDeadlinePassed = now > trade.release_deadline

  const cryptoAmt = formatAmount(trade.crypto_amount)
  const fiatAmt   = Number(trade.fiat_amount).toLocaleString()

  return (
    <div className="trade-detail">
      {/* Header */}
      <div className="trade-detail-header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div className="trade-detail-title">
          <h2>Trade #{trade.trade_id}</h2>
          <span className={`trade-status-badge status-${trade.status}`}>{LABELS[trade.status] || trade.status}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
          {loading ? '⟳' : '↻'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="trade-progress">
        {STEPS.map((s, i) => {
          const idx     = STEPS.indexOf(trade.status)
          const stepDone = i < idx || trade.status === 'settled'
          const stepActive = s === trade.status
          return (
            <React.Fragment key={s}>
              <div className={`tpstep ${stepDone ? 'done' : ''} ${stepActive ? 'active' : ''}`}>
                <div className="tpstep-circle">{stepDone ? '✓' : STEP_ICONS[s]}</div>
                <span className="tpstep-label">{STEP_LABELS[s]}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`tpstep-line ${stepDone ? 'done' : ''}`} />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Trade Summary */}
      <div className="trade-summary-card">
        <div className="ts-row">
          <div className="ts-cell">
            <span className="label">Crypto</span>
            <strong className="amount">{cryptoAmt} {trade.token}</strong>
          </div>
          <div className="ts-arrow">→</div>
          <div className="ts-cell">
            <span className="label">Fiat</span>
            <strong className="amount-fiat">{fiatAmt} {trade.fiat_currency}</strong>
          </div>
        </div>
        <div className="ts-meta">
          <span><span className="label">Seller </span><span className="address">{shortenAddr(trade.seller)}{isSeller ? ' (you)' : ''}</span></span>
          <span><span className="label">Buyer </span><span className="address">{shortenAddr(trade.buyer)}{isBuyer ? ' (you)' : ''}</span></span>
          <span><span className="label">Rate </span>{Number(trade.rate).toLocaleString()} {trade.fiat_currency}/{trade.token}</span>
          <span><span className="label">Payment </span>{trade.payment_methods}</span>
        </div>
      </div>

      {/* Deadlines */}
      {trade.status === 'active' && trade.payment_deadline > 0 && (
        <div className={`deadline-bar ${payDeadlinePassed ? 'expired' : ''}`}>
          ⏱ {payDeadlinePassed ? 'Payment window expired' : `Pay within ${formatDeadline(trade.payment_deadline)}`}
        </div>
      )}
      {trade.status === 'paid' && trade.release_deadline > 0 && (
        <div className={`deadline-bar ${releaseDeadlinePassed ? 'expired' : ''}`}>
          ⏱ {releaseDeadlinePassed ? 'Release window expired' : `Seller must release within ${formatDeadline(trade.release_deadline)}`}
        </div>
      )}

      {/* Proof URL */}
      {trade.proof_url && (
        <div className="proof-box">
          <span className="label">Payment Proof (AI will read this)</span>
          <a href={trade.proof_url} target="_blank" rel="noreferrer" className="link proof-link">
            🔗 {trade.proof_url}
          </a>
        </div>
      )}

      {/* Verdict */}
      {trade.status === 'settled' && (
        <div className={`verdict-card ${trade.verdict}`}>
          <div className="verdict-header">
            <span className="verdict-icon">{trade.verdict === 'release' ? '✅' : '🔄'}</span>
            <div>
              <div className="verdict-title">
                {trade.verdict === 'release' ? 'Crypto released to buyer' : 'Crypto refunded to seller'}
              </div>
              <span className={`verdict-tag ${trade.verdict}`}>{trade.verdict?.toUpperCase()}</span>
            </div>
          </div>
          {trade.verdict_reason && (
            <div className="verdict-reason">
              <strong>AI Reasoning</strong>
              <p>{trade.verdict_reason}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {trade.status !== 'settled' && (
        <div className="trade-actions">
          <h4 className="actions-title">Actions</h4>

          {/* Buyer: mark paid */}
          {isBuyer && trade.status === 'active' && !payDeadlinePassed && (
            <div className="action-block">
              <p className="action-desc">Pay the seller off-chain ({trade.payment_methods}), then upload your proof screenshot.</p>
              <div className="proof-input-row">
                <input
                  className="input"
                  type="url"
                  placeholder="https://imgur.com/your-screenshot.png"
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  disabled={actionLoading || !proofUrl.startsWith('http')}
                  onClick={() => doAction(() => markPaid(walletClient, tradeId, proofUrl), "Marking as paid")}
                >
                  {actionLoading ? '⟳' : '💸 I\'ve Paid'}
                </button>
              </div>
            </div>
          )}

          {/* Seller: release or dispute */}
          {isSeller && trade.status === 'paid' && (
            <div className="action-block">
              <p className="action-desc">Check the buyer's proof above. Release if payment is confirmed, or dispute if something's wrong.</p>
              <div className="action-row">
                <button className="btn btn-accent flex-1"
                  disabled={actionLoading}
                  onClick={() => doAction(() => releaseCrypto(walletClient, tradeId), "Releasing crypto")}>
                  {actionLoading ? '⟳' : '✅ Release Crypto'}
                </button>
                <button className="btn btn-danger flex-1"
                  disabled={actionLoading}
                  onClick={() => doAction(() => openDispute(walletClient, tradeId), "Opening dispute")}>
                  {actionLoading ? '⟳' : '⚠️ Dispute'}
                </button>
              </div>
            </div>
          )}

          {/* Buyer: escalate if seller ghosts */}
          {isBuyer && trade.status === 'paid' && releaseDeadlinePassed && (
            <div className="action-block">
              <p className="action-desc">Seller hasn't responded. Escalate to AI arbiter.</p>
              <button className="btn btn-secondary w-full"
                disabled={actionLoading}
                onClick={() => doAction(() => escalateAfterTimeout(walletClient, tradeId), "Escalating to AI")}>
                {actionLoading ? '⟳' : '🚨 Escalate to AI'}
              </button>
            </div>
          )}

          {/* Seller: cancel if buyer never paid */}
          {isSeller && trade.status === 'active' && payDeadlinePassed && (
            <div className="action-block">
              <p className="action-desc">Buyer didn't pay in time. Cancel and reclaim your crypto.</p>
              <button className="btn btn-ghost w-full"
                disabled={actionLoading}
                onClick={() => doAction(() => cancelExpiredOrder(walletClient, tradeId), "Cancelling order")}>
                {actionLoading ? '⟳' : '❌ Cancel Expired Order'}
              </button>
            </div>
          )}

          {/* Anyone: arbitrate */}
          {trade.status === 'disputed' && (
            <div className="action-block">
              <div className="ai-arbiter-box">
                <span className="ai-icon">🤖</span>
                <div>
                  <strong>AI Arbitration</strong>
                  <p>AI will fetch the proof URL and issue a binding verdict. Multiple validators must agree.</p>
                </div>
              </div>
              <button className="btn btn-secondary w-full"
                disabled={actionLoading}
                onClick={() => doAction(() => arbitrate(walletClient, tradeId), "AI arbitrating")}>
                {actionLoading ? '⟳ AI evaluating… (30–60s)' : '🤖 Trigger AI Arbitration'}
              </button>
            </div>
          )}

          {!isSeller && !isBuyer && trade.status !== 'disputed' && (
            <div className="alert alert-warning">Connect as seller or buyer wallet to take action.</div>
          )}
        </div>
      )}

      {txStatus && <div className="alert alert-info">{txStatus}</div>}
      {error    && <div className="alert alert-error">❌ {error}</div>}
    </div>
  )
}

// ── Constants ────────────────────────────────────────────────────────────────
const STEPS       = ['active', 'paid', 'disputed', 'settled']
const STEP_LABELS = { active: 'Order Locked', paid: 'Proof Submitted', disputed: 'Disputed', settled: 'Settled' }
const STEP_ICONS  = { active: '🔒', paid: '💸', disputed: '⚠️', settled: '🏁' }
const LABELS      = { active: 'Active', paid: 'Awaiting Release', disputed: 'Disputed', settled: 'Settled' }

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatAmount(wei) {
  try { return (Number(BigInt(wei)) / 1e18).toFixed(4) } catch { return wei }
}

function shortenAddr(addr) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatDeadline(ts) {
  const diff = ts - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'expired'
  const m = Math.floor(diff / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}
