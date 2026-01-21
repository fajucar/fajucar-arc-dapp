import { http, createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { arcTestnet } from './chains'

// === Injected wallets (MetaMask, Rabby, Rainbow, Coinbase Extension, etc)
const injectedConnector = injected({
  shimDisconnect: true,
})

// === WalletConnect
// Circuit breaker: check if WalletConnect was disabled due to runtime errors
const isWalletConnectDisabled = typeof window !== 'undefined' && 
                                localStorage.getItem('WALLETCONNECT_DISABLED') === '1'

// Ensure projectId is a valid non-empty string before initializing
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
const hasValidProjectId = walletConnectProjectId && 
                          typeof walletConnectProjectId === 'string' && 
                          walletConnectProjectId.trim().length > 0 &&
                          !isWalletConnectDisabled // Circuit breaker: don't create if disabled

// DEV-only warning if env is missing (not shown in production to avoid console noise)
if (!hasValidProjectId && (import.meta.env as { MODE?: string }).MODE === 'development') {
  if (isWalletConnectDisabled) {
    console.warn('⚠️ [wagmi] WalletConnect is disabled due to previous runtime error. Clear localStorage to re-enable.')
  } else {
    console.warn('⚠️ [wagmi] WalletConnect is not configured (missing VITE_WALLETCONNECT_PROJECT_ID).')
    console.warn('⚠️ [wagmi] Please configure VITE_WALLETCONNECT_PROJECT_ID in your environment variables.')
    console.warn('⚠️ [wagmi] Create a project at https://cloud.walletconnect.com')
  }
}

// Only create WalletConnect connector if projectId is defined (truthy) AND not disabled
// This prevents "Cannot read properties of undefined (reading 'init')" error
// walletConnect() NEVER receives undefined/null/empty string
const walletConnectConnector = hasValidProjectId
  ? walletConnect({
      projectId: walletConnectProjectId.trim(),
      showQrModal: true,
      metadata: {
        name: 'Arc Network',
        description: 'Arc minter dApp',
        url: 'https://www.fajucar.xyz',
        icons: ['https://www.fajucar.xyz/favicon.ico'],
      },
    })
  : null

// Export helper to check if WalletConnect is disabled
export const isWalletConnectDisabledFlag = isWalletConnectDisabled

// Export projectId as string | undefined (NOT empty string)
export const WALLETCONNECT_PROJECT_ID: string | undefined = hasValidProjectId 
  ? walletConnectProjectId.trim() 
  : undefined

// Detectar mobile para priorizar WalletConnect mesmo se window.ethereum existir
// No mobile, mesmo dentro do browser da MetaMask, devemos usar WalletConnect para abrir o app
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

const hasInjectedWallet = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined'
const isMobile = isMobileDevice()

// Priorizar WalletConnect no mobile (mesmo se window.ethereum existir)
// No desktop, priorizar injected (MetaMask) se disponível
const connectors = isMobile
  ? [
      // Mobile: WalletConnect primeiro (sempre, mesmo se window.ethereum existir)
      ...(walletConnectConnector ? [walletConnectConnector] : []),
      injectedConnector,
    ]
  : hasInjectedWallet
    ? [
        // Desktop com MetaMask: injected primeiro
        injectedConnector,
        ...(walletConnectConnector ? [walletConnectConnector] : []),
      ]
    : [
        // Desktop sem injected: WalletConnect primeiro
        ...(walletConnectConnector ? [walletConnectConnector] : []),
        injectedConnector,
      ]

export const config = createConfig({
  // DEP: mantenha o dApp restrito à Arc Testnet.
  // Isso evita bugs de mismatch de chain/RPC (especialmente após confirmar na carteira).
  chains: [arcTestnet],
  connectors,
  transports: {
    // RPC explícito e estável (Arc não é garantida em providers "default").
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
  },
  ssr: false,
})
