import React, { useState } from 'react'
import '../landing.css'

const LINES = [
  {
    cmd: '$ whoami',
    out: ['p2p-escrow — trustless OTC desk on GenLayer']
  },
  {
    cmd: '$ cat how_it_works.txt',
    out: [
      '  1. seller posts offer   → GEN locked on-chain',
      '  2. buyer locks order    → AI checks rate vs market (±10%)',
      '  3. buyer pays fiat      → uploads proof URL (off-chain transfer)',
      '  4. AI arbiter reads     → release or refund + 24h appeal window',
    ]
  },
  {
    cmd: '$ genlayer --network bradbury status',
    out: [
      '  chain      : bradbury (4221)',
      '  arbiter    : AI validators (nondet consensus)',
      '  privacy    : bank data = sha256 commitment, never plaintext',
      '  status     : ● live',
    ]
  },
]

export default function Landing({ onLaunch }) {
  const [typed, setTyped] = useState(0)

  React.useEffect(() => {
    if (typed < LINES.length) {
      const t = setTimeout(() => setTyped(v => v + 1), 480)
      return () => clearTimeout(t)
    }
  }, [typed])

  return (
    <div className="landing">
      <div className="terminal-window">
        <div className="terminal-titlebar">
          <span className="t-dot red" />
          <span className="t-dot yellow" />
          <span className="t-dot green" />
          <span className="terminal-title">p2p-escrow — zsh</span>
        </div>
        <div className="terminal-body">
          <pre className="terminal-ascii" aria-hidden="true">{`
   _   _ _____  ______ _  __
  | \\ | |  __ \\|  ____| |/ /
  |  \\| | |__) | |__  | ' /
  |     |  ___/|  __| |  <
  | |\\  | |    | |____| . \\
  |_| \\_|_|    |______|_|\\_\\
  `}</pre>

          {LINES.slice(0, typed).map((l, i) => (
            <div key={i}>
              <div className="term-line">
                <span className="t-prompt">$</span>{' '}
                <span className="t-cmd">{l.cmd.replace('$ ', '')}</span>
              </div>
              {l.out.map((o, j) => (
                <div key={j} className="t-out">{o}</div>
              ))}
            </div>
          ))}

          {typed >= LINES.length && (
            <div className="t-input-line">
              <span className="t-prompt">$</span>
              <span className="t-cursor">▊</span>
            </div>
          )}
        </div>
      </div>

      <div className="landing-cta">
        <button className="btn btn-primary btn-lg" onClick={onLaunch}>
          ./enter-marketplace
        </button>
        <p className="landing-hint">
          escrow.v1 &nbsp;·&nbsp; Bradbury testnet &nbsp;·&nbsp; AI-arbitrated P2P trades
        </p>
      </div>

      <div className="landing-features">
        <div className="feat">
          <div className="feat-key">01 / ESCROW</div>
          <h3>Trustless</h3>
          <p>GEN locked on-chain before fiat moves. No admin key, no custodian — the contract is the escrow.</p>
        </div>
        <div className="feat">
          <div className="feat-key">02 / AI ARBITER</div>
          <h3>Automated dispute</h3>
          <p>AI reads the buyer's proof URL and decides release or refund in real-time. 24h appeal window per trade.</p>
        </div>
        <div className="feat">
          <div className="feat-key">03 / PRIVACY</div>
          <h3>Commitment only</h3>
          <p>Bank details stored as sha256 commitments on-chain. PII never touches the blockchain.</p>
        </div>
      </div>
    </div>
  )
}