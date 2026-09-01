import React from 'react'
import { useWallet } from '../WalletContext.jsx'

export default function WalletConnect() {
  const { address, walletType, isConnecting, isWrongNetwork, error, connect, disconnect, switchToBradbury } = useWallet()

  if (address) {
    return (
      <div className="wallet-connected">
        {isWrongNetwork && (
          <button className="btn btn-danger btn-sm" onClick={switchToBradbury}>
            ⚠️ Switch Network
          </button>
        )}
        <div className="wallet-info">
          <span className="dot green" />
          <span className="wallet-badge">{walletType === 'rabby' ? '🐰' : '🦊'}</span>
          <span className="wallet-address">{address.slice(0, 6)}…{address.slice(-4)}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return (
    <div className="wallet-disconnected">
      <button className="btn btn-primary btn-sm" onClick={connect} disabled={isConnecting}>
        {isConnecting ? '⟳ Connecting…' : '🔗 Connect Wallet'}
      </button>
      {error && <span className="wallet-error">{error}</span>}
    </div>
  )
}
