import React, { useState } from 'react'
import { useWallet } from './WalletContext.jsx'
import WalletConnect from './components/WalletConnect.jsx'
import OfferBoard from './components/OfferBoard.jsx'
import PostOfferForm from './components/PostOfferForm.jsx'
import TradeDetail from './components/TradeDetail.jsx'
import TradeHistory from './components/TradeHistory.jsx'

// ── Simple client-side router (no react-router needed) ──────────────────────
// view: 'board' | 'trade' | 'history' | 'reputation'

export default function App() {
  const { address, isWrongNetwork, switchToBradbury } = useWallet()
  const [view, setView]             = useState('board')
  const [activeTrade, setActiveTrade] = useState(null)   // trade_id number
  const [showPostForm, setShowPostForm] = useState(false)

  function goToTrade(tradeId) {
    setActiveTrade(tradeId)
    setView('trade')
  }

  function goBack() {
    setActiveTrade(null)
    setView('board')
  }

  const NAV = [
    { id: 'board',      label: '⚡ Offers',   desc: 'Open marketplace' },
    { id: 'history',    label: '📋 History',  desc: 'All trades' },
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
            <div className="network-badge">
              <span className="dot green" />
              Bradbury
            </div>
          </div>
        </div>

        {/* Wrong network banner */}
        {isWrongNetwork && (
          <div className="network-banner">
            ⚠️ Wrong network detected.{' '}
            <button className="banner-link" onClick={switchToBradbury}>
              Switch to GenLayer Testnet Bradbury →
            </button>
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main className="app-main">

        {/* OFFER BOARD */}
        {view === 'board' && (
          <>
            <div className="page-actions">
              {address ? (
                <button className="btn btn-primary" onClick={() => setShowPostForm(true)}>
                  + Post Sell Offer
                </button>
              ) : (
                <div className="alert alert-info connect-prompt">
                  🔗 Connect your Rabby or MetaMask wallet to post offers or trade.
                </div>
              )}
            </div>

            <OfferBoard
              onTradeCreated={(tradeId) => tradeId && goToTrade(tradeId)}
            />
          </>
        )}

        {/* TRADE DETAIL */}
        {view === 'trade' && activeTrade !== null && (
          <TradeDetail
            tradeId={activeTrade}
            onBack={goBack}
            onSettled={() => {
              // stay on trade page to show verdict, but refresh history
            }}
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
        />
      )}

      {/* ── Footer ── */}
      <footer className="app-footer">
        <p>
          P2P Escrow — Built on{' '}
          <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a>
          {' '}· AI-verified · Trustless · Open source
        </p>
      </footer>
    </div>
  )
}
