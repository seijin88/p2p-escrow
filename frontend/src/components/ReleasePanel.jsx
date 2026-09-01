import React, { useState } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { releaseCrypto, openDispute, escalateAfterTimeout, cancelExpiredOrder, waitForTransaction } from '../p2pClient.js'

export default function ReleasePanel({ offerData, onSuccess }) {
  const { walletClient, address } = useWallet()
  const [status, setStatus]   = useState('')
  const [txHash, setTxHash]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAction(actionFn, label) {
    if (!walletClient) return setError('Connect wallet first')
    setError(''); setStatus(''); setTxHash(''); setLoading(true)
    try {
      setStatus(`${label}…`)
      const hash = await actionFn(walletClient)
      setTxHash(hash)
      setStatus('Waiting for confirmation…')
      await waitForTransaction(hash)
      setStatus(`✅ ${label} confirmed.`)
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  const isSeller = address && offerData?.seller?.toLowerCase() === address.toLowerCase()
  const isBuyer  = address && offerData?.buyer?.toLowerCase()  === address.toLowerCase()
  const releaseDeadlinePassed = offerData?.release_deadline && Date.now() / 1000 > Number(offerData.release_deadline)
  const paymentDeadlinePassed = offerData?.payment_deadline  && Date.now() / 1000 > Number(offerData.payment_deadline)

  return (
    <div className="form-container">
      <div className="form-header">
        <span className="form-icon">⚡</span>
        <div>
          <h3 className="form-title">Release / Dispute</h3>
          <p className="form-desc">Seller: confirm receipt of fiat and release crypto. Or open a dispute if payment looks wrong.</p>
        </div>
      </div>

      {offerData?.proof_url && (
        <div className="offer-summary" style={{ marginBottom: 16 }}>
          <div className="summary-row">
            <span className="label">Buyer's Proof URL</span>
            <a href={offerData.proof_url} target="_blank" rel="noreferrer" className="link">{offerData.proof_url}</a>
          </div>
          <div className="summary-row">
            <span className="label">Expected Payment</span>
            <strong className="amount-fiat">{Number(offerData.fiat_amount).toLocaleString()} {offerData.fiat_currency}</strong>
          </div>
        </div>
      )}

      <div className="action-grid">
        {/* Seller: release */}
        {isSeller && offerData?.status === 'paid' && (
          <button
            className="btn btn-accent action-btn"
            onClick={() => handleAction(releaseCrypto, 'Releasing crypto to buyer')}
            disabled={loading}
          >
            ✅ Release Crypto to Buyer
          </button>
        )}

        {/* Seller: dispute */}
        {isSeller && offerData?.status === 'paid' && (
          <button
            className="btn btn-danger action-btn"
            onClick={() => handleAction(openDispute, 'Opening dispute')}
            disabled={loading}
          >
            ⚠️ Dispute — Payment Not Received
          </button>
        )}

        {/* Buyer: escalate if seller ghosts */}
        {isBuyer && offerData?.status === 'paid' && releaseDeadlinePassed && (
          <button
            className="btn btn-secondary action-btn"
            onClick={() => handleAction(escalateAfterTimeout, 'Escalating to AI arbiter')}
            disabled={loading}
          >
            🚨 Seller Not Responding — Escalate to AI
          </button>
        )}

        {/* Seller: cancel if buyer never paid */}
        {isSeller && offerData?.status === 'locked' && paymentDeadlinePassed && (
          <button
            className="btn btn-ghost action-btn"
            onClick={() => handleAction(cancelExpiredOrder, 'Cancelling expired order')}
            disabled={loading}
          >
            ❌ Cancel — Buyer Didn't Pay in Time
          </button>
        )}

        {!isSeller && !isBuyer && (
          <div className="alert alert-warning">
            Connect as the seller or buyer wallet to take action.
          </div>
        )}
      </div>

      {status && <div className="alert alert-info" style={{ marginTop: 12 }}>{status}{txHash && <div className="tx-hash">Tx: <a href={`https://explorer-bradbury.genlayer.com/tx/${txHash}`} target="_blank" rel="noreferrer" className="link">{txHash.slice(0,20)}…</a></div>}</div>}
      {error  && <div className="alert alert-error" style={{ marginTop: 12 }}>❌ {error}</div>}
    </div>
  )
}
