import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'

const P2P_ESCROW_ADDRESS_ENV = import.meta.env.VITE_P2P_ESCROW_ADDRESS || ''
export const P2P_ESCROW_ADDRESS = P2P_ESCROW_ADDRESS_ENV.trim()

// ── Public read-only client (no wallet needed) ──────────────────────────────
export const publicClient = createClient({ chain: testnetBradbury })

// ── Wallet client from Rabby / MetaMask (window.ethereum) ───────────────────
export function createRabbyClient(provider) {
  return createClient({
    chain: testnetBradbury,
    transport: provider,
  })
}

// ── Transaction poller ──────────────────────────────────────────────────────
export async function waitForTransaction(txHash, intervalMs = 5000, maxAttempts = 90) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await publicClient.getTransaction({ hash: txHash })
      if (tx && tx.status && tx.status !== 'PENDING') return tx
    } catch { /* not yet indexed */ }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return null
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function parseRecord(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v) } catch { return null }
  }
  return v ?? null
}

function toNumber(v) {
  try { return Number(typeof v === 'bigint' ? v : BigInt(v)) } catch { return 0 }
}

function fmtWei(wei, digits = 4) {
  try { return (Number(BigInt(wei)) / 1e18).toFixed(digits) } catch { return String(wei ?? '—') }
}

export const fmt = { toNumber, fmtWei }

export function shortAddr(addr) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Math.floor(Date.now() / 1000) - Number(ts)
  if (diff < 60)   return `${diff} dtk lalu`
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
  return `${Math.floor(diff / 86400)} hari lalu`
}

export function expiryLeft(expiresAt) {
  const diff = Number(expiresAt) - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'kedaluwarsa'
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return h > 0 ? `sisa ${h} jam ${m} mnt` : `sisa ${m} mnt`
}

export function isExpired(expiresAt) {
  if (!expiresAt) return false
  return Math.floor(Date.now() / 1000) > Number(expiresAt)
}

// Kontak diselipkan di payment_methods: "DANA · @nama"
export function splitMethods(methods) {
  const parts = String(methods || '').split('·').map(s => s.trim()).filter(Boolean)
  if (parts.length < 2) return { methods: String(methods || ''), contact: '' }
  const last = parts[parts.length - 1]
  if (/^@[\w.]+$/.test(last) || /^[+\d][\d\s-]{5,}$/.test(last) || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(last)) {
    return { methods: parts.slice(0, -1).join(' · '), contact: last }
  }
  return { methods: String(methods || ''), contact: '' }
}

export function contactLink(contact) {
  if (!contact) return null
  const c = contact.trim()
  if (c.startsWith('@')) return `https://t.me/${c.slice(1)}`
  if (/^[+\d][\d\s-]{5,}$/.test(c)) return `https://wa.me/${c.replace(/[\s-]/g, '')}`
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return `mailto:${c}`
  return null
}

// ════════════════════════════════════════════════════════════════════════════
// READ — kontrak studio (p2p_escrow_studio.py)
// ════════════════════════════════════════════════════════════════════════════

export async function getOwner() {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'get_owner', args: [],
  })
}

export async function getContractBalance() {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'get_balance', args: [],
  })
}

export async function getOfferCount() {
  return toNumber(await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'get_offer_count', args: [],
  }))
}

export async function getTradeCount() {
  return toNumber(await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'get_trade_count', args: [],
  }))
}

export async function getOffer(offerId) {
  return parseRecord(await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'get_offer', args: [BigInt(offerId)],
  }))
}

export async function getTrade(tradeId) {
  return parseRecord(await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'get_trade', args: [BigInt(tradeId)],
  }))
}

export async function isRegistered(addr) {
  try {
    return !!(await publicClient.readContract({
      address: P2P_ESCROW_ADDRESS, functionName: 'is_registered', args: [addr],
    }))
  } catch { return false }
}

export async function getOpenOffers() {
  const n = await getOfferCount()
  const out = []
  for (let i = 0; i < n; i++) {
    try {
      const o = await getOffer(i)
      if (o && o.status === 'open') out.push(o)
    } catch { /* skip unreadable */ }
  }
  return out.reverse()
}

export async function getMyTrades(addr) {
  const me = (addr || '').toLowerCase()
  const n = await getTradeCount()
  const out = []
  for (let i = 0; i < n; i++) {
    try {
      const t = await getTrade(i)
      if (t && (String(t.buyer).toLowerCase() === me || String(t.seller).toLowerCase() === me)) {
        out.push(t)
      }
    } catch { /* skip */ }
  }
  return out.reverse()
}

export async function getAllTrades() {
  const n = await getTradeCount()
  const out = []
  for (let i = 0; i < n; i++) {
    try {
      const t = await getTrade(i)
      if (t) out.push(t)
    } catch { /* skip */ }
  }
  return out.reverse()
}

// ════════════════════════════════════════════════════════════════════════════
// WRITE — butuh wallet client
// ════════════════════════════════════════════════════════════════════════════

export async function registerAccount(walletClient) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'register', args: [],
  })
}

export async function createOffer(walletClient, { fiatCurrency, fiatAmount, rate, paymentMethods, amountWei }) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'create_offer',
    args: ['GEN', fiatCurrency, String(fiatAmount), String(rate), paymentMethods],
    value: BigInt(amountWei),
  })
}

export async function cancelOffer(walletClient, offerId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'cancel_offer', args: [BigInt(offerId)],
  })
}

export async function lockOrder(walletClient, offerId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'lock_order', args: [BigInt(offerId)],
  })
}

export async function setProofUrl(walletClient, tradeId, url) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'set_proof_url', args: [BigInt(tradeId), url],
  })
}

export async function releaseCrypto(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'release_crypto', args: [BigInt(tradeId)],
  })
}

export async function forceRelease(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'force_release', args: [BigInt(tradeId)],
  })
}

export async function arbitrateAI(walletClient, tradeId, sellerNote) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS, functionName: 'arbitrate_ai', args: [BigInt(tradeId), sellerNote],
  })
}

// ════════════════════════════════════════════════════════════════════════════
// Network helpers
// ════════════════════════════════════════════════════════════════════════════

export const BRADBURY_CHAIN = {
  id: testnetBradbury.id,
  name: testnetBradbury.name,
  rpcUrls: testnetBradbury.rpcUrls,
  nativeCurrency: testnetBradbury.nativeCurrency,
}
