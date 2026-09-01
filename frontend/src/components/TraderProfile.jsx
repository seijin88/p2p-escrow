import React, { useState } from 'react'
import { getTraderProfile } from '../p2pClient.js'
import { useWallet } from '../WalletContext.jsx'

export default function TraderProfile() {
  const { address } = useWallet()
  const [lookup, setLookup]   = useState('')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function fetchProfile(addr) {
    if (!addr || addr.length < 10) return
    setLoading(true); setError(''); setProfile(null)
    try {
      const data = await getTraderProfile(addr)
      setProfile(data)
    } catch (err) {
      setError('Could not fetch profile — check the address')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await fetchProfile(lookup.trim())
  }

  function scoreColor(score) {
    if (score >= 90) return 'var(--accent-green)'
    if (score >= 80) return 'var(--accent-yellow)'
    return 'var(--accent-red)'
  }

  return (
    <div className="form-container">
      <div className="form-header">
        <span className="form-icon">⭐</span>
        <div>
          <h3 className="form-title">Trader Reputation</h3>
          <p className="form-desc">Look up any trader's on-chain reputation score before trading.</p>
        </div>
      </div>

      {address && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 16 }}
          onClick={() => { setLookup(address); fetchProfile(address) }}
        >
          Check My Own Score
        </button>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Trader Address</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="0x…"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? '⟳' : 'Look Up'}
            </button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>❌ {error}</div>}

      {profile && (
        <div className="profile-card">
          <div className="profile-score-row">
            <div className="score-circle" style={{ borderColor: scoreColor(profile.score) }}>
              <span className="score-number" style={{ color: scoreColor(profile.score) }}>{profile.score}</span>
              <span className="score-label">/ 100</span>
            </div>
            <div>
              <div className="profile-address">{profile.address?.slice(0,6)}…{profile.address?.slice(-4)}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                {profile.is_eligible
                  ? <span className="status-badge badge-green">✅ Eligible to Trade</span>
                  : <span className="status-badge badge-red">❌ Below Min Score</span>
                }
                {profile.is_new_trader && (
                  <span className="status-badge badge-yellow">🌱 New Trader</span>
                )}
              </div>
            </div>
          </div>

          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-value">{profile.total_trades}</span>
              <span className="stat-label">Total Trades</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: 'var(--accent-green)' }}>{profile.successful_trades}</span>
              <span className="stat-label">Successful</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: 'var(--accent-red)' }}>{profile.disputed_trades}</span>
              <span className="stat-label">Disputed</span>
            </div>
            <div className="stat-item">
              <span className="stat-value" style={{ color: 'var(--accent-yellow)' }}>{profile.dispute_wins}</span>
              <span className="stat-label">Dispute Wins</span>
            </div>
          </div>

          {profile.is_new_trader && (
            <div className="alert alert-info" style={{ marginTop: 12 }}>
              🌱 New trader — less than 3 completed trades. Default score 100 until history builds up.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
