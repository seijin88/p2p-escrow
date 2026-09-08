import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '../WalletContext.jsx'
import {
  getTrade, markPaid, releaseCrypto, openDispute,
  escalateAfterTimeout, cancelExpiredOrder, arbitrate, waitForTransaction,
} from '../p2pClient.js'

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT

async function uploadToIPFS(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinata error: ${res.status} ${err}`)
  }
  const data = await res.json()
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
}

export default function TradeDetail({ tradeId, onBack, onSettled }) {
  const { address, walletClient } = useWallet()
  const [trade, setTrade]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [txStatus, setTxStatus]   = useState('')
  const [error, setError]         = useState('')
  const [proofUrl, setProofUrl]   = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const fileInputRef = useRef(null)

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

  useEffect(() => {
    if (!trade || trade.status === 'settled') return
    const id = setInterval(refresh, 10000)
    return () => clearInterval(id)
  }, [trade, refresh])

  async function handleFileUpload(file) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('File too large. Max 10MB.'); return }
    setUploading(true); setError(''); setTxStatus('Uploading to IPFS...')
    try {
      const url = await uploadToIPFS(file)
      setProofUrl(url)
      setTxStatus("Uploaded to IPFS. Click I've Paid to submit.")
    } catch (err) {
      setError(err.message || 'Upload failed'); setTxStatus('')
    } finally { setUploading(false) }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }

  async function doAction(fn, label) {
    if (!walletClient) return setError('Connect wallet first')
    setError(''); setTxStatus(''); setActionLoading(true)
    try {
      setTxStatus(`${label}...`)
      const hash = await fn()
      setTxStatus('Waiting for confirmation...')
      await waitForTransaction(hash)
      setTxStatus(`${label} confirmed.`)
      await refresh()
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading && !trade) return <div className="trade-detail-loading"><span className="spinner">Loading</span> Loading trade...</div>
  if (!trade || Object.keys(trade).length === 0) return (
    <div className="empty-state">
      <span className="empty-icon">?</span>
      <p>Trade #{tradeId} not found.</p>
      <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
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
      <div className="trade-detail-header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>Back</button>
        <div className="trade-detail-title">
          <h2>Trade #{trade.trade_id}</h2>
          <span className={`trade-status-badge status-${trade.status}`}>{LABELS[trade.status] || trade.status}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
          {loading ? 'Loading' : 'Refresh'}
        </button>
      </div>

      <div className="trade-progress">
        {STEPS.map((s, i) => {
          const idx      = STEPS.indexOf(trade.status)
          const stepDone = i < idx || trade.status === 'settled'
          const stepActive = s === trade.status
          return (
            <React.Fragment key={s}>
              <div className={`tpstep ${stepDone ? 'done' : ''} ${stepActive ? 'active' : ''}`}>
                <div className="tpstep-circle">{stepDone ? 'v' : STEP_ICONS[s]}</div>
                <span className="tpstep-label">{STEP_LABELS[s]}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`tpstep-line ${stepDone ? 'done' : ''}`} />}
            </React.Fragment>
          )
        })}
      </div>

      <div className="trade-summary-card">
        <div className="ts-row">
          <div className="ts-cell">
            <span className="label">Crypto</span>
            <strong className="amount">{cryptoAmt} {trade.token}</strong>
          </div>
          <div className="ts-arrow">to</div>
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

      {trade.status === 'active' && trade.payment_deadline > 0 && (
        <div className={`deadline-bar ${payDeadlinePassed ? 'expired' : ''}`}>
          {payDeadlinePassed ? 'Payment window expired' : `Pay within ${formatDeadline(trade.payment_deadline)}`}
        </div>
      )}
      {trade.status === 'paid' && trade.release_deadline > 0 && (
        <div className={`deadline-bar ${releaseDeadlinePassed ? 'expired' : ''}`}>
          {releaseDeadlinePassed ? 'Release window expired' : `Seller must release within ${formatDeadline(trade.release_deadline)}`}
        </div>
      )}

      {isBuyer && trade.seller_bank_name && ['active', 'paid'].includes(trade.status) && (
        <div className="bank-info-box">
          <div className="bank-info-title">Transfer to seller's account</div>
          <div className="bank-info-row"><span className="label">Bank</span><strong>{trade.seller_bank_name}</strong></div>
          <div className="bank-info-row"><span className="label">Account</span><strong className="bank-acct">{trade.seller_account_number}</strong></div>
          <div className="bank-info-row"><span className="label">Name</span><strong>{trade.seller_account_name}</strong></div>
          <div className="bank-info-row"><span className="label">Amount</span><strong className="amount-fiat">{Number(trade.fiat_amount).toLocaleString()} {trade.fiat_currency}</strong></div>
        </div>
      )}

      {trade.proof_url && (
        <div className="proof-box">
          <span className="label">Payment Proof (AI will verify)</span>
          <a href={trade.proof_url} target="_blank" rel="noreferrer" className="link proof-link">
            View Proof on IPFS
          </a>
        </div>
      )}

      {trade.status === 'settled' && (
        <div className={`verdict-card ${trade.verdict}`}>
          <div className="verdict-header">
            <span className="verdict-icon">{trade.verdict === 'release' ? 'OK' : 'REFUND'}</span>
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

      {trade.status !== 'settled' && (
        <div className="trade-actions">
          <h4 className="actions-title">Actions</h4>

          {trade.status === 'active' && !payDeadlinePassed && (
            <div className="action-block">
              <p className="action-desc">
                {isBuyer
                  ? `Pay the seller off-chain (${trade.payment_methods}), then upload your proof screenshot.`
                  : 'Only the buyer should submit proof.'}
              </p>

              <div
                className={`ipfs-dropzone ${dragOver ? 'drag-active' : ''} ${uploading ? 'uploading' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
                aria-label="Upload payment proof to IPFS"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleFileUpload(e.target.files?.[0])}
                />
                {uploading ? (
                  <span className="ipfs-drop-text">Uploading to IPFS...</span>
                ) : proofUrl.includes('gateway.pinata.cloud') ? (
                  <span className="ipfs-drop-text ipfs-drop-success">Uploaded to IPFS - click to replace</span>
                ) : (
                  <span className="ipfs-drop-text">
                    Drag and drop screenshot here, or <u>click to browse</u>
                    <br /><small>Image or PDF, max 10MB, stored on IPFS</small>
                  </span>
                )}
              </div>

              <div className="proof-input-row">
                <input
                  className="input"
                  type="url"
                  placeholder="Or paste proof URL: https://..."
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  disabled={actionLoading || uploading || !proofUrl.startsWith('http')}
                  onClick={() => doAction(() => markPaid(walletClient, tradeId, proofUrl), "Marking as paid")}
                >
                  {actionLoading ? 'Loading' : "I've Paid"}
                </button>
              </div>
            </div>
          )}

          {trade.status === 'paid' && (
            <div className="action-block">
              <p className="action-desc">
                {isSeller ? 'Check the proof above. Release if confirmed, or dispute.' : 'Only the seller should release or dispute.'}
              </p>
              <div className="action-row">
                <button className="btn btn-accent flex-1"
                  disabled={actionLoading}
                  onClick={() => doAction(() => releaseCrypto(walletClient, tradeId), "Releasing crypto")}>
                  {actionLoading ? 'Loading' : 'Release Crypto'}
                </button>
                <button className="btn btn-danger flex-1"
                  disabled={actionLoading}
                  onClick={() => doAction(() => openDispute(walletClient, tradeId), "Opening dispute")}>
                  {actionLoading ? 'Loading' : 'Dispute'}
                </button>
              </div>
            </div>
          )}

          {isBuyer && trade.status === 'paid' && releaseDeadlinePassed && (
            <div className="action-block">
              <p className="action-desc">Seller has not responded. Escalate to AI arbiter.</p>
              <button className="btn btn-secondary w-full"
                disabled={actionLoading}
                onClick={() => doAction(() => escalateAfterTimeout(walletClient, tradeId), "Escalating to AI")}>
                {actionLoading ? 'Loading' : 'Escalate to AI'}
              </button>
            </div>
          )}

          {isSeller && trade.status === 'active' && payDeadlinePassed && (
            <div className="action-block">
              <p className="action-desc">Buyer did not pay in time. Cancel and reclaim your crypto.</p>
              <button className="btn btn-ghost w-full"
                disabled={actionLoading}
                onClick={() => doAction(() => cancelExpiredOrder(walletClient, tradeId), "Cancelling order")}>
                {actionLoading ? 'Loading' : 'Cancel Expired Order'}
              </button>
            </div>
          )}

          {trade.status === 'disputed' && (
            <div className="action-block">
              <div className="ai-arbiter-box">
                <span className="ai-icon">AI</span>
                <div>
                  <strong>AI Arbitration</strong>
                  <p>AI will fetch the proof URL and issue a binding verdict. Multiple validators must agree.</p>
                </div>
              </div>
              <button className="btn btn-secondary w-full"
                disabled={actionLoading}
                onClick={() => doAction(() => arbitrate(walletClient, tradeId), "AI arbitrating")}>
                {actionLoading ? 'AI evaluating... (30-60s)' : 'Trigger AI Arbitration'}
              </button>
            </div>
          )}

          {!isSeller && !isBuyer && trade.status !== 'disputed' && (
            <div className="alert alert-warning">Connect as seller or buyer wallet to take action.</div>
          )}
        </div>
      )}

      {txStatus && <div className="alert alert-info">{txStatus}</div>}
      {error    && <div className="alert alert-error">Error: {error}</div>}
    </div>
  )
}

const STEPS       = ['active', 'paid', 'disputed', 'settled']
const STEP_LABELS = { active: 'Order Locked', paid: 'Proof Submitted', disputed: 'Disputed', settled: 'Settled' }
const STEP_ICONS  = { active: 'L', paid: '$', disputed: '!', settled: 'F' }
const LABELS      = { active: 'Active', paid: 'Awaiting Release', disputed: 'Disputed', settled: 'Settled' }

function formatAmount(wei) {
  try { return (Number(BigInt(wei)) / 1e18).toFixed(4) } catch { return wei }
}

function shortenAddr(addr) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '-'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatDeadline(ts) {
  const diff = ts - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'expired'
  const m = Math.floor(diff / 60)
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}
