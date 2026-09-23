import React, { useRef } from 'react'
import pasarVideo from '../assets/pasar.mp4'
import pasarFoto from '../assets/pasar.jpg'

// Hero video pasar hidup + paralaks mouse.
export default function Landing({ onLaunch }) {
  const bungkusRef = useRef(null)

  function handleGerak(e) {
    const el = bungkusRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `translate(${(x * -18).toFixed(1)}px, ${(y * -14).toFixed(1)}px)`
  }

  return (
    <div className="landing landing-foto">
      <div className="foto-panggung" onMouseMove={handleGerak} onMouseLeave={() => {
        if (bungkusRef.current) bungkusRef.current.style.transform = ''
      }}>
        <div className="foto-bungkus" ref={bungkusRef}>
          <video className="foto-video" src={pasarVideo} poster={pasarFoto}
            autoPlay muted loop playsInline preload="auto" />
        </div>
        <div className="cahaya c1" />
        <div className="cahaya c2" />
        <div className="foto-scrim" />
        <div className="foto-teks">
          <p className="foto-cap">pasar escrow p2p · genlayer bradbury</p>
          <h1 className="foto-judul">Titip<em>·</em>P2P</h1>
          <p className="foto-sub">Jual beli GEN seperti di pasar — wasit AI memutus sengketa.</p>
          <button className="btn btn-primary btn-besar" onClick={onLaunch}>Masuk Pasar →</button>
        </div>
      </div>
      <div className="landing-kertas landing-bawah">
        <div className="landing-langkah">
          <div><span>1</span><p>Gelar lapak, GEN terkunci</p></div>
          <div><span>2</span><p>Bayar & kirim foto struk</p></div>
          <div><span>3</span><p>Rilis, atau wasit AI memutus</p></div>
        </div>
        <p className="landing-note">Butuh dompet Rabby/MetaMask + GEN testnet Bradbury.</p>
      </div>
    </div>
  )
}
