import React from 'react'
import PasarUkiran from './PasarUkiran.jsx'

export default function Landing({ onLaunch }) {
  return (
    <div className="landing landing-pasar">
      <div className="landing-kertas">
        <p className="landing-cap">pasar escrow p2p · genlayer bradbury</p>
        <h1 className="landing-judul">Titip.<br />Jual beli GEN<br /><em>seperti di pasar.</em></h1>

        <div className="ukiran-bingkai">
          <PasarUkiran />
          <span className="ukiran-cap">Bukan-AI · diukir tangan di SVG</span>
        </div>

        <p className="landing-sub">
          Penjual gelar lapak dan mengunci GEN di kontrak. Pembeli transfer rupiah
          langsung. Kalau sengketa, wasit AI yang memutus — bukan bandar, bukan admin.
        </p>
        <div className="landing-langkah">
          <div><span>1</span><p>Gelar lapak, GEN terkunci</p></div>
          <div><span>2</span><p>Bayar & kirim foto struk</p></div>
          <div><span>3</span><p>Rilis, atau wasit AI memutus</p></div>
        </div>
        <button className="btn btn-primary btn-besar" onClick={onLaunch}>Masuk Pasar →</button>
        <p className="landing-note">Butuh dompet Rabby/MetaMask + GEN testnet Bradbury.</p>
      </div>
    </div>
  )
}
