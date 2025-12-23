import { http, createConfig } from 'wagmi'
import { injected, walletConnect } from 'wagmi/connectors'
import { arcTestnet } from './chains'

// === Injected wallets (MetaMask, Rabby, Rainbow, Coinbase Extension, etc)
const injectedConnector = injected({
  shimDisconnect: true,
})

// === WalletConnect
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''

// Warning se projectId não estiver configurado (apenas em dev)
if ((import.meta.env as { MODE?: string }).MODE === "development" && !walletConnectProjectId) {
  console.warn('⚠️ [wagmi] VITE_WALLETCONNECT_PROJECT_ID não configurado. WalletConnect pode não funcionar corretamente.')
  console.warn('⚠️ [wagmi] Para produção, crie um projeto em https://cloud.walletconnect.com')
}

const walletConnectConnector = walletConnectProjectId
  ? walletConnect({
      projectId: walletConnectProjectId,
      metadata: {
        name: 'Arc Network',
        description: 'Blockchain with deterministic finality',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://arc.network',
        icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.ico` : 'https://arc.network/logo.png'],
      },
      showQrModal: true,
    })
  : null

// Priorizar WalletConnect quando window.ethereum não existir (mobile/outros navegadores)
// No desktop com MetaMask, priorizar injected (MetaMask)
const hasInjectedWallet = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined'
const connectors = hasInjectedWallet
  ? [
      // Desktop: MetaMask injected primeiro
      injectedConnector,
      ...(walletConnectConnector ? [walletConnectConnector] : []),
    ]
  : [
      // Mobile/sem injected: WalletConnect primeiro
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
