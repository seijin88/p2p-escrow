import React, { useState } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { lockOrder, waitForTransaction } from '../p2pClient.js'

export default function LockOrderPanel({ offerData, onSuccess }) {
  const { walletClient, address } = useWallet()
  const [status, setStatus]   = useState('')
  const [txHash, setTxHash]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLock() {
    if (!walletClient) return setError('Connect wallet first')
    setError(''); setStatus(''); setTxHash(''); setLoading(true)
    try {
      setStatus('AI is verifying the rate against live market price…')
      const hash = await lockOrder(walletClient)
      setTxHash(hash)
      setStatus('Waiting for confirmation…')
      await waitForTransaction(hash)
      setStatus('✅ Order locked! Now pay the seller and submit proof.')
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-container">
      <div className="form-header">
        <span className="form-icon">🔒</span>
        <div>
          <h3 className="form-title">Lock Order (Buyer)</h3>
          <p className="form-desc">Commit to this trade. AI will verify the seller's rate is fair before locking.</p>
        </div>
      </div>

      {offerData && offerData.status === 'offered' ? (
        <>
          <div className="offer-summary">
            <div className="summary-row">
              <span className="label">Seller</span>
              <span className="address">{offerData.seller?.slice(0,6)}…{offerData.seller?.slice(-4)}</span>
            </div>
            <div className="summary-row">
              <span className="label">You Pay</span>
              <strong className="amount-fiat">{Number(offerData.fiat_amount).toLocaleString()} {offerData.fiat_currency}</strong>
            </div>
            <div className="summary-row">
              <span className="label">You Receive</span>
              <strong className="amount-crypto">{formatAmount(offerData.crypto_amount)} {offerData.token}</strong>
            </div>
            <div className="summary-row">
              <span className="label">Rate</span>
              <span>{Number(offerData.rate).toLocaleString()} {offerData.fiat_currency} / {offerData.token}</span>
            </div>
            <div className="summary-row">
              <span className="label">Payment Methods</span>
              <span>{offerData.payment_methods}</span>
            </div>
          </div>

          <div className="tips-box" style={{ marginTop: 16 }}>
            <strong>⚠️ Before you lock</strong>
            <ul>
              <li>AI will check the rate is within ±10% of market — if not, the transaction will revert</li>
              <li>After locking, you have <strong>1 hour</strong> to pay and upload proof</li>
              <li>Your reputation score must be ≥ 80% (new traders are allowed)</li>
            </ul>
          </div>

          <button className="btn btn-primary" onClick={handleLock} disabled={loading || !address}>
            {loading ? '⟳ AI verifying rate…' : '🔒 Lock Order & Commit to Trade'}
          </button>
        </>
      ) : (
        <div className="alert alert-warning">No open offer available to lock. Ask the seller to post an offer first.</div>
      )}

      {status && <div className="alert alert-info" style={{ marginTop: 12 }}>{status}{txHash && <div className="tx-hash">Tx: <a href={`https://explorer-bradbury.genlayer.com/tx/${txHash}`} target="_blank" rel="noreferrer" className="link">{txHash.slice(0,20)}…</a></div>}</div>}
      {error  && <div className="alert alert-error" style={{ marginTop: 12 }}>❌ {error}</div>}
    </div>
  )
}

function formatAmount(wei) {
  try { return (Number(BigInt(wei)) / 1e18).toFixed(4) } catch { return wei }
}
