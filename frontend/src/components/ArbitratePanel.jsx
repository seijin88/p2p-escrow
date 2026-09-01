import React, { useState } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { arbitrate, waitForTransaction } from '../p2pClient.js'

export default function ArbitratePanel({ offerData, verdictData, onSuccess }) {
  const { walletClient, address } = useWallet()
  const [status, setStatus]   = useState('')
  const [txHash, setTxHash]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleArbitrate() {
    if (!walletClient) return setError('Connect wallet first')
    setError(''); setStatus(''); setTxHash(''); setLoading(true)
    try {
      setStatus('AI is reading the proof and evaluating the dispute… this may take 30–60 seconds.')
      const hash = await arbitrate(walletClient)
      setTxHash(hash)
      setStatus('Waiting for AI consensus…')
      await waitForTransaction(hash)
      setStatus('✅ AI verdict reached. Funds have been distributed.')
      onSuccess?.()
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  const isSettled = offerData?.status === 'settled'
  const isDisputed = offerData?.status === 'disputed'

  return (
    <div className="form-container">
      <div className="form-header">
        <span className="form-icon">🤖</span>
        <div>
          <h3 className="form-title">AI Arbitration</h3>
          <p className="form-desc">The AI reads the buyer's payment proof and decides who gets the crypto.</p>
        </div>
      </div>

      {isDisputed && (
        <>
          <div className="tips-box">
            <strong>🤖 How AI arbitration works</strong>
            <ul>
              <li>AI fetches the buyer's proof URL and reads the content directly</li>
              <li>AI checks: correct amount, correct recipient, accepted payment method</li>
              <li>If proof is valid → crypto released to buyer</li>
              <li>If proof is missing/wrong → crypto refunded to seller</li>
              <li>Decision is final — multiple AI validators must agree (GenLayer consensus)</li>
            </ul>
          </div>

          {offerData?.proof_url && (
            <div className="offer-summary" style={{ marginBottom: 16 }}>
              <div className="summary-row">
                <span className="label">Proof URL (AI will read this)</span>
                <a href={offerData.proof_url} target="_blank" rel="noreferrer" className="link">{offerData.proof_url}</a>
              </div>
            </div>
          )}

          <button className="btn btn-secondary" onClick={handleArbitrate} disabled={loading || !address}>
            {loading ? '⟳ AI is evaluating…' : '🤖 Trigger AI Arbitration'}
          </button>
        </>
      )}

      {isSettled && verdictData && (
        <div className={`verdict-card ${verdictData.verdict}`}>
          <div className="verdict-header">
            <span className="verdict-icon">{verdictData.verdict === 'release' ? '✅' : '🔄'}</span>
            <div>
              <div className="verdict-title">
                {verdictData.verdict === 'release' ? 'Crypto Released to Buyer' : 'Crypto Refunded to Seller'}
              </div>
              <span className={`verdict-tag ${verdictData.verdict}`}>
                {verdictData.verdict?.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="verdict-reason">
            <strong>AI Reasoning</strong>
            <p>{verdictData.reason}</p>
          </div>
        </div>
      )}

      {!isDisputed && !isSettled && (
        <div className="alert alert-warning">
          Arbitration is only available when the trade is in <strong>disputed</strong> status.
        </div>
      )}

      {status && <div className="alert alert-info" style={{ marginTop: 12 }}>{status}{txHash && <div className="tx-hash">Tx: <a href={`https://explorer-bradbury.genlayer.com/tx/${txHash}`} target="_blank" rel="noreferrer" className="link">{txHash.slice(0,20)}…</a></div>}</div>}
      {error  && <div className="alert alert-error" style={{ marginTop: 12 }}>❌ {error}</div>}
    </div>
  )
}
