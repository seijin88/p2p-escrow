import React from 'react'

// Ilustrasi pasar tradisional gaya cukilan kayu — digambar tangan (SVG),
// dianimasikan via CSS. Bukan gambar AI, bukan stok ber-watermark.
export default function PasarUkiran() {
  return (
    <svg viewBox="0 0 800 500" className="ukiran" role="img" aria-label="Pasar tradisional">
      <defs>
        <pattern id="arsir" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="#f2e9d2" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#232a22" strokeWidth="1.6" />
        </pattern>
        <pattern id="arsirRapat" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="#f2e9d2" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="#232a22" strokeWidth="1.8" />
        </pattern>
      </defs>

      {/* bingkai pelat */}
      <rect x="8" y="8" width="784" height="484" fill="none" stroke="#232a22" strokeWidth="5" />
      <rect x="20" y="20" width="760" height="460" fill="none" stroke="#232a22" strokeWidth="1.5" />

      {/* matahari */}
      <g className="ukir-matahari" style={{ transformOrigin: '660px 90px' }}>
        <circle cx="660" cy="90" r="34" fill="#f2e9d2" stroke="#232a22" strokeWidth="4" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI) / 6
          const x1 = 660 + Math.cos(a) * 42, y1 = 90 + Math.sin(a) * 42
          const x2 = 660 + Math.cos(a) * 58, y2 = 90 + Math.sin(a) * 58
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#232a22" strokeWidth="3" />
        })}
      </g>

      {/* burung */}
      <g className="ukir-burung ukir-burung-1" stroke="#232a22" strokeWidth="3" fill="none">
        <path d="M0,0 q8,-8 16,0 q8,-8 16,0" />
      </g>
      <g className="ukir-burung ukir-burung-2" stroke="#232a22" strokeWidth="2.5" fill="none">
        <path d="M0,0 q7,-7 14,0 q7,-7 14,0" />
      </g>

      {/* tenda lapak */}
      <g className="ukir-tenda" style={{ transformOrigin: '250px 150px' }}>
        <rect x="80" y="150" width="340" height="26" fill="url(#arsirRapat)" stroke="#232a22" strokeWidth="3" />
        {Array.from({ length: 7 }).map((_, i) => (
          <path key={i} d={`M${92 + i * 48},176 q12,26 6,52 L${92 + i * 48},176 Z`}
            fill={i % 2 ? '#232a22' : '#f2e9d2'} stroke="#232a22" strokeWidth="2.5" />
        ))}
        <line x1="80" y1="150" x2="80" y2="420" stroke="#232a22" strokeWidth="4" />
        <line x1="420" y1="150" x2="420" y2="420" stroke="#232a22" strokeWidth="4" />
      </g>

      {/* kain dagangan berkibar */}
      <g className="ukir-kain">
        <path d="M470,190 C540,170 600,200 670,180 L660,330 C590,350 530,320 462,340 Z"
          fill="#f2e9d2" stroke="#232a22" strokeWidth="4" />
        <path d="M500,195 C550,185 590,205 640,192" fill="none" stroke="#232a22" strokeWidth="2" />
        <path d="M495,230 C550,218 595,240 645,226" fill="none" stroke="#232a22" strokeWidth="2" />
        <path d="M490,265 C550,252 600,275 648,260" fill="none" stroke="#232a22" strokeWidth="2" />
        <path d="M486,300 C545,288 595,308 644,294" fill="none" stroke="#232a22" strokeWidth="2" />
      </g>

      {/* pedagang */}
      <g className="ukir-goyang" style={{ animationDelay: '0s' }}>
        <ellipse cx="250" cy="440" rx="70" ry="12" fill="url(#arsir)" stroke="#232a22" strokeWidth="2" />
        <path d="M215,440 L225,330 L275,330 L285,440 Z" fill="url(#arsir)" stroke="#232a22" strokeWidth="3.5" />
        <circle cx="250" cy="300" r="26" fill="#f2e9d2" stroke="#232a22" strokeWidth="3.5" />
        <path d="M228,292 q10,-8 20,0 M228,292 q-4,10 4,16 M272,292 q4,10 -4,16" fill="none" stroke="#232a22" strokeWidth="2.5" />
        <path d="M224,296 L276,296 L270,262 L230,262 Z" fill="#232a22" />
        <ellipse cx="250" cy="258" rx="24" ry="8" fill="#f2e9d2" stroke="#232a22" strokeWidth="3" />
        <path d="M225,335 L175,380 M275,335 L330,375" stroke="#232a22" strokeWidth="6" strokeLinecap="round" />
        <circle cx="172" cy="382" r="9" fill="#f2e9d2" stroke="#232a22" strokeWidth="3" />
      </g>

      {/* pembeli + koin */}
      <g className="ukir-goyang" style={{ animationDelay: '1.1s' }}>
        <ellipse cx="560" cy="445" rx="60" ry="11" fill="url(#arsir)" stroke="#232a22" strokeWidth="2" />
        <path d="M530,445 L538,350 L582,350 L590,445 Z" fill="#232a22" />
        <path d="M538,350 L582,350 L575,380 L545,380 Z" fill="#f2e9d2" stroke="#232a22" strokeWidth="2" />
        <circle cx="560" cy="322" r="24" fill="#f2e9d2" stroke="#232a22" strokeWidth="3.5" />
        <path d="M540,318 q8,-6 18,0" fill="none" stroke="#232a22" strokeWidth="2.5" />
        <path d="M536,310 L584,310 L578,282 L542,282 Z" fill="url(#arsirRapat)" stroke="#232a22" strokeWidth="2.5" />
        <path d="M538,355 L490,330" stroke="#232a22" strokeWidth="6" strokeLinecap="round" />
        <g className="ukir-koin" style={{ transformOrigin: '486px 326px' }}>
          <circle cx="486" cy="326" r="13" fill="#f2e9d2" stroke="#232a22" strokeWidth="3" />
          <text x="486" y="331" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#232a22">G</text>
        </g>
      </g>

      {/* meja dagangan */}
      <g>
        <rect x="330" y="400" width="120" height="14" fill="#232a22" />
        <line x1="345" y1="414" x2="345" y2="452" stroke="#232a22" strokeWidth="5" />
        <line x1="435" y1="414" x2="435" y2="452" stroke="#232a22" strokeWidth="5" />
        <ellipse cx="365" cy="394" rx="16" ry="10" fill="#f2e9d2" stroke="#232a22" strokeWidth="3" />
        <path d="M395,400 q4,-18 14,-22 q10,4 14,22 Z" fill="url(#arsir)" stroke="#232a22" strokeWidth="2.5" />
        <circle cx="425" cy="392" r="9" fill="#f2e9d2" stroke="#232a22" strokeWidth="2.5" />
      </g>

      {/* tanah */}
      <line x1="20" y1="452" x2="780" y2="452" stroke="#232a22" strokeWidth="4" />
      {Array.from({ length: 24 }).map((_, i) => (
        <line key={i} x1={40 + i * 31} y1="452" x2={32 + i * 31} y2="466" stroke="#232a22" strokeWidth="2" />
      ))}
    </svg>
  )
}
