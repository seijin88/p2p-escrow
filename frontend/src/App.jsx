import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from './WalletContext.jsx'
import WalletConnect from './components/WalletConnect.jsx'
import OfferBoard from './components/OfferBoard.jsx'
import PostOfferForm from './components/PostOfferForm.jsx'
import TradeDetail from './components/TradeDetail.jsx'
import TradeHistory from './components/TradeHistory.jsx'
import RegisterForm from './components/RegisterForm.jsx'
import Landing from './components/Landing.jsx'
import { isRegistered, P2P_ESCROW_ADDRESS, shortAddr } from './p2pClient.js'

export default function App() {
  const { address, isWrongNetwork, switchToBradbury } = useWallet()
  const [view, setView]       = useState('board')
  const [activeTrade, setActiveTrade] = useState(null)
  const [showPostForm, setShowPostForm] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [checkingReg, setCheckingReg] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showLanding, setShowLanding] = useState(true)

  const checkReg = useCallback(async () => {
    if (!address) { setRegistered(false); return }
    setCheckingReg(true)
    try { setRegistered(await isRegistered(address)) }
    catch { /* silent */ }
    finally { setCheckingReg(false) }
  }, [address])

  useEffect(() => { checkReg() }, [checkReg])

  function goToTrade(id)    { setActiveTrade(id); setView('trade') }
  function goBack()         { setActiveTrade(null); setView('board') }
  function handleRegistered() {
    setShowRegister(false)
    setTimeout(checkReg, 4000)
  }

  const NAV = [
    { id: 'board',    label: 'Pasar' },
    { id: 'mytrades', label: 'Transaksiku' },
    { id: 'history',  label: 'Buku Kas' },
  ]

  if (showLanding) return <Landing onLaunch={() => setShowLanding(false)} />

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-area" onClick={() => { setView('board'); setActiveTrade(null) }}>
            <span className="logo-cap" aria-hidden="true">T</span>
            <div>
              <h1 className="app-title">Titip<span className="title-sep">·</span><em>P2P</em></h1>
              <p className="app-subtitle">pasar escrow · wasit AI · Bradbury</p>
            </div>
          </div>
          <nav className="main-nav">
            {NAV.map(n => (
              <button key={n.id} className={`nav-btn ${view === n.id ? 'active' : ''}`}
                onClick={() => { setView(n.id); setActiveTrade(null) }}>
                {n.label}
              </button>
            ))}
          </nav>
          <div className="header-right">
            <WalletConnect />
            {address && (
              <button
                className={`cap-daftar ${registered ? 'sudah' : 'belum'}`}
                onClick={() => !registered && setShowRegister(true)}
                title={registered ? 'Terdaftar di kontrak' : 'Daftar ke kontrak'}>
                {checkingReg ? '…' : registered ? '✓ Terdaftar' : '○ Daftar'}
              </button>
            )}
            <div className="network-badge"><span className="dot green" />Bradbury</div>
          </div>
        </div>
        {isWrongNetwork && (
          <div className="network-banner">Jaringan salah. <button className="banner-link" onClick={switchToBradbury}>Pindah ke Bradbury</button></div>
        )}
        {address && !checkingReg && !registered && !showRegister && (
          <div className="profile-banner">Daftar ke kontrak dulu sebelum jual/beli. <button className="banner-link" onClick={() => setShowRegister(true)}>Daftar sekarang</button></div>
        )}
      </header>

      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div onClick={e => e.stopPropagation()}>
            <RegisterForm onRegistered={handleRegistered} />
            <button className="btn btn-ghost btn-sm modal-batal" onClick={() => setShowRegister(false)}>Batal</button>
          </div>
        </div>
      )}

      <main className="app-main">
        {view === 'board' && (
          <>
            <div className="page-actions">
              {address
                ? registered
                  ? <button className="btn btn-primary" onClick={() => setShowPostForm(true)}>+ Pasang Lapak Jual</button>
                  : <button className="btn btn-secondary" onClick={() => setShowRegister(true)}>Daftar untuk Berjualan</button>
                : <div className="alert alert-info connect-prompt">Sambungkan dompet untuk bertransaksi.</div>
              }
            </div>
            <OfferBoard
              onTradeCreated={tid => (tid !== null && tid !== undefined) ? goToTrade(tid) : setView('mytrades')}
              registered={registered}
              onNeedRegister={() => setShowRegister(true)}
            />
          </>
        )}
        {view === 'trade' && activeTrade !== null && (
          <TradeDetail tradeId={activeTrade} onBack={goBack} />
        )}
        {view === 'history' && <TradeHistory onViewTrade={goToTrade} />}
        {view === 'mytrades' && <TradeHistory onViewTrade={goToTrade} defaultTab="mine" />}
      </main>

      {showPostForm && (
        <PostOfferForm onSuccess={() => setShowPostForm(false)} onClose={() => setShowPostForm(false)} />
      )}

      <footer className="app-footer">
        <p>Titip P2P Escrow · di atas <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a></p>
        <p className="app-footer-address" title={P2P_ESCROW_ADDRESS}>
          Kontrak: <code>{P2P_ESCROW_ADDRESS ? shortAddr(P2P_ESCROW_ADDRESS) : '— belum diisi —'}</code>
          {' '}— verifikasi alamat ini sebelum tanda tangan.
        </p>
      </footer>
    </div>
  )
}
