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

/**
 * Get contact info for a trade (buyer/seller handles).
 */
export async function getContactInfo(tradeId) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_contact_info',
    args: [BigInt(tradeId)],
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// P2P ESCROW — Write (require wallet client)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Register a bank profile (required to post/lock trades).
 * @param {string} bankName - Bank name (first 4 chars stored on-chain)
 * @param {string} accountNumber - Account number
 * @param {string} accountName - Account holder name
 * @param {string} [contactHandle] - Optional contact info (e.g. @username, email)
 */
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

// ══════════════════════════════════════════════════════════════════════════════
// Network helpers
// ══════════════════════════════════════════════════════════════════════════════

export const BRADBURY_CHAIN = {
  id: testnetBradbury.id,
  name: testnetBradbury.name,
  rpcUrls: testnetBradbury.rpcUrls,
  nativeCurrency: testnetBradbury.nativeCurrency,
}
