/**
 * ArcDEX config — derivado de arcTestnet.ts (fonte única de verdade).
 * Swap: approve → Router. Add Liquidity: approve → LiquidityHelper.
 */

import { ARC_TESTNET } from './arcTestnet'

export const ARCDEX = {
  chainId: ARC_TESTNET.chainId,
  factory: ARC_TESTNET.addresses.factory,
  router: ARC_TESTNET.addresses.router,
  pair: ARC_TESTNET.addresses.pair,
  liquidityHelper: ARC_TESTNET.addresses.liquidityHelper,
  usdc: ARC_TESTNET.addresses.usdc,
  eurc: ARC_TESTNET.addresses.eurc,
  decimals: {
    USDC: ARC_TESTNET.tokens.USDC.decimals,
    EURC: ARC_TESTNET.tokens.EURC.decimals,
  },
  explorer: ARC_TESTNET.explorer,
  explorerName: ARC_TESTNET.explorerName,
  tokens: ARC_TESTNET.tokens,
} as const
