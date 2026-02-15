import { normalizeAddress } from '@/lib/assertAddress'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`

/** Accumulated config validation errors (non-fatal; app renders with placeholder addresses) */
export const configErrors: string[] = []

function mustAddr(label: string, v?: string): `0x${string}` {
  const r = normalizeAddress(label, v)
  if (r.ok) return r.value
  configErrors.push(`[${label}] ${r.value}`)
  return ZERO_ADDR
}

/**
 * Arc Testnet (chainId 5042002) — endereços oficiais on-chain (produção).
 * Lê de env (Vercel) se definido; senão usa hardcoded. normalizeAddress extrai 0x+40hex mesmo com aspas.
 *
 * Factory: 0x4b6F738717c46A8998990EBCb17FEf032DC5958B
 * Router:  0x3bE7d2Ed202D5B65b9c78BBf59f6f70880F6C0a6E
 * Pair:    0x327f52e7cDfF1567F1708c2D045c7e2963e4889A (USDC/EURC)
 */
const env = typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string | undefined> }).env : undefined
const FACTORY = mustAddr('factory', env?.VITE_DEX_FACTORY_ADDRESS ?? '0x4b6F738717c46A8998990EBCb17FEf032DC5958B')
const ROUTER = mustAddr('router', env?.VITE_DEX_ROUTER_ADDRESS ?? '0x3bE7d2Ed202D5B65b9c78BBf59f6f70880F6C0a6E')
const PAIR_USDC_EURC = mustAddr('pair', env?.VITE_DEX_PAIR_ADDRESS ?? '0x327f52e7cDfF1567F1708c2D045c7e2963e4889A')
// TEMP DEBUG: remove after validation
if (typeof window !== 'undefined') {
  console.log('[arcTestnet] router raw length:', ROUTER.length, 'JSON:', JSON.stringify(ROUTER))
  console.log('[arcTestnet] factory raw length:', FACTORY.length, 'JSON:', JSON.stringify(FACTORY))
  console.log('[arcTestnet] pair raw length:', PAIR_USDC_EURC.length, 'JSON:', JSON.stringify(PAIR_USDC_EURC))
}
const LIQUIDITY_HELPER = mustAddr('liquidityHelper', '0x8bbC202A110771cc5c05ec53F29eCA23622452F6')
const USDC_ADDR = mustAddr('usdc', '0x3600000000000000000000000000000000000000')
const EURC_ADDR = mustAddr('eurc', '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a')

export const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: '0x4CEF52' as const,
  rpc: 'https://rpc.testnet.arc.network',
  rpcUrls: [
    'https://rpc.testnet.arc.network',
    'https://rpc.blockdaemon.testnet.arc.network',
    'https://rpc.drpc.testnet.arc.network',
  ],
  explorer: 'https://testnet.arcscan.app',
  explorerName: 'ArcScan',

  addresses: {
    factory: FACTORY,
    router: ROUTER,
    pair: PAIR_USDC_EURC,
    liquidityHelper: LIQUIDITY_HELPER,
    usdc: USDC_ADDR,
    eurc: EURC_ADDR,
  },

  tokens: {
    USDC: {
      address: USDC_ADDR,
      symbol: 'USDC',
      decimals: 6,
    },
    EURC: {
      address: EURC_ADDR,
      symbol: 'EURC',
      decimals: 6,
    },
  },
} as const

export type ArcTestnetAddresses = typeof ARC_TESTNET.addresses
export type ArcTestnetTokens = typeof ARC_TESTNET.tokens
