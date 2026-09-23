import React from 'react'
import pasar from '../assets/pasar.jpg'

// Latar foto pasar + pejalan kaki siluet yang datang-pergi (CSS/SVG).
export default function Landing({ onLaunch }) {
  return (
    <div className="landing landing-foto">
      <div className="foto-panggung">
        <img src={pasar} alt="Gang pasar tradisional" className="foto-pasar" />
        <svg viewBox="0 0 800 500" className="pejalan-lapisan" aria-hidden="true">
          <g className="pejalan pj-1" fill="#2b2620" opacity="0.85">
            <circle cx="0" cy="-32" r="9" />
            <path d="M-8,-24 L8,-24 L5,10 L-5,10 Z" />
            <path d="M-5,10 L-9,34 M5,10 L9,34" stroke="#2b2620" strokeWidth="5" strokeLinecap="round" />
          </g>
          <g className="pejalan pj-2" fill="#3a3227" opacity="0.7">
            <circle cx="0" cy="-26" r="7.5" />
            <path d="M-7,-19 L7,-19 L4,8 L-4,8 Z" />
            <path d="M-4,8 L-7,28 M4,8 L7,28" stroke="#3a3227" strokeWidth="4" strokeLinecap="round" />
          </g>
          <g className="pejalan pj-3" fill="#241f18" opacity="0.9">
            <circle cx="0" cy="-36" r="10" />
            <path d="M-9,-27 L9,-27 L6,12 L-6,12 Z" />
            <path d="M-6,12 L-10,40 M6,12 L10,40" stroke="#241f18" strokeWidth="6" strokeLinecap="round" />
          </g>
          <g className="burung-foto b-1" stroke="#2b2620" strokeWidth="2.5" fill="none">
            <path d="M0,0 q8,-8 16,0 q8,-8 16,0" />
          </g>
          <g className="burung-foto b-2" stroke="#2b2620" strokeWidth="2" fill="none">
            <path d="M0,0 q7,-7 14,0 q7,-7 14,0" />
          </g>
        </svg>
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
