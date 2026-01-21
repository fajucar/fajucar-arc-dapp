export const CONSTANTS = {
  // Network
  ARC_TESTNET_CHAIN_ID: 5042002,
  ARC_MAINNET_CHAIN_ID: 1337,
  
  // Contracts - Arc Testnet
  USDC_ADDRESS: '0x3600000000000000000000000000000000000000' as `0x${string}`, // Arc Testnet USDC
  EURC_ADDRESS: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  
  // API
  STATS_UPDATE_INTERVAL: 5000, // 5s
  BLOCK_UPDATE_INTERVAL: 3000, // 3s
  
  // UI
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 5000,
  
  // Links
  LINKS: {
    docs: 'https://docs.arc.network',
    github: 'https://github.com/circle/arc',
    discord: 'https://discord.gg/arc',
    twitter: 'https://twitter.com/arcnetwork',
    explorer: 'https://testnet.arcscan.app',
    faucet: 'https://faucet.circle.com/', // Circle Faucet oficial
  }
} as const

export const WALLET_ICONS = {
  metamask: '/wallets/metamask.svg',
  coinbase: '/wallets/coinbase.svg',
  walletconnect: '/wallets/walletconnect.svg',
  rabby: '/wallets/rabby.svg',
  rainbow: '/wallets/rainbow.svg',
} as const

