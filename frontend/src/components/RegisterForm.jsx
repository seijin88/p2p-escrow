import React, { useState } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { registerProfile, isRegistered, getProfile } from '../profileClient.js'
import { waitForTransaction } from '../p2pClient.js'

const BANKS = ['BCA', 'BNI', 'BRI', 'Mandiri', 'CIMB', 'Danamon', 'Permata', 'GoPay', 'OVO', 'Dana', 'ShopeePay']

export default function RegisterForm({ onRegistered }) {
  const { walletClient, address } = useWallet()
  const [form, setForm] = useState({ bankName: '', accountNumber: '', accountName: '' })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!walletClient || !address) return setError('Connect wallet first')
    setError(''); setStatus(''); setLoading(true)
    try {
      setStatus('Registering your bank account on-chain…')
      const hash = await registerProfile(walletClient, {
        bankName      : form.bankName,
        accountNumber : form.accountNumber,
        accountName   : form.accountName,
      })
      setStatus('Waiting for confirmation…')
      await waitForTransaction(hash)
      setStatus('✅ Profile registered!')
      setTimeout(() => onRegistered?.(), 1200)
    } catch (err) {
      setError(err.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-header">
          <span className="register-icon">🏦</span>
          <div>
            <h2 className="register-title">Register Bank Account</h2>
            <p className="register-desc">
              Required before trading. Your bank details are stored on-chain and used
              by the AI arbiter to verify payment proofs.
            </p>
          </div>
        </div>

        <div className="tips-box">
          <strong>🔒 Why is this required?</strong>
          <ul>
            <li>Sellers: buyers see your account number automatically — no manual sharing</li>
            <li>Buyers: your identity is verified for dispute resolution</li>
            <li>AI arbiter uses your registered name to match payment receipts</li>
          </ul>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Bank / E-Wallet</label>
            <select
              className="input"
              value={form.bankName}
              onChange={e => set('bankName', e.target.value)}
              required
            >
              <option value="">Select bank…</option>
              {BANKS.map(b => <option key={b}>{b}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Account Number</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. 1234567890"
              value={form.accountNumber}
              onChange={e => set('accountNumber', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Account Holder Name</label>
            <input
              className="input"
              type="text"
              placeholder="Full name as on bank account"
              value={form.accountName}
              onChange={e => set('accountName', e.target.value)}
              required
            />
            <span className="hint">Must match exactly — AI verifies this against payment proof</span>
          </div>

          <button className="btn btn-primary w-full" type="submit" disabled={loading || !address}>
            {loading ? '⟳ Registering…' : '✅ Register & Continue'}
          </button>
        </form>

        {status && <div className="alert alert-info">{status}</div>}
        {error  && <div className="alert alert-error">❌ {error}</div>}
      </div>
    </div>
  )
}
