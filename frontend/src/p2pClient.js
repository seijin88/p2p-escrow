import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/**
 * Read a contract address from the build-time env, or refuse to start.
 *
 * Deliberately NOT falling back to a hardcoded address: a stale default points
 * the app at an old contract silently — it looks like an empty board rather
 * than a misconfiguration, and it hides which address users are signing
 * against. Configure it in frontend/.env (see .env.example).
 */
function requireAddress(name) {
  const raw = import.meta.env[name]
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!HEX_ADDRESS.test(value)) {
    throw new Error(
      `${name} is ${raw === undefined ? 'not set' : `malformed ("${raw}")`}. ` +
      `Expected 0x followed by 40 hex characters. ` +
      `Copy frontend/.env.example to frontend/.env and set the deployed contract address.`
    )
  }
  return value
}

export const P2P_ESCROW_ADDRESS = requireAddress('VITE_P2P_ESCROW_ADDRESS')

// Optional and display-only: trading is gated by the bank profiles reported
// inside the escrow itself, never by this pointer.
export const USER_PROFILE_ADDRESS =
  import.meta.env.VITE_USER_PROFILE_ADDRESS || '0x0000000000000000000000000000000000000000'

// ── Public read-only client (no wallet needed) ────────────────────────────────
export const publicClient = createClient({ chain: testnetBradbury })

// ── Wallet client from Rabby / MetaMask (window.ethereum) ────────────────────
export function createRabbyClient(provider) {
  return createClient({
    chain: testnetBradbury,
    // genlayer-js accepts a viem-compatible transport or EIP-1193 provider
    transport: provider,
  })
}

// ── Transaction poller ────────────────────────────────────────────────────────
export async function waitForTransaction(txHash, intervalMs = 5000, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await publicClient.getTransaction({ hash: txHash })
      if (tx && tx.status && tx.status !== 'PENDING') return tx
    } catch { /* not yet indexed */ }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  // Don't throw — transaction may be accepted but polling failed
  return null
}

// ══════════════════════════════════════════════════════════════════════════════
// P2P ESCROW — Read
// ══════════════════════════════════════════════════════════════════════════════

export async function getOpenOffers() {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_open_offers',
    args: [],
  })
}

export async function getOffer(offerId) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_offer',
    args: [BigInt(offerId)],
  })
}

export async function getTrade(tradeId) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_trade',
    args: [BigInt(tradeId)],
  })
}

export async function getTradeHistory(page = 0, pageSize = 10) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_trade_history',
    args: [BigInt(page), BigInt(pageSize)],
  })
}

export async function getMyActiveTrades(address) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_my_active_trades',
    args: [address],
  })
}

/** Fix 4: recover latest trade_id after lock_order() — role: "buyer" | "seller" */
export async function getMyLatestTradeId(address, role = 'buyer') {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_my_latest_trade_id',
    args: [address, role],
  })
}

export async function getCounters() {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_counters',
    args: [],
  })
}

/**
 * Display-rate data that matches actual settlement.
 * Returns { quoted_rate, market_rate_at_lock, deviation_pct, rate_within_limit,
 * fiat_currency, ... } — all three rates come from the trade's on-chain lock
 * snapshot, never recomputed, so what the UI shows is what settlement used.
 */
export async function getSettlementInfo(tradeId) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_settlement_info',
    args: [tradeId],
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// P2P ESCROW — Write (require wallet client)
// ══════════════════════════════════════════════════════════════════════════════

export async function postOffer(walletClient, { token, fiatCurrency, fiatAmount, rate, paymentMethods, amountWei }) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'post_offer',
    args: [token, fiatCurrency, BigInt(fiatAmount), BigInt(rate), paymentMethods],
    value: BigInt(amountWei),
  })
}

export async function cancelOffer(walletClient, offerId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'cancel_offer',
    args: [BigInt(offerId)],
  })
}

export async function expireOffer(walletClient, offerId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'expire_offer',
    args: [BigInt(offerId)],
  })
}

export async function lockOrder(walletClient, offerId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'lock_order',
    args: [BigInt(offerId)],
  })
}

export async function markPaid(walletClient, tradeId, proofUrl) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'mark_paid',
    args: [BigInt(tradeId), proofUrl],
  })
}

export async function releaseCrypto(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'release_crypto',
    args: [BigInt(tradeId)],
  })
}

export async function openDispute(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'open_dispute',
    args: [BigInt(tradeId)],
  })
}

export async function escalateAfterTimeout(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'escalate_after_seller_timeout',
    args: [BigInt(tradeId)],
  })
}

export async function arbitrate(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'arbitrate',
    args: [BigInt(tradeId)],
  })
}

export async function cancelExpiredOrder(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'cancel_expired_order',
    args: [BigInt(tradeId)],
  })
}

// ── P2: appeal + finalize ─────────────────────────────────────────────────────

export async function appealVerdict(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'appeal_verdict',
    args: [BigInt(tradeId)],
  })
}

export async function finalizeTrade(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'finalize_trade',
    args: [BigInt(tradeId)],
  })
}

/**
 * Protocol-level appeal (GenLayer consensus): appeals the *arbitrate
 * transaction itself*, triggering a fresh validation round. The SDK quotes
 * the bond automatically (feeManager calculateMinAppealBond); a successful
 * appeal returns the bond plus 1.5x as reward. Use this against the raw tx
 * hash of the arbitration, alongside the contract-level `appeal_verdict`.
 */
export async function appealArbitrationTx(walletClient, txHash) {
  return await walletClient.appealTransaction({ txId: txHash })
}

// ══════════════════════════════════════════════════════════════════════════════
// Network helpers
// ══════════════════════════════════════════════════════════════════════════════

export const BRADBURY_CHAIN = {
  id: testnetBradbury.id,
  name: testnetBradbury.name,
  rpcUrls: testnetBradbury.rpcUrls,
  nativeCurrency: testnetBradbury.nativeCurrency,
}
