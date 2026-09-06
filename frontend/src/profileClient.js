import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'

export const USER_PROFILE_ADDRESS =
  import.meta.env.VITE_USER_PROFILE_ADDRESS || '0x0000000000000000000000000000000000000000'

export const publicClient = createClient({ chain: testnetBradbury })

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getProfile(address) {
  return await publicClient.readContract({
    address: USER_PROFILE_ADDRESS,
    functionName: 'get_profile',
    args: [address],
  })
}

export async function isRegistered(address) {
  return await publicClient.readContract({
    address: USER_PROFILE_ADDRESS,
    functionName: 'is_registered',
    args: [address],
  })
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function registerProfile(walletClient, { bankName, accountNumber, accountName }) {
  return await walletClient.writeContract({
    address: USER_PROFILE_ADDRESS,
    functionName: 'register',
    args: [bankName, accountNumber, accountName],
  })
}
