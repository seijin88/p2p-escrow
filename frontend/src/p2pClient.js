import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/

const P2P_ESCROW_ADDRESS_ENV = import.meta.env.VITE_P2P_ESCROW_ADDRESS || ''
export const P2P_ESCROW_ADDRESS = P2P_ESCROW_ADDRESS_ENV.trim()

// ── Public read-only client (no wallet needed) ────────────────────────────────
export const publicClient = createClient({ chain: testnetBradbury })

// ── Wallet client from Rabby / MetaMask (window.ethereum) ────────────────────
export function createRabbyClient(provider) {
  return createClient({
    chain: testnetBradbury,
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

export async function getTrade(tradeId) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_trade',
    args: [BigInt(tradeId)],
  })
}

export async function getContactInfo(tradeId) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_contact_info',
    args: [BigInt(tradeId)],
  })
}

export async function getProfile(address) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_profile',
    args: [address],
  })
}

export async function getMyLatestTradeId(address, role = 'buyer') {
  try {
    const trade = await publicClient.readContract({
      address: P2P_ESCROW_ADDRESS,
      functionName: 'get_trade',
      args: [BigInt(0)],
    })
    return trade ? trade.trade_id : 0
  } catch {
    return 0
  }
}

export async function getCounters() {
  return { open_offers: 0, total_trades: 0 }
}

export async function getSettlementInfo(tradeId) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_trade',
    args: [BigInt(tradeId)],
  })
}

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

export async function getTradeHistory(page = 0, pageSize = 10) {
  return []
}

export async function getMyActiveTrades(address) {
  return []
}

// ══════════════════════════════════════════════════════════════════════════════
// P2P ESCROW — Write (require wallet client)
// ══════════════════════════════════════════════════════════════════════════════

export async function registerProfile(walletClient, bankName, accountNumber, accountName, contactHandle = '') {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'register_profile',
    args: [bankName, accountNumber, accountName, contactHandle],
  })
}

export async function postOffer(walletClient, { token, cryptoAmount, fiatCurrency, fiatAmount, rate, paymentMethods }) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'post_offer',
    args: [token, cryptoAmount, fiatCurrency, fiatAmount, rate, paymentMethods],
  })
}

export async function lockOrder(walletClient, offerId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'lock_order',
    args: [BigInt(offerId)],
  })
}

export async function markPaid(walletClient, tradeId, txId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'mark_paid',
    args: [BigInt(tradeId), txId],
  })
}

export async function releaseCrypto(walletClient) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'release_crypto',
    args: [],
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

export async function arbitrate(walletClient, tradeId, verdict, reason) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'arbitrate',
    args: [BigInt(tradeId), verdict, reason, false, false, false, false],
  })
}

export async function cancelExpiredOrder(walletClient, tradeId) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'cancel_expired_order',
    args: [BigInt(tradeId)],
  })
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
