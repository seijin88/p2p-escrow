import React, { useState } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { postOffer, waitForTransaction } from '../p2pClient.js'

const TOKENS = ['GEN', 'USDT']
const FIATS  = ['IDR', 'USD', 'MYR', 'SGD', 'PHP', 'THB', 'VND']

export default function PostOfferForm({ onSuccess, onClose }) {
  const { walletClient, address } = useWallet()
  const [form, setForm] = useState({
    token: 'GEN', cryptoAmount: '', fiatCurrency: 'IDR',
    fiatAmount: '', rate: '', paymentMethods: '',
  })
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState('')
  const [error, setError]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!walletClient || !address) return setError('Connect wallet first')
    setError(''); setStatus(''); setLoading(true)
    try {
      const amountWei = BigInt(Math.round(parseFloat(form.cryptoAmount) * 1e18)).toString()
      setStatus('Posting offer…')
      const hash = await postOffer(walletClient, {
        token: form.token,
        fiatCurrency: form.fiatCurrency,
        fiatAmount: form.fiatAmount,
        rate: form.rate,
        paymentMethods: form.paymentMethods,
        amountWei,
      })
      setStatus('Waiting for confirmation…')
      await waitForTransaction(hash)
      setStatus('✅ Offer posted!')
      setTimeout(() => { onSuccess?.(); onClose?.() }, 1200)
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📢 Post Sell Offer</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="tips-box">
          <strong>💡 Tips</strong>
          <ul>
            <li>Your rate must be within ±10% of live market — AI verifies at buyer lock</li>
            <li>Buyer has 1 hour to pay after locking. You have 30 min to release after proof.</li>
          </ul>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Token</label>
              <select className="input" value={form.token} onChange={e => set('token', e.target.value)}>
                {TOKENS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Amount to Lock</label>
              <input className="input" type="number" step="0.0001" min="0.0001"
                placeholder="e.g. 10.5" value={form.cryptoAmount}
                onChange={e => set('cryptoAmount', e.target.value)} required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fiat Currency</label>
              <select className="input" value={form.fiatCurrency} onChange={e => set('fiatCurrency', e.target.value)}>
                {FIATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Total Fiat Amount</label>
              <input className="input" type="number" min="1"
                placeholder="e.g. 150000" value={form.fiatAmount}
                onChange={e => set('fiatAmount', e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label>Rate ({form.fiatCurrency} per 1 {form.token})</label>
            <input className="input" type="number" min="1"
              placeholder="e.g. 14500" value={form.rate}
              onChange={e => set('rate', e.target.value)} required />
            <span className="hint">AI fetches live market rate at buyer lock — must be within ±10%</span>
          </div>

          <div className="form-group">
            <label>Accepted Payment Methods</label>
            <input className="input" placeholder="e.g. BCA, GoPay, OVO, Dana"
              value={form.paymentMethods} onChange={e => set('paymentMethods', e.target.value)} required />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading || !address}>
            {loading ? '⟳ Processing…' : `🔒 Lock ${form.token} & Post Offer`}
          </button>
        </form>

        {status && <div className="alert alert-info">{status}</div>}
        {error  && <div className="alert alert-error">❌ {error}</div>}
      </div>
    </div>
  )
}
