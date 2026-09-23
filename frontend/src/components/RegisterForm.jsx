import React from 'react'
import { useWallet } from '../useWallet.js'
import { registerAccount, waitForTransaction } from '../p2pClient.js'

export default function RegisterForm({ onRegistered }) {
  const { walletClient, address } = useWallet()
  const [loading, setLoading] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!walletClient || !address) return setError('Sambungkan dompet dulu')
    setError(''); setStatus(''); setLoading(true)
    try {
      setStatus('Mendaftarkan alamatmu ke kontrak…')
      const hash = await registerAccount(walletClient)
      setStatus('Menunggu finalisasi… (bisa 1–2 menit)')
      await waitForTransaction(hash)
      setStatus('Terdaftar!')
      setTimeout(() => onRegistered?.(), 1200)
    } catch (err) {
      setError(err.message || 'Transaksi gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <div className="register-header">
          <span className="register-icon" aria-hidden="true">✎</span>
          <div>
            <h2 className="register-title">Daftar ke Kontrak</h2>
            <p className="register-desc">
              Satu kali daftar, tanpa data pribadi. Cukup alamat dompetmu yang
              dicatat — data bank tetap privat dan ditukar langsung antar penjual–pembeli.
            </p>
          </div>
        </div>

        <div className="tips-box">
          <strong>Kenapa wajib daftar?</strong>
          <ul>
            <li>Kontrak menolak offer & order dari alamat yang belum terdaftar</li>
            <li>Tidak ada data bank yang naik ke chain — privasimu aman</li>
            <li>Tidak ada admin: siapa pun hanya bisa daftarkan dirinya sendiri</li>
          </ul>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Alamat dompet</label>
            <input className="input mono" type="text" value={address || ''} readOnly />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={loading || !address}>
            {loading ? 'Mendaftar…' : 'Daftar Sekarang'}
          </button>
        </form>

        {status && <div className="alert alert-info">{status}</div>}
        {error  && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  )
}
