import React, { useState } from 'react'
import { useWallet } from '../WalletContext.jsx'
import { createOffer, waitForTransaction, fmt } from '../p2pClient.js'

const GEN_WEI = 10n ** 18n

export default function PostOfferForm({ onSuccess, onClose }) {
  const { walletClient, address } = useWallet()
  const [form, setForm] = useState({ gen: '1', fiat: '150000', rate: '150000', methods: 'DANA' })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!walletClient || !address) return setError('Sambungkan dompet dulu')
    let amountWei
    try {
      const gen = Number(String(form.gen).replace(',', '.'))
      if (!(gen > 0)) throw new Error('isi')
      amountWei = BigInt(Math.round(gen * 1e18))
    } catch { return setError('Jumlah GEN tidak valid') }
    setError(''); setStatus(''); setLoading(true)
    try {
      setStatus('Mengirim GEN ke kontrak…')
      const hash = await createOffer(walletClient, {
        fiatCurrency: 'IDR',
        fiatAmount: form.fiat,
        rate: form.rate,
        paymentMethods: form.methods,
        amountWei: amountWei.toString(),
      })
      setStatus('Menunggu finalisasi… (bisa 1–2 menit)')
      await waitForTransaction(hash)
      setStatus('Lapak terpasang!')
      setTimeout(() => onSuccess?.(), 1200)
    } catch (err) {
      setError(err.message || 'Transaksi gagal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="karcis karcis-form" onClick={e => e.stopPropagation()}>
        <div className="karcis-kepala">
          <span className="karcis-nomor">LAPAK BARU</span>
        </div>
        <h2 className="form-title">Pasang Lapak Jual</h2>
        <p className="form-desc">GEN dikunci di kontrak. Rupiah dibayar pembeli langsung ke kamu.</p>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Jumlah (GEN)</label>
            <input className="input mono" value={form.gen} onChange={e => set('gen', e.target.value)} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Minta (IDR)</label>
              <input className="input mono" value={form.fiat} onChange={e => set('fiat', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Kurs (IDR/GEN)</label>
              <input className="input mono" value={form.rate} onChange={e => set('rate', e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label>Terima via</label>
            <input className="input" value={form.methods} onChange={e => set('methods', e.target.value)} placeholder="DANA, BCA, GoPay…" required />
          </div>
          <div className="form-ringkas">
            Mengunci <strong>{form.gen} GEN</strong> · minta <strong>Rp{Number(form.fiat || 0).toLocaleString('id-ID')}</strong>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={onClose}>Batal</button>
            <button className="btn btn-primary" type="submit" disabled={loading || !address}>
              {loading ? 'Memasang…' : 'Kunci & Pasang'}
            </button>
          </div>
        </form>
        {status && <div className="alert alert-info">{status}</div>}
        {error && <div className="alert alert-error">{error}</div>}
      </div>
    </div>
  )
}

export { GEN_WEI, fmt }
