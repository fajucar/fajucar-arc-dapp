/**
 * Single source of truth for Arc Testnet tokens.
 * Used by Swap, Pools, and token selectors.
 */

export const ARC_TESTNET_TOKENS = [
  {
    symbol: 'FAJU',
    name: 'Faju Token',
    address: '0x0e8147CdB023474f440636051AA26f7DCaf2aEa7' as `0x${string}`,
    decimals: 18,
  },
  {
    symbol: 'ARCX',
    name: 'ArcX Token',
    address: '0xA99F353665F89784f0442FB666ea775b6C1af87d' as `0x${string}`,
    decimals: 18,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x3600000000000000000000000000000000000000' as `0x${string}`,
    decimals: 6,
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as `0x${string}`,
    decimals: 6,
  },
] as const

export type ArcTestnetToken = (typeof ARC_TESTNET_TOKENS)[number]
