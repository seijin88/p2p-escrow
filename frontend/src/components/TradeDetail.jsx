import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '../WalletContext.jsx'
import {
  getTrade, setProofUrl, releaseCrypto, forceRelease, arbitrateAI, getOwner,
  waitForTransaction, fmt, shortAddr,
} from '../p2pClient.js'
import StatusBadge from './StatusBadge.jsx'

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT

async function uploadToIPFS(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Pinata ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
}

const TAHAP = ['locked', 'verdict', 'done']
const TAHAP_LABEL = { locked: 'Dikunci', verdict: 'Putusan AI', done: 'Selesai' }

function tahapOf(trade) {
  if (!trade) return 0
  if (['released', 'refunded'].includes(trade.status)) return 2
  return trade.proof_url ? 1 : 0
}

export default function TradeDetail({ tradeId, onBack }) {
  const { address, walletClient } = useWallet()
  const [trade, setTrade] = useState(null)
  const [owner, setOwner] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [txStatus, setTxStatus] = useState('')
  const [error, setError] = useState('')
  const [proofUrl, setProofUrl] = useState('')
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [t, o] = await Promise.all([getTrade(tradeId), getOwner().catch(() => '')])
      setTrade(t)
      setOwner(o || '')
      if (t?.proof_url && !proofUrl) setProofUrl(t.proof_url)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [tradeId])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!trade || ['released', 'refunded'].includes(trade.status)) return
    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [trade, refresh])

  async function doAction(fn, label) {
    if (!walletClient) return setError('Sambungkan dompet dulu')
    setError(''); setTxStatus(''); setBusy(true)
    try {
      setTxStatus(`${label}…`)
      const hash = await fn()
      setTxStatus('Menunggu finalisasi… (bisa 1–2 menit)')
      await waitForTransaction(hash)
      setTxStatus(`${label} terekam.`)
      await refresh()
    } catch (err) {
      setError(err.message || 'Transaksi gagal')
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Harus file gambar (struk difoto)')
    if (file.size > 10 * 1024 * 1024) return setError('Maksimal 10MB')
    setUploading(true); setError(''); setTxStatus('Mengunggah ke IPFS…')
    try {
      const url = await uploadToIPFS(file)
      setProofUrl(url)
      setTxStatus('Terunggah. Klik “Kirim Bukti”.')
    } catch (err) {
      setError(err.message || 'Unggah gagal'); setTxStatus('')
    } finally {
      setUploading(false)
    }
  }

  if (loading && !trade) return <div className="nota"><p>Membuka nota…</p></div>
  if (!trade) return (
    <div className="empty-state">
      <p className="empty-big">Nota #{tradeId} tidak ketemu.</p>
      <button className="btn btn-ghost btn-sm" onClick={onBack}>Kembali</button>
    </div>
  )

  const isSeller = address?.toLowerCase() === String(trade.seller).toLowerCase()
  const isBuyer = address?.toLowerCase() === String(trade.buyer).toLowerCase()
  const isOwner = owner && address?.toLowerCase() === String(owner).toLowerCase()
  const selesai = ['released', 'refunded'].includes(trade.status)
  const tahap = tahapOf(trade)

  return (
    <div className="nota">
      <div className="nota-kepala">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Pasar</button>
        <h2>Nota #{trade.trade_id}</h2>
        <StatusBadge status={trade.status} />
        <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>{loading ? '…' : '↻'}</button>
      </div>

      <div className="rel-tahap">
        {TAHAP.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`rel-titik ${i < tahap ? 'lewat' : ''} ${i === tahap && !selesai ? 'jalan' : ''} ${selesai && i === 2 ? 'lewat' : ''}`}>
              <span className="rel-bola">{i < tahap || selesai && i === 2 ? '✓' : i + 1}</span>
              <span className="rel-nama">{TAHAP_LABEL[s]}</span>
            </div>
            {i < TAHAP.length - 1 && <div className={`rel-garis ${i < tahap ? 'lewat' : ''}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="nota-rincian">
        <div className="nota-jumlah">
          <div><span className="jumlah-besar">{fmt.fmtWei(trade.crypto_amount)}</span><span className="jumlah-satuan">{trade.token}</span></div>
          <div className="karcis-panah">⇄</div>
          <div><span className="jumlah-besar">Rp{Number(trade.fiat_amount).toLocaleString('id-ID')}</span><span className="jumlah-satuan">{trade.fiat_currency}</span></div>
        </div>
        <div className="karcis-perforasi" aria-hidden="true" />
        <dl className="karcis-meta">
          <div><dt>Kurs</dt><dd>Rp{Number(trade.rate).toLocaleString('id-ID')} / {trade.token}</dd></div>
          <div><dt>Bayar via</dt><dd>{trade.payment_methods}</dd></div>
          <div><dt>Penjual</dt><dd className="mono">{shortAddr(trade.seller)}{isSeller ? ' (kamu)' : ''}</dd></div>
          <div><dt>Pembeli</dt><dd className="mono">{shortAddr(trade.buyer)}{isBuyer ? ' (kamu)' : ''}</dd></div>
        </dl>
      </div>

      {isBuyer && trade.status === 'locked' && (
        <div className="bank-info-box">
          <div className="bank-info-title">Bayar ke penjual, lalu kirim bukti</div>
          <p className="action-desc">
            Transfer <strong>Rp{Number(trade.fiat_amount).toLocaleString('id-ID')}</strong> via <strong>{trade.payment_methods}</strong> —
            rekening penjual privat, minta langsung ke penjual. Foto struknya (file gambar, bukan link album).
          </p>
        </div>
      )}

      {(trade.proof_url || (isBuyer && trade.status === 'locked')) && (
        <div className="bukti-box">
          <span className="label">Bukti bayar</span>
          {trade.proof_url && (
            <a href={trade.proof_url} target="_blank" rel="noreferrer" className="link bukti-link">Lihat bukti di IPFS</a>
          )}
          {isBuyer && trade.status === 'locked' && (
            <>
              <div
                className={`ipfs-dropzone ${dragOver ? 'drag-active' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
                onClick={() => !uploading && fileInputRef.current?.click()}
                role="button" tabIndex={0}>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files?.[0])} />
                <span className="ipfs-drop-text">
                  {uploading ? 'Mengunggah…' : 'Seret foto struk ke sini, atau klik untuk pilih'}
                  <br /><small>Gambar saja, maks 10MB</small>
                </span>
              </div>
              <div className="proof-input-row">
                <input className="input mono" type="url" placeholder="https://… (link file gambar langsung)"
                  value={proofUrl} onChange={e => setProofUrl(e.target.value)} />
                <button className="btn btn-primary"
                  disabled={busy || uploading || !proofUrl.startsWith('http')}
                  onClick={() => doAction(() => setProofUrl(walletClient, tradeId, proofUrl), 'Mengirim bukti')}>
                  {busy ? '…' : 'Kirim Bukti'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {trade.seller_note && (
        <div className="catatan-box">
          <span className="label">Pernyataan penjual</span>
          <p>“{trade.seller_note}”</p>
        </div>
      )}

      {selesai && (
        <div className={`vonis-card ${trade.status}`}>
          <div className="vonis-title">
            {trade.status === 'released' ? 'GEN diteruskan ke pembeli' : 'GEN dikembalikan ke penjual'}
          </div>
          <StatusBadge status={trade.status} />
        </div>
      )}

      {!selesai && (
        <div className="trade-actions">
          <h4 className="actions-title">Tindakan</h4>

          {(isSeller || isOwner) && trade.status === 'locked' && (
            <div className="action-block">
              <p className="action-desc">
                {isSeller ? 'Uang sudah masuk? Rilis GEN ke pembeli. Sengketa? Minta wasit AI menilai.' : 'Darurat owner: teruskan paksa ke pembeli.'}
              </p>
              <div className="action-row">
                <button className="btn btn-accent flex-1" disabled={busy}
                  onClick={() => doAction(() => releaseCrypto(walletClient, tradeId), 'Merilis GEN')}>
                  {busy ? '…' : 'Rilis GEN'}
                </button>
                {isOwner && (
                  <button className="btn btn-ghost flex-1" disabled={busy}
                    onClick={() => doAction(() => forceRelease(walletClient, tradeId), 'Force release')}>
                    {busy ? '…' : 'Force'}
                  </button>
                )}
              </div>
            </div>
          )}

          {(isSeller || isOwner) && trade.status === 'locked' && trade.proof_url && (
            <div className="action-block">
              <p className="action-desc">Tidak sepakat dengan bukti? Wasit AI membaca foto struk + pernyataanmu.</p>
              <textarea
                className="input"
                rows={2}
                maxLength={500}
                placeholder="Pernyataanmu, mis. “dana 150rb via DANA sudah masuk 23 Sep”"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <button className="btn btn-secondary w-full" disabled={busy || note.trim().length < 1}
                onClick={() => doAction(() => arbitrateAI(walletClient, tradeId, note.trim()), 'Wasit AI menilai (30–60 dtk)')}>
                {busy ? 'AI menilai…' : 'Minta Wasit AI'}
              </button>
            </div>
          )}

          {!isSeller && !isBuyer && !isOwner && (
            <div className="alert alert-warning">Sambungkan dompet penjual/pembeli untuk bertindak.</div>
          )}
        </div>
      )}

      {txStatus && <div className="alert alert-info">{txStatus}</div>}
      {error && <div className="alert alert-error">Galat: {error}</div>}
    </div>
  )
}
