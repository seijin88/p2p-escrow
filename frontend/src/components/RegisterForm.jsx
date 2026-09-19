import React, { useState } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { reportProfile } from '../profileClient.js'
import { waitForTransaction } from '../p2pClient.js'

const BANKS = ['BCA', 'BNI', 'BRI', 'Mandiri', 'CIMB', 'Danamon', 'Permata', 'GoPay', 'OVO', 'Dana', 'ShopeePay']

export default function RegisterForm({ onRegistered }) {
  const { walletClient, address } = useWallet()
  const [form, setForm] = useState({
    bankName: '', accountNumber: '', accountName: '', contactHandle: ''
  })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!walletClient || !address) return setError('Connect wallet first')
    setError(''); setStatus(''); setLoading(true)
    try {
      setStatus('Reporting profile & contact info...')
      const hash = await reportProfile(walletClient, {
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        accountName: form.accountName,
        contactHandle: form.contactHandle,
      })
      setStatus('Waiting for confirmation... (this may take 1-2 minutes)')
      try {
        await waitForTransaction(hash, 5000, 60)
      } catch {
        // May already be accepted even if polling timed out
      }
      setStatus('Profile reported!')
      setTimeout(() => onRegistered?.({
        bank_name: form.bankName,
        account_number: form.accountNumber,
        account_name: form.accountName,
        contact_handle: form.contactHandle,
      }), 1200)
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
          <span className="register-icon" aria-hidden="true">◈</span>
          <div>
            <h2 className="register-title">Report Bank Account</h2>
            <p className="register-desc">
              Required before trading. Your bank details & contact info are reported to the escrow
              contract and used by the AI arbiter to verify payment proofs.
            </p>
          </div>
        </div>

        <div className="tips-box">
          <strong>Why is this required?</strong>
          <ul>
            <li>The escrow refuses any offer or lock from an address with no reported profile</li>
            <li>Sellers: buyers can contact you via Telegram/Email (optional)</li>
            <li>AI arbiter uses your reported name to match payment receipts</li>
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
              <option value="">Select bank...</option>
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

          <div className="form-group">
            <label>Contact Handle (Optional)</label>
            <input
              className="input"
              type="text"
              placeholder="@username (Telegram) or email@example.com"
              value={form.contactHandle}
              onChange={e => set('contactHandle', e.target.value)}
            />
            <span className="hint">Buyers can contact you directly via Telegram or Email</span>
          </div>

          <button className="btn btn-primary w-full" type="submit" disabled={loading || !address}>
            {loading ? 'Reporting...' : 'Report & Continue'}
          </button>
        </form>

        {status && <div className="alert alert-info">{status}</div>}
        {error  && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  )
}
