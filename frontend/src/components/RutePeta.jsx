import React from 'react'
import { shortAddr } from '../p2pClient.js'

// Peta rute skematik ala peta transit: Penjual → Brankas → Pembeli.
// Garis putus animasi = GEN masih jalan; garis penuh = sampai.
export default function RutePeta({ trade }) {
  if (!trade) return null
  const st = trade.status
  const kePembeli = st === 'released'
  const kePenjual = st === 'refunded'
  const jalan = st === 'locked'

  const garisKiri = kePenjual ? 'jalur-balik' : 'jalur-aktif'
  const garisKanan = kePembeli ? 'jalur-sampai' : jalan ? 'jalur-jalan' : 'jalur-mati'

  return (
    <div className="peta-rute">
      <span className="label">Peta rute GEN</span>
      <svg viewBox="0 0 600 150" className="peta-svg" role="img" aria-label="Rute escrow">
        <line x1="70" y1="75" x2="290" y2="75" className={`jalur ${garisKiri}`} strokeWidth="4" />
        <line x1="310" y1="75" x2="530" y2="75" className={`jalur ${garisKanan}`} strokeWidth="4" />
        {kePenjual && (
          <polygon points="78,67 78,83 62,75" className="panah-balik" />
        )}
        {(kePembeli || jalan) && (
          <polygon points="522,67 522,83 538,75" className="panah-maju" />
        )}
        <g className="stasiun">
          <circle cx="60" cy="75" r="16" className="node" />
          <text x="60" y="79" textAnchor="middle" className="node-huruf">J</text>
          <text x="60" y="112" textAnchor="middle" className="node-nama">Penjual</text>
          <text x="60" y="128" textAnchor="middle" className="node-addr">{shortAddr(trade.seller)}</text>
        </g>
        <g className="stasiun">
          <circle cx="300" cy="75" r="22" className="node brankas" />
          <text x="300" y="81" textAnchor="middle" className="node-huruf">◈</text>
          <text x="300" y="112" textAnchor="middle" className="node-nama">Brankas</text>
          <text x="300" y="128" textAnchor="middle" className="node-addr">kontrak</text>
        </g>
        <g className="stasiun">
          <circle cx="540" cy="75" r="16" className="node" />
          <text x="540" y="79" textAnchor="middle" className="node-huruf">B</text>
          <text x="540" y="112" textAnchor="middle" className="node-nama">Pembeli</text>
          <text x="540" y="128" textAnchor="middle" className="node-addr">{shortAddr(trade.buyer)}</text>
        </g>
      </svg>
      <p className="peta-ket">
        {st === 'locked' && 'GEN tertahan di brankas — menunggu rilis / putusan.'}
        {st === 'released' && 'GEN sampai ke pembeli.'}
        {st === 'refunded' && 'GEN kembali ke penjual.'}
        {!['locked', 'released', 'refunded'].includes(st) && `Status: ${st}`}
      </p>
    </div>
  )
}
