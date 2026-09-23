import React, { useState } from 'react'
import { useWallet } from '../useWallet.js'
import { withWalletTimeout } from '../p2pClient.js'

export default function WalletConnect() {
  const { address, provider, walletType, isConnecting, isWrongNetwork, error, connect, disconnect, switchToBradbury } = useWallet()
  const [tesStatus, setTesStatus] = useState('')

  async function tesPopup() {
    if (!provider || !address) return
    setTesStatus('menunggu popup…')
    try {
      await withWalletTimeout(
        provider.request({
          method: 'personal_sign',
          params: ['0x54657374205469747020503150', address],
        }),
        60000,
        'Tes popup'
      )
      setTesStatus('dompet merespons ✓')
    } catch (err) {
      setTesStatus(`gagal: ${err.message || err}`)
    }
    setTimeout(() => setTesStatus(''), 8000)
  }

  if (address) {
    return (
      <div className="wallet-connected">
        {isWrongNetwork && (
          <button className="btn btn-danger btn-sm" onClick={switchToBradbury}>
            Switch Network
          </button>
        )}
        <div className="wallet-info">
          <span className="dot green" />
          <span className="wallet-badge">{walletType === 'rabby' ? 'R' : 'M'}</span>
          <span className="wallet-address">{address.slice(0, 6)}…{address.slice(-4)}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={tesPopup} title="Tes apakah dompet mau memunculkan popup">Tes popup</button>
        <button className="btn btn-ghost btn-sm" onClick={disconnect}>Disconnect</button>
        {tesStatus && <span className="wallet-error">{tesStatus}</span>}
      </div>
    )
  }

  return (
    <div className="wallet-disconnected">
      <button className="btn btn-primary btn-sm" onClick={connect} disabled={isConnecting}>
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {error && <span className="wallet-error">{error}</span>}
    </div>
  )
}
