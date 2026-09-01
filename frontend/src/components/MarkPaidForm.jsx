import React, { useState } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { markPaid, waitForTransaction } from '../p2pClient.js'

export default function MarkPaidForm({ offerData, onSuccess }) {
  const { walletClient, address } = useWallet()
  const [proofUrl, setProofUrl]   = useState('')
  const [status, setStatus]       = useState('')
  const [txHash, setTxHash]       = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!walletClient) return setError('Connect wallet first')
    if (!proofUrl.startsWith('http')) return setError('URL must start with http')
    setError(''); setStatus(''); setTxHash(''); setLoading(true)

    try {
      setStatus('Submitting proof URL…')
      const hash = await markPaid(walletClient, proofUrl)
      setTxHash(hash)
      setStatus('Waiting for confirmation…')
      await waitForTransaction(hash)
      setStatus('✅ Payment marked! Seller now has 30 minutes to release.')
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  const deadline = offerData?.payment_deadline
  const deadlineStr = deadline && deadline !== '0'
    ? formatDeadline(deadline)
    : null

  return (
    <div className="form-container">
      <div className="form-header">
        <span className="form-icon">💸</span>
        <div>
          <h3 className="form-title">Mark as Paid (Buyer)</h3>
          <p className="form-desc">Pay the seller off-chain, then upload your proof of payment here.</p>
        </div>
      </div>

      {deadlineStr && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          ⏱ Payment deadline: <strong>{deadlineStr}</strong>
        </div>
      )}

      {offerData && (
        <div className="offer-summary">
          <div className="summary-row">
            <span className="label">Amount to Pay</span>
            <strong className="amount-fiat">{Number(offerData.fiat_amount).toLocaleString()} {offerData.fiat_currency}</strong>
          </div>
          <div className="summary-row">
            <span className="label">Accepted Methods</span>
            <span>{offerData.payment_methods}</span>
          </div>
        </div>
      )}

      <form className="form" onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <div className="form-group">
          <label>Proof of Payment URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://i.imgur.com/your-screenshot.png"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            required
          />
          <span className="hint">
            Upload your transfer screenshot to Imgur, Cloudinary, or any public URL. The AI will read it directly.
          </span>
        </div>

        {proofUrl.startsWith('http') && (
          <div className="url-preview">
            <span className="preview-label">Preview URL</span>
            <a href={proofUrl} target="_blank" rel="noreferrer" className="link">{proofUrl}</a>
            <span className="preview-check">✓ AI will fetch this URL to verify your payment</span>
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading || !address}>
          {loading ? '⟳ Submitting…' : '✅ I\'ve Paid — Submit Proof'}
        </button>
      </form>

      {status && <div className="alert alert-info">{status}{txHash && <div className="tx-hash">Tx: <a href={`https://explorer-bradbury.genlayer.com/tx/${txHash}`} target="_blank" rel="noreferrer" className="link">{txHash.slice(0,20)}…</a></div>}</div>}
      {error  && <div className="alert alert-error">❌ {error}</div>}
    </div>
  )
}

function formatDeadline(unixStr) {
  try {
    const ts = Number(unixStr)
    if (!ts) return '—'
    const date = new Date(ts * 1000)
    const diff = date.getTime() - Date.now()
    if (diff < 0) return `Expired (${date.toLocaleString()})`
    const mins = Math.floor(diff / 60000)
    const hrs  = Math.floor(mins / 60)
    return hrs > 0 ? `${hrs}h ${mins % 60}m remaining` : `${mins}m remaining`
  } catch { return '—' }
}
