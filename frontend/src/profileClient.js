import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import { P2P_ESCROW_ADDRESS } from './p2pClient.js'

// Profiles live on the escrow itself. The escrow gates every offer and every
// lock on the profile a trader reported to IT, so there is exactly one place to
// write and one place to read — no separate registry to keep in sync.
//
// `VITE_USER_PROFILE_ADDRESS` is still around for display purposes only: the
// escrow owner can record a UserProfile address with
// `set_user_profile_contract`, but that pointer never decides who may trade.

export const publicClient = createClient({ chain: testnetBradbury })

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getProfile(address) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'get_profile',
    args: [address],
  })
}

export async function isProfileReported(address) {
  return await publicClient.readContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'is_profile_reported',
    args: [address],
  })
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Register a bank profile (required to post/lock trades).
 * @param {string} bankName - Bank name
 * @param {string} accountNumber - Account number
 * @param {string} accountName - Account holder name
 * @param {string} [contactHandle] - Optional contact info (e.g. @username, email)
 */
export async function reportProfile(walletClient, { bankName, accountNumber, accountName, contactHandle = '' }) {
  return await walletClient.writeContract({
    address: P2P_ESCROW_ADDRESS,
    functionName: 'register_profile',
    args: [bankName, accountNumber, accountName, contactHandle],
  })
}
