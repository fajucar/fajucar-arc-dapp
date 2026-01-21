import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'
import { arcTestnet } from './chains'

// Connector para MetaMask (priorizado)
const metaMaskConnector = injected({
  target: 'metaMask',
  shimDisconnect: true,
})

// Connector genérico para outras wallets injected (Rabby, Rainbow, etc)
const injectedConnector = injected({
  shimDisconnect: true,
})

// WalletConnect para mobile wallets
// NOTA: Você precisa criar um projeto em https://cloud.walletconnect.com e obter o projectId
// Para desenvolvimento/testes, pode usar um projectId público temporário
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'c07c0141b20568392a38a32587025f36' // ProjectId público temporário para testes
const walletConnectConnector = walletConnect({
  projectId: walletConnectProjectId,
  metadata: {
    name: 'Arc Network',
    description: 'Blockchain with deterministic finality',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://arc.network',
    icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.ico` : 'https://arc.network/logo.png']
  },
  showQrModal: true,
})

// Coinbase Wallet
const coinbaseConnector = coinbaseWallet({
  appName: 'Arc Network',
  appLogoUrl: 'https://arc.network/logo.png',
})

// Priorizar WalletConnect no mobile quando não há window.ethereum
const isMobile = typeof window !== 'undefined' && !window.ethereum
const connectors = isMobile
  ? [
      walletConnectConnector, // WalletConnect primeiro no mobile
      coinbaseConnector,
      metaMaskConnector,
      injectedConnector,
    ]
  : [
      metaMaskConnector, // MetaMask primeiro no desktop (priorizado)
      injectedConnector, // Outras wallets injected (Rabby, Rainbow, etc)
      walletConnectConnector, 
      coinbaseConnector,
    ]

export const config = createConfig({
  chains: [arcTestnet, mainnet, sepolia], // Adicionar outras chains se necessário
  connectors,
  transports: {
    [arcTestnet.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: false, // Desabilitar SSR para evitar problemas de hidratação
})
