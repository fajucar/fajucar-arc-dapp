/**
 * MultiTokenFaucet config — Arc Testnet
 * Faucet: 0xeb625A5022057c7E0CAA1Aa7900cD0A44bc3FD81
 */

import { ARC_TESTNET } from './arcTestnet'

export const FAUCET_ADDRESS = '0xeb625A5022057c7E0CAA1Aa7900cD0A44bc3FD81' as `0x${string}`

export const FAUCET_ABI = [
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
  },
  {
    name: 'remaining',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export const FAUCET_TOKENS = [
  { symbol: 'FAJU', address: ARC_TESTNET.addresses.faju, decimals: 18, claimAmount: '10' },
  { symbol: 'ARCX', address: ARC_TESTNET.addresses.arcx, decimals: 18, claimAmount: '10' },
] as const

export const ARC_TESTNET_CHAIN_ID = ARC_TESTNET.chainId
