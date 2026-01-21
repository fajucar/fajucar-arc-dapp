import { Chain } from 'viem'

export const arcTestnet = {
  id: 5042002, // Arc Testnet chainId
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: { 
      http: ['https://rpc.testnet.arc.network'],
      webSocket: ['wss://rpc.testnet.arc.network'],
    },
    public: { 
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'ArcScan', 
      url: 'https://testnet.arcscan.app'
    },
  },
  testnet: true,
} as const satisfies Chain

// Exportar também mainnet quando disponível
export const arcMainnet = {
  id: 1337, // AJUSTAR quando mainnet estiver disponível
  name: 'Arc Network',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: { 
      http: ['https://rpc.arc.network'],
    },
    public: { 
      http: ['https://rpc.arc.network'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'ArcScan', 
      url: 'https://arcscan.app'
    },
  },
  testnet: false,
} as const satisfies Chain

