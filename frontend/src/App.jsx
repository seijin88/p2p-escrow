import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from './WalletContext.jsx'
import WalletConnect from './components/WalletConnect.jsx'
import OfferBoard from './components/OfferBoard.jsx'
import PostOfferForm from './components/PostOfferForm.jsx'
import TradeDetail from './components/TradeDetail.jsx'
import TradeHistory from './components/TradeHistory.jsx'
import RegisterForm from './components/RegisterForm.jsx'
import { isRegistered, getProfile } from './profileClient.js'

const PROFILE_KEY = 'p2p_escrow_profile'

export default function App() {
  const { address, isWrongNetwork, switchToBradbury } = useWallet()
  const [view, setView] = useState('board')
  const [activeTrade, setActiveTrade] = useState(null)
  const [showPostForm, setShowPostForm] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

  const [hasProfile, setHasProfile] = useState(() => {
    try { return !!JSON.parse(localStorage.getItem(PROFILE_KEY)) } catch { return false }
  })
  const [userProfile, setUserProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) } catch { return null }
  })

  function saveProfile(p) {
    setHasProfile(true)
    setUserProfile(p)
    if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  }

  const checkProfile = useCallback(async () => {
    if (!address) { setProfileChecked(true); return }
    const addr = import.meta.env.VITE_USER_PROFILE_ADDRESS
    if (!addr || addr === '0x0000000000000000000000000000000000000000') {
      setHasProfile(true); setProfileChecked(true); return
    }
    try {
      const ok = await isRegistered(address)
      if (ok) {
        const p = await getProfile(address)
        if (p && p.account_name) saveProfile(p)
        else setHasProfile(true)
      }
    } catch {}
    finally { setProfileChecked(true) }
  }, [address])

  useEffect(() => { checkProfile() }, [checkProfile])

  function goToTrade(id) { setActiveTrade(id); setView('trade') }
  function goBack() { setActiveTrade(null); setView('board') }

  function handleRegistered(data) {
    setShowRegister(false)
    saveProfile(data || { account_name: 'Registered' })
    setTimeout(checkProfile, 5000)
  }

  const NAV = [
    { id: 'board',    label: 'Offers' },
    { id: 'mytrades', label: 'My Trades' },
    { id: 'history',  label: 'History' },
  ]

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-area" onClick={() => setView('board')} style={{cursor:'pointer'}}>
            <span className="logo-icon">&#9889;</span>
            <div>
              <h1 className="app-title">P2P Escrow</h1>
              <p className="app-subtitle">Crypto to Fiat via GenLayer AI</p>
            </div>
          </div>
          <nav className="main-nav">
            {NAV.map(n => (
              <button key={n.id} className={`nav-btn ${view===n.id?'active':''}`}
                onClick={() => { setView(n.id); setActiveTrade(null) }}>
                {n.label}
              </button>
            ))}
          </nav>
          <div className="header-right">
            <WalletConnect />
            {address && (
              <button className={`profile-badge ${hasProfile?'registered':'unregistered'}`}
                onClick={() => setShowRegister(true)}>
                {hasProfile ? `Bank: ${userProfile?.account_name?.split(' ')[0]||'OK'}` : 'Register Bank'}
              </button>
            )}
            <div className="network-badge"><span className="dot green"/>Bradbury</div>
          </div>
        </div>
        {isWrongNetwork && (
          <div className="network-banner">Wrong network. <button className="banner-link" onClick={switchToBradbury}>Switch to Bradbury</button></div>
        )}
        {address && profileChecked && !hasProfile && !showRegister && (
          <div className="profile-banner">Register your bank account to trade. <button className="banner-link" onClick={() => setShowRegister(true)}>Register now</button></div>
        )}
      </header>

      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div onClick={e => e.stopPropagation()}>
            <RegisterForm onRegistered={handleRegistered} />
            <button className="btn btn-ghost btn-sm" style={{margin:'8px auto',display:'block'}} onClick={() => setShowRegister(false)}>Cancel</button>
          </div>
        </div>
      )}

      <main className="app-main">
        {view === 'board' && (
          <>
            <div className="page-actions">
              {address
                ? hasProfile
                  ? <button className="btn btn-primary" onClick={() => setShowPostForm(true)}>+ Post Sell Offer</button>
                  : <button className="btn btn-secondary" onClick={() => setShowRegister(true)}>Register Bank to Sell</button>
                : <div className="alert alert-info connect-prompt">Connect wallet to trade.</div>
              }
            </div>
            <OfferBoard
              onTradeCreated={id => id && id > 0 ? goToTrade(id) : setView('mytrades')}
              hasProfile={hasProfile}
              onNeedProfile={() => setShowRegister(true)}
            />
          </>
        )}
        {view === 'trade' && activeTrade !== null && (
          <TradeDetail tradeId={activeTrade} onBack={goBack} onSettled={() => {}} />
        )}
        {view === 'history' && <TradeHistory onViewTrade={goToTrade} />}
        {view === 'mytrades' && <TradeHistory onViewTrade={goToTrade} defaultTab="mine" />}
      </main>

      {showPostForm && (
        <PostOfferForm onSuccess={() => setShowPostForm(false)} onClose={() => setShowPostForm(false)} userProfile={userProfile} />
      )}

      <footer className="app-footer">
        <p>P2P Escrow built on <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a></p>
      </footer>
    </div>
  )
}
