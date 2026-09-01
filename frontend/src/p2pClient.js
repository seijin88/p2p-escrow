import { createClient, createPublicClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'

export const P2P_ESCROW_ADDRESS =
  import.meta.env.VITE_P2P_ESCROW_ADDRESS || '0x0000000000000000000000000000000000000000'

export const REPUTATION_ADDRESS =
  import.meta.env.VITE_REPUTATION_ADDRESS || '0x0000000000000000000000000000000000000000'

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
export async function waitForTransaction(txHash, intervalMs = 3000, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
      if (receipt && receipt.status !== 'pending') return receipt
    } catch { /* not yet indexed */ }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('Transaction timeout — check GenLayer Explorer')
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

export async function getCounters() {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_counters',
    args: [],
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

export async function setReputationContract(walletClient, repAddress) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'set_reputation_contract',
    args: [repAddress],
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// TRADER REPUTATION — Read
// ══════════════════════════════════════════════════════════════════════════════

export async function getTraderProfile(address) {
  return await publicClient.readContract({
    address: REPUTATION_ADDRESS,
    functionName: 'get_trader_profile',
    args: [address],
  })
}

export async function isEligible(address) {
  return await publicClient.readContract({
    address: REPUTATION_ADDRESS,
    functionName: 'is_eligible',
    args: [address],
  })
}

export async function setEscrowContract(walletClient, escrowAddress) {
  return await walletClient.writeContract({
    address: REPUTATION_ADDRESS,
    functionName: 'set_escrow_contract',
    args: [escrowAddress],
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
