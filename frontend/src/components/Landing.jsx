import React from 'react'

export default function Landing({ onLaunch }) {
  return (
    <div className="landing">
      <div className="landing-kertas">
        <p className="landing-cap">pasar escrow p2p · genlayer bradbury</p>
        <h1 className="landing-judul">Titip.<br />Jual beli GEN<br /><em>tanpa saling kenal.</em></h1>
        <p className="landing-sub">
          Penjual mengunci GEN di kontrak. Pembeli transfer rupiah langsung.
          Sengketa diputus wasit AI — bukan admin, bukan bandar.
        </p>
        <div className="landing-langkah">
          <div><span>1</span><p>Pasang lapak, GEN terkunci</p></div>
          <div><span>2</span><p>Pembeli bayar & kirim foto struk</p></div>
          <div><span>3</span><p>Rilis, atau wasit AI memutus</p></div>
        </div>
        <button className="btn btn-primary btn-besar" onClick={onLaunch}>Masuk Pasar →</button>
        <p className="landing-note">Butuh dompet Rabby/MetaMask + GEN testnet Bradbury.</p>
      </div>
    </div>
  )
}
