/**
 * V3 Positions Page — Lista posições NFT (concentrated liquidity)
 */

import { Link } from 'react-router-dom'
import { useChainId, useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { RefreshCw, Wallet, AlertCircle, ExternalLink, Settings2, Coins } from 'lucide-react'
import { formatUnits } from 'viem'
import { useV3Positions, type V3PositionInfo } from './hooks/useV3Positions'
import { getV3ConfigError, getV3Addresses } from './config'
import { AddV3LiquidityCard } from './AddV3LiquidityCard'
import { PoolCardSkeleton } from '@/components/ui/Skeleton'
import { formatNumber } from '@/lib/format'
import { ARCDEX } from '@/config/arcDex'

/** Barra visual mostrando onde o preço atual está dentro do range */
function RangeBar({ tickLower, tickUpper, currentTick, inRange }: { tickLower: number; tickUpper: number; currentTick: number; inRange: boolean }) {
  const rangeSize = tickUpper - tickLower
  const clamped = Math.max(tickLower, Math.min(tickUpper, currentTick))
  const pct = rangeSize > 0 ? ((clamped - tickLower) / rangeSize) * 100 : 50
  return (
    <div className="relative h-2 rounded-full bg-slate-700/80 overflow-visible">
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-1 h-5 -ml-px rounded-sm shadow-sm ${inRange ? 'bg-emerald-400' : 'bg-amber-400'}`}
        style={{ left: `${pct}%` }}
        title={`Preço atual: tick ${currentTick} (range ${tickLower}..${tickUpper})`}
      />
    </div>
  )
}

function PositionCard({ pos, positionManager }: { pos: V3PositionInfo; positionManager: string }) {
  const hasFees = pos.tokensOwed0 > 0n || pos.tokensOwed1 > 0n
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-700/50 bg-slate-800/30 shadow-lg shadow-black/20 p-5 transition-all duration-200 hover:border-slate-600/60"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">{pos.pairLabel}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/60 text-slate-300 border border-slate-500/40">
              v3 · {pos.feeLabel}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${pos.inRange ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${pos.inRange ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {pos.inRange ? 'In range' : 'Out of range'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            to={`/pools/v3/positions/${pos.tokenId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-colors"
          >
            <Settings2 className="h-4 w-4" />
            Manage
          </Link>
          {hasFees ? (
            <Link
              to={`/pools/v3/positions/${pos.tokenId}#collect`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500/80 hover:bg-amber-500 text-white transition-colors"
            >
              <Coins className="h-4 w-4" />
              Collect fees
            </Link>
          ) : (
            <span
              title="No fees yet. Fees accumulate when others trade in your range."
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-600 bg-slate-800/40 text-slate-500 cursor-not-allowed"
            >
              <Coins className="h-4 w-4" />
              Collect fees
            </span>
          )}
        </div>
      </div>
      <div className="mb-3">
        <div className="text-xs text-slate-400 mb-1.5">Range</div>
        <RangeBar tickLower={pos.tickLower} tickUpper={pos.tickUpper} currentTick={pos.currentTick} inRange={pos.inRange} />
        <div className="flex justify-between mt-1 text-xs text-slate-500">
          <span>Min {pos.tickLower}</span>
          <span className={pos.inRange ? 'text-emerald-400' : 'text-amber-400'}>Current {pos.currentTick}</span>
          <span>Max {pos.tickUpper}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
        <div>
          <div className="text-xs text-slate-400 mb-1">{pos.symbol0}</div>
          <div className="text-sm font-semibold text-slate-200">{formatNumber(formatUnits(pos.amount0, 6), 4)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">{pos.symbol1}</div>
          <div className="text-sm font-semibold text-slate-200">{formatNumber(formatUnits(pos.amount1, 6), 4)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">Token ID</div>
          <div className="text-sm font-medium text-slate-200">#{pos.tokenId.toString()}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">Range (ticks)</div>
          <div className="text-sm font-mono text-slate-300">
            [{pos.tickLower} .. {pos.tickUpper}]
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-700/30 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500 font-mono" title="Raw liquidity from contract, for verification on explorer">
          Liquidity (raw): {pos.liquidity.toString()}
        </span>
        <a
          href={`${ARCDEX.explorer}/address/${positionManager}?a=${pos.tokenId.toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
        >
          View on ArcScan
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {hasFees && (
        <div className="mt-4 pt-3 border-t border-slate-700/30 text-xs text-amber-400">
          Fees pending: {pos.tokensOwed0 > 0n ? formatNumber(formatUnits(pos.tokensOwed0, 6), 4) : '0'} /{' '}
          {pos.tokensOwed1 > 0n ? formatNumber(formatUnits(pos.tokensOwed1, 6), 4) : '0'} (token0/token1)
        </div>
      )}
    </motion.div>
  )
}

const POSITION_MANAGER = '0xC61608f54EEFf2b229e3a4858236e47f2701a80f'

export function V3PositionsPage() {
  const chainId = useChainId()
  const addrs = getV3Addresses(chainId ?? 0)
  const positionManager = addrs?.v3PositionManager ?? POSITION_MANAGER
  const { address, isConnected } = useAccount()
  const isWrongChain = chainId != null && chainId !== ARCDEX.chainId
  const configError = getV3ConfigError(chainId ?? 0)
  const { positions, loading, error, refetch } = useV3Positions(
    !!address && isConnected && !isWrongChain && !configError
  )

  if (isWrongChain) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
        Connect to <strong>Arc Testnet</strong> to view V3 positions.
      </div>
    )
  }

  if (configError) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
        <AlertCircle className="h-5 w-5 inline-block mr-2 align-middle" />
        {configError} V3 actions are disabled.
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="py-12 px-4 text-center rounded-2xl border border-slate-700/50 bg-slate-800/20">
        <Wallet className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Connect your wallet</h2>
        <p className="text-slate-400 text-sm">Connect to view and manage your V3 NFT positions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Your V3 positions</h2>
        <div className="flex items-center gap-2">
          <AddV3LiquidityCard onMintSuccess={refetch} />
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-sm text-red-200">{error}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <PoolCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && positions.length === 0 && !error && (
        <div className="p-8 rounded-2xl border border-slate-700/50 bg-slate-800/20 text-center">
          <p className="text-slate-400 mb-4">You have no V3 positions yet.</p>
          <p className="text-slate-500 text-sm mb-4">Add liquidity in a V3 pool to mint an NFT position.</p>
          <AddV3LiquidityCard onMintSuccess={refetch} />
          <a
            href={`${ARCDEX.explorer}/address/${positionManager}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 mt-4 text-sm block"
          >
            View Position Manager on explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {!loading && positions.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          className="space-y-4"
        >
          {positions.map((pos) => (
            <PositionCard key={pos.tokenId.toString()} pos={pos} positionManager={positionManager} />
          ))}
        </motion.div>
      )}
    </div>
  )
}
