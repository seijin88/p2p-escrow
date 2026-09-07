import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from './WalletContext.jsx'
import WalletConnect from './components/WalletConnect.jsx'
import OfferBoard from './components/OfferBoard.jsx'
import PostOfferForm from './components/PostOfferForm.jsx'
import TradeDetail from './components/TradeDetail.jsx'
import TradeHistory from './components/TradeHistory.jsx'
import RegisterForm from './components/RegisterForm.jsx'
import { isRegistered, getProfile } from './profileClient.js'

// ── Simple client-side router ────────────────────────────────────────────────
// view: 'board' | 'trade' | 'history'

export default function App() {
  const { address, isWrongNetwork, switchToBradbury } = useWallet()

  const [view, setView]               = useState('board')
  const [activeTrade, setActiveTrade] = useState(null)
  const [showPostForm, setShowPostForm] = useState(false)

  // Profile state
  const [profileChecked, setProfileChecked] = useState(false)
  const [hasProfile, setHasProfile]         = useState(false)
  const [userProfile, setUserProfile]       = useState(null)
  const [showRegister, setShowRegister]     = useState(false)

  // Check profile whenever wallet address changes
  const checkProfile = useCallback(async () => {
    if (!address) {
      setProfileChecked(false)
      setHasProfile(false)
      setUserProfile(null)
      return
    }
    // Skip profile check if contract not configured
    const profileAddr = import.meta.env.VITE_USER_PROFILE_ADDRESS
    if (!profileAddr || profileAddr === '0x0000000000000000000000000000000000000000') {
      setHasProfile(true) // treat as registered when profile contract not deployed yet
      setProfileChecked(true)
      return
    }
    try {
      const registered = await isRegistered(address)
      setHasProfile(!!registered)
      if (registered) {
        const p = await getProfile(address)
        setUserProfile(p)
      }
    } catch {
      setHasProfile(false)
    } finally {
      setProfileChecked(true)
    }
  }, [address])

  useEffect(() => { checkProfile() }, [checkProfile])

  function goToTrade(tradeId) {
    setActiveTrade(tradeId)
    setView('trade')
  }

  function goBack() {
    setActiveTrade(null)
    setView('board')
  }

  function handleRegistered() {
    setShowRegister(false)
    checkProfile()
  }

  const NAV = [
    { id: 'board',   label: '⚡ Offers',  desc: 'Open marketplace' },
    { id: 'history', label: '📋 History', desc: 'All trades' },
  ]

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-area" onClick={() => setView('board')} style={{ cursor: 'pointer' }}>
            <span className="logo-icon">⚡</span>
            <div>
              <h1 className="app-title">P2P Escrow</h1>
              <p className="app-subtitle">Crypto → Fiat · GenLayer AI Consensus</p>
            </div>
          </div>

          <nav className="main-nav">
            {NAV.map(n => (
              <button
                key={n.id}
                className={`nav-btn ${view === n.id ? 'active' : ''}`}
                onClick={() => { setView(n.id); setActiveTrade(null) }}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="header-right">
            <WalletConnect />
            {/* Profile indicator */}
            {address && profileChecked && (
              <button
                className={`profile-badge ${hasProfile ? 'registered' : 'unregistered'}`}
                onClick={() => setShowRegister(true)}
                title={hasProfile ? `${userProfile?.bank_name} ${userProfile?.account_number}` : 'Register bank account'}
              >
                {hasProfile ? `🏦 ${userProfile?.account_name?.split(' ')[0]}` : '⚠️ Register'}
              </button>
            )}
            <div className="network-badge">
              <span className="dot green" />
              Bradbury
            </div>
          </div>
        </div>

        {/* Wrong network banner */}
        {isWrongNetwork && (
          <div className="network-banner">
            ⚠️ Wrong network.{' '}
            <button className="banner-link" onClick={switchToBradbury}>
              Switch to GenLayer Testnet Bradbury →
            </button>
          </div>
        )}

        {/* Profile not registered banner */}
        {address && profileChecked && !hasProfile && !showRegister && (
          <div className="profile-banner">
            🏦 Register your bank account to post offers or lock orders.{' '}
            <button className="banner-link" onClick={() => setShowRegister(true)}>
              Register now →
            </button>
          </div>
        )}
      </header>

      {/* ── Register Modal ── */}
      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div onClick={e => e.stopPropagation()}>
            <RegisterForm onRegistered={handleRegistered} />
            <button
              className="btn btn-ghost btn-sm"
              style={{ margin: '8px auto', display: 'block' }}
              onClick={() => setShowRegister(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="app-main">

        {/* OFFER BOARD */}
        {view === 'board' && (
          <>
            <div className="page-actions">
              {address ? (
                hasProfile ? (
                  <button className="btn btn-primary" onClick={() => setShowPostForm(true)}>
                    + Post Sell Offer
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={() => setShowRegister(true)}>
                    🏦 Register Bank Account to Sell
                  </button>
                )
              ) : (
                <div className="alert alert-info connect-prompt">
                  🔗 Connect your Rabby or MetaMask wallet to post offers or trade.
                </div>
              )}
            </div>

            <OfferBoard
              onTradeCreated={(tradeId) => tradeId && goToTrade(tradeId)}
              hasProfile={hasProfile}
              onNeedProfile={() => setShowRegister(true)}
            />
          </>
        )}

        {/* TRADE DETAIL */}
        {view === 'trade' && activeTrade !== null && (
          <TradeDetail
            tradeId={activeTrade}
            onBack={goBack}
            onSettled={() => {}}
          />
        )}

        {/* HISTORY */}
        {view === 'history' && (
          <TradeHistory onViewTrade={(tradeId) => goToTrade(tradeId)} />
        )}
      </main>

      {/* ── Post Offer Modal ── */}
      {showPostForm && (
        <PostOfferForm
          onSuccess={() => setShowPostForm(false)}
          onClose={() => setShowPostForm(false)}
          userProfile={userProfile}
        />
      )}

      {/* ── Footer ── */}
      <footer className="app-footer">
        <p>
          P2P Escrow — Built on{' '}
          <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a>
          {' '}· AI-verified · Trustless
        </p>
      </footer>
    </div>
  )
}
