import { useContext } from 'react'
import { WalletContext } from './WalletContext.jsx'

export function useWallet() {
  return useContext(WalletContext)
}
