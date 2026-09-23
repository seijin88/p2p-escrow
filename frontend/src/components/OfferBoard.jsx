import React, { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../WalletContext.jsx'
import {
  getOpenOffers, getOfferCount, getTradeCount,
  lockOrder, cancelOffer, waitForTransaction,
  fmt, shortAddr, timeAgo, expiryLeft, isExpired,
} from '../p2pClient.js'
import StatusBadge from './StatusBadge.jsx'

export default function OfferBoard({ onTradeCreated, registered, onNeedRegister }) {
  const { address, walletClient } = useWallet()
  const [offers, setOffers] = useState([])
  const [counts, setCounts] = useState({ offers: 0, trades: 0 })
  const [loading, setLoading] = useState(false)
  const [actionState, setActionState] = useState({})

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [o, oc, tc] = await Promise.all([getOpenOffers(), getOfferCount(), getTradeCount()])
      setOffers(Array.isArray(o) ? o : [])
      setCounts({ offers: oc, trades: tc })
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  function pesanGalat(err) {
    const m = err?.message || 'Gagal'
    if (/user rejected|denied/i.test(m)) return 'Dibatalkan di dompet.'
    return m
  }

  async function handleLock(offerId) {
    if (!walletClient || !address) return
    if (!registered) { onNeedRegister?.(); return }
    setActionState(s => ({ ...s, [offerId]: { loading: true, status: 'Mengunci order…', error: '' } }))
    try {
      const hash = await lockOrder(walletClient, offerId)
      setActionState(s => ({ ...s, [offerId]: { loading: true, status: 'Menunggu finalisasi…', error: '' } }))
      await waitForTransaction(hash)
      setActionState(s => ({ ...s, [offerId]: { loading: false, status: 'Terkunci! Membuka nota…', error: '' } }))
      await refresh()
      const tc = await getTradeCount()
      onTradeCreated?.(tc > 0 ? tc - 1 : null)
    } catch (err) {
      setActionState(s => ({ ...s, [offerId]: { loading: false, status: '', error: pesanGalat(err) } }))
    }
  }

  async function handleCancel(offerId) {
    if (!walletClient || !address) return
    setActionState(s => ({ ...s, [offerId]: { loading: true, status: 'Membatalkan…', error: '' } }))
    try {
      const hash = await cancelOffer(walletClient, offerId)
      await waitForTransaction(hash)
      setActionState(s => ({ ...s, [offerId]: { loading: false, status: 'Lapak dibatalkan, dana kembali', error: '' } }))
      await refresh()
    } catch (err) {
      setActionState(s => ({ ...s, [offerId]: { loading: false, status: '', error: pesanGalat(err) } }))
    }
  }

  return (
    <div className="offer-board">
      <div className="board-header">
        <div>
          <h2 className="board-title">Lapak Buka</h2>
          <p className="board-subtitle">{counts.offers} lapak · {counts.trades} nota tercatat</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
          {loading ? '…' : '↻ Muat ulang'}
        </button>
      </div>

      {loading && offers.length === 0 && (
        <div className="empty-state"><p>Membuka lapak…</p></div>
      )}
      {!loading && offers.length === 0 && (
        <div className="empty-state">
          <p className="empty-big">Pasar sepi.</p>
          <p className="empty-sub">Jadilah yang pertama pasang lapak jual.</p>
        </div>
      )}

      <div className="offers-grid">
        {offers.map(offer => {
          const state = actionState[offer.offer_id] || {}
          const isMine = address && String(offer.seller).toLowerCase() === address.toLowerCase()
          const kedalu = isExpired(offer.expires_at)
          return (
            <article key={offer.offer_id} className={`karcis ${isMine ? 'punyaku' : ''}`}>
              <div className="karcis-kepala">
                <span className="karcis-nomor">№ {offer.offer_id}</span>
                <StatusBadge status={kedalu ? 'expired' : offer.status} />
                {isMine && <span className="tanda-ku">lapakmu</span>}
              </div>
              <div className="karcis-jumlah">
                <div>
                  <span className="jumlah-besar">{fmt.fmtWei(offer.crypto_amount)}</span>
                  <span className="jumlah-satuan">{offer.token}</span>
                </div>
                <div className="karcis-panah">⇄</div>
                <div className="karcis-fiat">
                  <span className="jumlah-besar">Rp{Number(offer.fiat_amount).toLocaleString('id-ID')}</span>
                  <span className="jumlah-satuan">{offer.fiat_currency}</span>
                </div>
              </div>
              <div className="karcis-perforasi" aria-hidden="true" />
              <dl className="karcis-meta">
                <div><dt>Kurs</dt><dd>Rp{Number(offer.rate).toLocaleString('id-ID')} / {offer.token}</dd></div>
                <div><dt>Bayar via</dt><dd>{offer.payment_methods}</dd></div>
                <div><dt>Pengepul</dt><dd className="mono">{shortAddr(offer.seller)}</dd></div>
                <div><dt>Dipasang</dt><dd>{timeAgo(offer.created_at)}</dd></div>
                <div><dt>Batas</dt><dd className={kedalu ? 'merah' : 'kuning'}>{expiryLeft(offer.expires_at)}</dd></div>
              </dl>
              {!isMine && (
                <p className="karcis-privat">Rekening penjual privat — minta langsung ke penjual sebelum bayar.</p>
              )}
              {state.status && <div className="alert alert-info offer-alert">{state.status}</div>}
              {state.error && <div className="alert alert-error offer-alert">{state.error}</div>}
              <div className="offer-actions">
                {isMine ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(offer.offer_id)} disabled={state.loading}>
                    {state.loading ? '…' : '✕ Tutup Lapak & Tarik Dana'}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary offer-lock-btn"
                    onClick={() => handleLock(offer.offer_id)}
                    disabled={state.loading || !address || kedalu}>
                    {state.loading ? 'Memproses…' : 'Beli — Kunci Order'}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
