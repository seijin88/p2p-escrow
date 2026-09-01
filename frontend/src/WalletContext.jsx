import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'

const WalletContext = createContext(null)

// Testnet Bradbury chain params for wallet_addEthereumChain
const BRADBURY_PARAMS = {
  chainId: '0x' + testnetBradbury.id.toString(16),
  chainName: testnetBradbury.name,
  rpcUrls: [testnetBradbury.rpcUrls.default.http[0]],
  nativeCurrency: testnetBradbury.nativeCurrency,
}

export function WalletProvider({ children }) {
  const [address, setAddress]           = useState(null)
  const [walletClient, setWalletClient] = useState(null)
  const [chainId, setChainId]           = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError]               = useState('')
  const [walletType, setWalletType]     = useState(null) // 'rabby' | 'metamask' | null

  // ── Detect provider ──────────────────────────────────────────────────────
  function getProvider() {
    if (typeof window === 'undefined') return null
    // EIP-6963: Rabby injects as window.rabby OR window.ethereum
    // Rabby also sets window.ethereum.isRabby = true
    const p = window.ethereum
    if (!p) return null
    return p
  }

  // ── Build genlayer wallet client from provider ───────────────────────────
  function buildWalletClient(provider, addr) {
    return createClient({
      chain: testnetBradbury,
      // Pass EIP-1193 provider — genlayer-js uses it to sign transactions
      transport: provider,
      account: addr,
    })
  }

  // ── Switch wallet to Bradbury network ────────────────────────────────────
  async function switchToBradbury(provider) {
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BRADBURY_PARAMS.chainId }],
      })
    } catch (err) {
      // Chain not added yet — add it
      if (err.code === 4902 || err.code === -32603) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [BRADBURY_PARAMS],
        })
      } else {
        throw err
      }
    }
  }

  // ── Connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setError('')
    setIsConnecting(true)
    try {
      const provider = getProvider()
      if (!provider) {
        throw new Error('No wallet detected. Install Rabby or MetaMask.')
      }

      // Request accounts
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      if (!accounts || accounts.length === 0) throw new Error('No accounts returned')

      const addr = accounts[0]

      // Switch to Bradbury
      await switchToBradbury(provider)

      const currentChain = await provider.request({ method: 'eth_chainId' })
      setChainId(currentChain)

      const client = buildWalletClient(provider, addr)
      setAddress(addr)
      setWalletClient(client)
      setWalletType(provider.isRabby ? 'rabby' : 'metamask')

      return addr
    } catch (err) {
      setError(err.message || 'Connection failed')
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [])

  // ── Disconnect ───────────────────────────────────────────────────────────
  function disconnect() {
    setAddress(null)
    setWalletClient(null)
    setChainId(null)
    setWalletType(null)
    setError('')
  }

  // ── Listen for account / chain changes ──────────────────────────────────
  useEffect(() => {
    const provider = getProvider()
    if (!provider) return

    function onAccountsChanged(accounts) {
      if (!accounts || accounts.length === 0) {
        disconnect()
      } else {
        const addr = accounts[0]
        setAddress(addr)
        setWalletClient(buildWalletClient(provider, addr))
      }
    }

    function onChainChanged(newChainId) {
      setChainId(newChainId)
      // If user switches away from Bradbury warn them
      if (newChainId !== BRADBURY_PARAMS.chainId) {
        setError('Wrong network — please switch back to GenLayer Testnet Bradbury')
      } else {
        setError('')
      }
    }

    provider.on?.('accountsChanged', onAccountsChanged)
    provider.on?.('chainChanged', onChainChanged)

    // Auto-reconnect if already authorised
    provider.request({ method: 'eth_accounts' }).then((accounts) => {
      if (accounts && accounts.length > 0) {
        const addr = accounts[0]
        provider.request({ method: 'eth_chainId' }).then((cid) => {
          setChainId(cid)
          setAddress(addr)
          setWalletClient(buildWalletClient(provider, addr))
          setWalletType(provider.isRabby ? 'rabby' : 'metamask')
        })
      }
    }).catch(() => {})

    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged)
      provider.removeListener?.('chainChanged', onChainChanged)
    }
  }, [])

  const isWrongNetwork = chainId && chainId !== BRADBURY_PARAMS.chainId

  return (
    <WalletContext.Provider value={{
      address,
      walletClient,
      walletType,
      chainId,
      isConnecting,
      isWrongNetwork,
      error,
      connect,
      disconnect,
      switchToBradbury: () => switchToBradbury(getProvider()),
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
