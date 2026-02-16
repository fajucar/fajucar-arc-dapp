/*
  Pools Page — Market Overview (DEX architecture)
  - Shows ONLY available liquidity pairs (from Pair contract)
  - NO user LP balance, NO participation %, NO Remove Liquidity
  - Data: useAllPools() — reads reserves directly, no user position data
*/

import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { RefreshCw, Loader2, Plus, ExternalLink, X, ChevronDown } from 'lucide-react'
import { useChainId, useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { useAllPools } from '@/hooks/usePools'
import { ensureAllowance } from '@/lib/allowance'
import { ARCDEX } from '@/config/arcDex'
import { toast } from 'react-hot-toast'
import { formatNumber } from '@/lib/format'
import type { PoolMarketInfo } from '@/hooks/usePools'

const LIQUIDITY_HELPER_ABI = [
  { name: 'addLiquidity', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'pair', type: 'address' }, { name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'amountA', type: 'uint256' }, { name: 'amountB', type: 'uint256' }], outputs: [{ name: 'liquidity', type: 'uint256' }] },
] as const

const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const

function PoolMarketCard({
  pool,
  onAddLiquidity,
  explorerBase,
  explorerName,
}: {
  pool: PoolMarketInfo
  onAddLiquidity: () => void
  explorerBase: string
  explorerName: string
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 shadow-lg shadow-black/20 p-5 transition-all hover:border-slate-600/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{pool.pairName}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/60 text-slate-300 border border-slate-500/40">
              {pool.feeTier}
            </span>
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Pool ativa
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAddLiquidity}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Adicionar liquidez
          </button>
          <button
            onClick={() => setDetailsOpen((o) => !o)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 transition-colors"
          >
            Ver detalhes
            <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="text-xs text-slate-400 mb-0.5">TVL</div>
        <div className="text-sm font-medium text-slate-200 truncate">
          {formatNumber(pool.reserve0Formatted)} {pool.token0.symbol} + {formatNumber(pool.reserve1Formatted)} {pool.token1.symbol}
        </div>
      </div>

      {detailsOpen && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 text-xs font-mono text-slate-400">
          <div>
            <span className="text-slate-500">Pair:</span>{' '}
            <a href={`${explorerBase}/address/${pool.pairAddress}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
              {pool.pairAddress}
            </a>
          </div>
          <div>
            <span className="text-slate-500">Reservas:</span> {formatNumber(pool.reserve0Formatted)} {pool.token0.symbol}, {formatNumber(pool.reserve1Formatted)} {pool.token1.symbol}
          </div>
          <div>
            <span className="text-slate-500">Total supply:</span> {formatNumber(pool.totalSupplyFormatted)} LP
          </div>
          <a href={`${explorerBase}/address/${pool.pairAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 pt-1">
            Ver em {explorerName}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  )
}

export function PoolsPage() {
  const chainId = useChainId()
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const isWrongChain = chainId != null && chainId !== ARCDEX.chainId
  const { pools, loading, error, refetch } = useAllPools(isWrongChain)

  const [addModalPool, setAddModalPool] = useState<PoolMarketInfo | null>(null)
  const [amount0, setAmount0] = useState('')
  const [amount1, setAmount1] = useState('')
  const [addingLiquidity, setAddingLiquidity] = useState(false)

  const handleAddLiquidity = async (pool: PoolMarketInfo) => {
    if (!address || !publicClient) {
      toast.error('Conecte sua carteira')
      return
    }
    if (!amount0 || !amount1 || parseFloat(amount0) <= 0 || parseFloat(amount1) <= 0) {
      toast.error('Informe valores válidos para ambos os tokens')
      return
    }
    setAddingLiquidity(true)
    const token0Addr = pool.token0.address
    const token1Addr = pool.token1.address
    const amount0Wei = parseUnits(amount0, pool.token0.decimals)
    const amount1Wei = parseUnits(amount1, pool.token1.decimals)
    const writeOpts = (opts: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args: unknown[] }) =>
      writeContractAsync({ address: opts.address, abi: opts.abi, functionName: opts.functionName, args: opts.args })
    try {
      const [b0, b1] = await Promise.all([
        publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
      ])
      if (b0 < amount0Wei) throw new Error(`Saldo insuficiente de ${pool.token0.symbol}`)
      if (b1 < amount1Wei) throw new Error(`Saldo insuficiente de ${pool.token1.symbol}`)
      toast.loading(`Aprovando ${pool.token0.symbol}...`, { id: 'a0' })
      await ensureAllowance(publicClient, writeOpts, token0Addr, address, ARCDEX.liquidityHelper, amount0Wei)
      toast.dismiss('a0')
      toast.loading(`Aprovando ${pool.token1.symbol}...`, { id: 'a1' })
      await ensureAllowance(publicClient, writeOpts, token1Addr, address, ARCDEX.liquidityHelper, amount1Wei)
      toast.dismiss('a1')
      toast.loading('Adicionando liquidez...', { id: 'add' })
      const txHash = await writeContractAsync({
        address: ARCDEX.liquidityHelper,
        abi: LIQUIDITY_HELPER_ABI,
        functionName: 'addLiquidity',
        args: [pool.pairAddress, token0Addr, token1Addr, amount0Wei, amount1Wei],
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      toast.dismiss('add')
      toast.success('Liquidez adicionada')
      setAmount0('')
      setAmount1('')
      setAddModalPool(null)
    } catch (err: unknown) {
      toast.dismiss()
      toast.error(err instanceof Error ? err.message : 'Falha ao adicionar liquidez')
    } finally {
      setAddingLiquidity(false)
    }
  }

  useEffect(() => {
    if (isSuccess) {
      refetch()
    }
  }, [isSuccess, refetch])

  return (
    <>
      <Helmet>
        <title>Pools - FajuARC</title>
        <meta name="description" content="Explore liquidity pools on FajuARC" />
      </Helmet>

      <div className="py-8 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Pools</h1>

        {isWrongChain && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            Conecte à <strong>Arc Testnet</strong> para visualizar os pools.
          </div>
        )}

        {!isWrongChain && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Pares disponíveis</h2>
              <button
                onClick={refetch}
                disabled={loading}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {error && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2">
                <span className="text-sm text-red-200">{error}</span>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 py-12">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando pools...
              </div>
            )}

            {!loading && pools.length === 0 && !error && (
              <div className="p-8 rounded-2xl border border-slate-700/50 bg-slate-800/20 text-center">
                <p className="text-slate-400">Nenhum pool disponível.</p>
              </div>
            )}

            {!loading && pools.length > 0 && (
              <div className="space-y-4">
                {pools.map((pool) => (
                  <PoolMarketCard
                    key={pool.pairAddress}
                    pool={pool}
                    onAddLiquidity={() => { setAddModalPool(pool); setAmount0(''); setAmount1(''); }}
                    explorerBase={ARCDEX.explorer}
                    explorerName={ARCDEX.explorerName}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add Liquidity Modal */}
        <AnimatePresence>
          {addModalPool && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddModalPool(null)}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Adicionar liquidez — {addModalPool.pairName}</h3>
                  <button onClick={() => setAddModalPool(null)} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
                {!isConnected ? (
                  <p className="text-slate-400 text-sm">Conecte sua carteira para adicionar liquidez.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">{addModalPool.token0.symbol}</label>
                      <input
                        type="number"
                        value={amount0}
                        onChange={(e) => setAmount0(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">{addModalPool.token1.symbol}</label>
                      <input
                        type="number"
                        value={amount1}
                        onChange={(e) => setAmount1(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <button
                      onClick={() => handleAddLiquidity(addModalPool)}
                      disabled={addingLiquidity || isPending || isConfirming || !amount0 || !amount1}
                      className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {addingLiquidity || isPending || isConfirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Adicionar'}
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
