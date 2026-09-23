import React, { useMemo } from 'react'
import { shortAddr } from '../p2pClient.js'

// Peta ilustrasi acak per trade (seed = trade ID): blok kota + rute
// Penjual → Brankas → Pembeli. Bukan lokasi sebenarnya.
function mulberry32(seed) {
  let a = Number(seed) >>> 0 || 1
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function bangunPeta(tradeId) {
  const rnd = mulberry32(Number(tradeId) * 2654435761 + 7)
  const blok = []
  for (let i = 0; i < 26; i++) {
    const w = 30 + rnd() * 70
    const h = 18 + rnd() * 44
    blok.push({
      x: rnd() * (600 - w), y: 8 + rnd() * (204 - h), w, h,
      o: 0.25 + rnd() * 0.5,
    })
  }
  const jalan = []
  for (let i = 0; i < 5; i++) {
    const y = 10 + rnd() * 200
    jalan.push(`M0,${y.toFixed(0)} L600,${(y + (rnd() - 0.5) * 40).toFixed(0)}`)
  }
  for (let i = 0; i < 5; i++) {
    const x = 20 + rnd() * 560
    jalan.push(`M${x.toFixed(0)},0 L${(x + (rnd() - 0.5) * 40).toFixed(0)},220`)
  }
  const titik = (x, spread = 26) => [
    x + (rnd() - 0.5) * spread,
    110 + (rnd() - 0.5) * 120,
  ]
  const [ax, ay] = titik(160)
  const [bx, by] = titik(440)
  const rute = `M60,110 L${ax.toFixed(0)},${ay.toFixed(0)} L300,110 L${bx.toFixed(0)},${by.toFixed(0)} L540,110`
  return { blok, jalan, rute }
}

export default function RutePeta({ trade }) {
  const peta = useMemo(() => bangunPeta(trade?.trade_id ?? 0), [trade?.trade_id])
  if (!trade) return null
  const st = trade.status
  const jalan = st === 'locked'
  const sampai = st === 'released'
  const balik = st === 'refunded'

  return (
    <div className="peta-rute">
      <span className="label">Peta ilustrasi — bukan lokasi sebenarnya</span>
      <svg viewBox="0 0 600 220" className="peta-svg" role="img" aria-label="Peta rute ilustrasi">
        {peta.blok.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="4"
            className="peta-blok" opacity={b.o} />
        ))}
        {peta.jalan.map((d, i) => (
          <path key={i} d={d} className="peta-jalan" />
        ))}
        <path d={peta.rute} className={`jalur ${sampai ? 'jalur-sampai' : balik ? 'jalur-balik' : 'jalur-jalan'}`}
          strokeWidth="5" fill="none" />
        <g className="stasiun">
          <circle cx="60" cy="110" r="16" className="node" />
          <text x="60" y="114" textAnchor="middle" className="node-huruf">J</text>
          <text x="60" y="146" textAnchor="middle" className="node-nama">Penjual</text>
          <text x="60" y="162" textAnchor="middle" className="node-addr">{shortAddr(trade.seller)}</text>
        </g>
        <g className="stasiun">
          <circle cx="300" cy="110" r="22" className="node brankas" />
          <text x="300" y="116" textAnchor="middle" className="node-huruf">◈</text>
          <text x="300" y="146" textAnchor="middle" className="node-nama">Brankas</text>
          <text x="300" y="162" textAnchor="middle" className="node-addr">kontrak</text>
        </g>
        <g className="stasiun">
          <circle cx="540" cy="110" r="16" className="node" />
          <text x="540" y="114" textAnchor="middle" className="node-huruf">B</text>
          <text x="540" y="146" textAnchor="middle" className="node-nama">Pembeli</text>
          <text x="540" y="162" textAnchor="middle" className="node-addr">{shortAddr(trade.buyer)}</text>
        </g>
      </svg>
      <p className="peta-ket">
        {jalan && 'GEN tertahan di brankas — menunggu rilis / putusan.'}
        {sampai && 'GEN sampai ke pembeli.'}
        {balik && 'GEN kembali ke penjual.'}
        {!jalan && !sampai && !balik && `Status: ${st}`}
      </p>
    </div>
  )
}
