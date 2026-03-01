/*
  Pools Page — Market Overview (DEX architecture)
  - Shows ONLY available liquidity pairs (from Pair contract)
  - NO user LP balance, NO participation %, NO Remove Liquidity
  - Data: useAllPools() — reads reserves directly, no user position data
*/

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { V3PositionsPage } from '@/modules/v3/V3PositionsPage'
import { Helmet } from 'react-helmet-async'
import { RefreshCw, Loader2, Plus, ExternalLink, X, ChevronDown } from 'lucide-react'
import { useChainId, useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { PoolCardSkeleton } from '@/components/ui/Skeleton'
import { SegmentedTabs } from '@/components/SegmentedTabs'
import { useAllPools } from '@/hooks/usePools'
import { ensureAllowance } from '@/lib/allowance'
import { getPairAddress, readPairState } from '@/lib/arcDexRead'
import { ARCDEX } from '@/config/arcDex'
import { ARC_TESTNET_TOKENS } from '@/config/tokens.arc-testnet'
import { TokenSelectButton } from '@/components/TokenSelect'
import { toast } from 'react-hot-toast'
import { formatNumber } from '@/lib/format'
import type { PoolMarketInfo } from '@/hooks/usePools'
import type { ArcTestnetToken } from '@/config/tokens.arc-testnet'

const FACTORY_ABI = [
  { name: 'createPair', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }], outputs: [{ name: 'pair', type: 'address' }] },
] as const

const LIQUIDITY_HELPER_ABI = [
  { name: 'addLiquidity', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'pair', type: 'address' }, { name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'amountA', type: 'uint256' }, { name: 'amountB', type: 'uint256' }], outputs: [{ name: 'liquidity', type: 'uint256' }] },
] as const

function PairExistsHint({
  tokenA,
  tokenB,
  publicClient,
  isWrongChain,
}: {
  tokenA: ArcTestnetToken
  tokenB: ArcTestnetToken
  publicClient: import('viem').PublicClient | undefined
  isWrongChain: boolean
}) {
  const [pairExists, setPairExists] = useState<boolean | null>(null)
  useEffect(() => {
    if (!publicClient || isWrongChain || tokenA.address === tokenB.address) {
      setPairExists(null)
      return
    }
    const [a, b] = [tokenA.address, tokenB.address].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()))
    getPairAddress(a as `0x${string}`, b as `0x${string}`, publicClient).then((p) =>
      setPairExists(p != null && p !== '0x0000000000000000000000000000000000000000')
    )
  }, [publicClient, isWrongChain, tokenA.address, tokenB.address])
  if (pairExists === null) return <p className="text-xs text-slate-500">Checking pair...</p>
  return (
    <p className="text-xs text-slate-500">
      {pairExists ? 'Pair exists. Adding to existing pool.' : 'Pair will be created.'}
    </p>
  )
}

const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

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
  index?: number
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-700/50 bg-slate-800/30 shadow-lg shadow-black/20 p-5 transition-all duration-200 hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/25"
    >
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
            Add liquidity
          </button>
          <button
            onClick={() => setDetailsOpen((o) => !o)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60 transition-colors"
          >
            Details
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
            <span className="text-slate-500">Reserves:</span> {formatNumber(pool.reserve0Formatted)} {pool.token0.symbol}, {formatNumber(pool.reserve1Formatted)} {pool.token1.symbol}
          </div>
          <div>
            <span className="text-slate-500">Total supply:</span> {formatNumber(pool.totalSupplyFormatted)} LP
          </div>
          <a href={`${explorerBase}/address/${pool.pairAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 pt-1">
            View on {explorerName}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </motion.div>
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
  const [poolModalBalance0, setPoolModalBalance0] = useState<string | null>(null)
  const [poolModalBalance1, setPoolModalBalance1] = useState<string | null>(null)

  const [genericAddOpen, setGenericAddOpen] = useState(false)
  const [genericTokenA, setGenericTokenA] = useState<ArcTestnetToken | null>(null)
  const [genericTokenB, setGenericTokenB] = useState<ArcTestnetToken | null>(null)
  const [genericAmountA, setGenericAmountA] = useState('')
  const [genericAmountB, setGenericAmountB] = useState('')
  const [balanceA, setBalanceA] = useState<string | null>(null)
  const [balanceB, setBalanceB] = useState<string | null>(null)
  const [pairReserves, setPairReserves] = useState<{ r0: number; r1: number; token0Addr: string; token1Addr: string } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = (searchParams.get('tab') === 'v3' ? 'v3' : 'v2') as 'v2' | 'v3'
  const [tab, setTab] = useState<'v2' | 'v3'>(tabFromUrl)
  useEffect(() => { setTab(tabFromUrl) }, [tabFromUrl])

  const handleAddLiquidity = async (pool: PoolMarketInfo) => {
    if (!address || !publicClient) {
      toast.error('Connect your wallet')
      return
    }
    if (!amount0 || !amount1 || parseFloat(amount0) <= 0 || parseFloat(amount1) <= 0) {
      toast.error('Enter valid amounts for both tokens')
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
      if (b0 < amount0Wei) throw new Error(`Insufficient balance of ${pool.token0.symbol}`)
      if (b1 < amount1Wei) throw new Error(`Insufficient balance of ${pool.token1.symbol}`)
      toast.loading(`Aprovando ${pool.token0.symbol}...`, { id: 'a0' })
      await ensureAllowance(publicClient, writeOpts, token0Addr, address, ARCDEX.liquidityHelper, amount0Wei)
      toast.dismiss('a0')
      toast.loading(`Aprovando ${pool.token1.symbol}...`, { id: 'a1' })
      await ensureAllowance(publicClient, writeOpts, token1Addr, address, ARCDEX.liquidityHelper, amount1Wei)
      toast.dismiss('a1')
      toast.loading('Adding liquidity...', { id: 'add' })
      const txHash = await writeContractAsync({
        address: ARCDEX.liquidityHelper,
        abi: LIQUIDITY_HELPER_ABI,
        functionName: 'addLiquidity',
        args: [pool.pairAddress, token0Addr, token1Addr, amount0Wei, amount1Wei],
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      toast.dismiss('add')
      toast.success('Liquidity added')
      setAmount0('')
      setAmount1('')
      setAddModalPool(null)
    } catch (err: unknown) {
      toast.dismiss()
      toast.error(err instanceof Error ? err.message : 'Failed to add liquidity')
    } finally {
      setAddingLiquidity(false)
    }
  }

  const handleGenericAddLiquidity = async () => {
    if (!address || !publicClient || !genericTokenA || !genericTokenB) {
      toast.error('Select both tokens and connect wallet')
      return
    }
    if (!genericAmountA || !genericAmountB || parseFloat(genericAmountA) <= 0 || parseFloat(genericAmountB) <= 0) {
      toast.error('Enter valid amounts for both tokens')
      return
    }
    if (genericTokenA.address.toLowerCase() === genericTokenB.address.toLowerCase()) {
      toast.error('Select different tokens')
      return
    }
    setAddingLiquidity(true)
    const [addrA, addrB] = [genericTokenA.address, genericTokenB.address].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    const token0Addr = addrA as `0x${string}`
    const token1Addr = addrB as `0x${string}`
    const token0 = genericTokenA.address.toLowerCase() === token0Addr.toLowerCase() ? genericTokenA : genericTokenB
    const token1 = genericTokenA.address.toLowerCase() === token1Addr.toLowerCase() ? genericTokenA : genericTokenB
    const amount0Wei = parseUnits(genericAmountA, token0.decimals)
    const amount1Wei = parseUnits(genericAmountB, token1.decimals)
    const writeOpts = (opts: { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args: unknown[] }) =>
      writeContractAsync({ address: opts.address, abi: opts.abi, functionName: opts.functionName, args: opts.args })
    try {
      let pairAddr = await getPairAddress(token0Addr, token1Addr, publicClient)
      const pairWillBeCreated = !pairAddr || pairAddr === '0x0000000000000000000000000000000000000000'

      if (pairWillBeCreated) {
        toast.loading('Creating pair...', { id: 'create' })
        await writeContractAsync({
          address: ARCDEX.factory,
          abi: FACTORY_ABI,
          functionName: 'createPair',
          args: [token0Addr, token1Addr],
        })
        toast.dismiss('create')
        pairAddr = await getPairAddress(token0Addr, token1Addr, publicClient)
        if (!pairAddr) throw new Error('Pair creation failed')
        toast.success('Pair created')
      }

      const [b0, b1] = await Promise.all([
        publicClient.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        publicClient.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
      ])
      if (b0 < amount0Wei) throw new Error(`Insufficient balance of ${token0.symbol}`)
      if (b1 < amount1Wei) throw new Error(`Insufficient balance of ${token1.symbol}`)

      toast.loading(`Approving ${token0.symbol}...`, { id: 'a0' })
      await ensureAllowance(publicClient, writeOpts, token0Addr, address, ARCDEX.liquidityHelper, amount0Wei)
      toast.dismiss('a0')
      toast.loading(`Approving ${token1.symbol}...`, { id: 'a1' })
      await ensureAllowance(publicClient, writeOpts, token1Addr, address, ARCDEX.liquidityHelper, amount1Wei)
      toast.dismiss('a1')
      if (!pairAddr) throw new Error('Pair address not found')
      toast.loading('Adding liquidity...', { id: 'add' })
      await writeContractAsync({
        address: ARCDEX.liquidityHelper,
        abi: LIQUIDITY_HELPER_ABI,
        functionName: 'addLiquidity',
        args: [pairAddr, token0Addr, token1Addr, amount0Wei, amount1Wei],
      })
      toast.dismiss('add')
      toast.success('Liquidity added')
      setGenericTokenA(null)
      setGenericTokenB(null)
      setGenericAmountA('')
      setGenericAmountB('')
      setGenericAddOpen(false)
      refetch()
    } catch (err: unknown) {
      toast.dismiss()
      toast.error(err instanceof Error ? err.message : 'Failed to add liquidity')
    } finally {
      setAddingLiquidity(false)
    }
  }

  useEffect(() => {
    if (isSuccess) {
      refetch()
    }
  }, [isSuccess, refetch])

  useEffect(() => {
    if (!addModalPool || !address || !publicClient) {
      setPoolModalBalance0(null)
      setPoolModalBalance1(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const [b0, b1] = await Promise.all([
          publicClient.readContract({
            address: addModalPool.token0.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: addModalPool.token1.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as Promise<bigint>,
        ])
        if (!cancelled) {
          setPoolModalBalance0(formatUnits(b0, addModalPool.token0.decimals))
          setPoolModalBalance1(formatUnits(b1, addModalPool.token1.decimals))
        }
      } catch {
        if (!cancelled) {
          setPoolModalBalance0(null)
          setPoolModalBalance1(null)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [addModalPool, address, publicClient])

  useEffect(() => {
    if (!genericAddOpen || !publicClient || !genericTokenA || !genericTokenB || isWrongChain) {
      setPairReserves(null)
      return
    }
    const [a, b] = [genericTokenA.address, genericTokenB.address].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()))
    getPairAddress(a as `0x${string}`, b as `0x${string}`, publicClient).then(async (pairAddr) => {
      if (!pairAddr || pairAddr === '0x0000000000000000000000000000000000000000') {
        setPairReserves(null)
        return
      }
      try {
        const state = await readPairState(pairAddr, publicClient)
        const r0 = parseFloat(state.reserve0Formatted)
        const r1 = parseFloat(state.reserve1Formatted)
        if (r0 > 0 && r1 > 0) {
          setPairReserves({
            r0,
            r1,
            token0Addr: state.token0.address.toLowerCase(),
            token1Addr: state.token1.address.toLowerCase(),
          })
        } else {
          setPairReserves(null)
        }
      } catch {
        setPairReserves(null)
      }
    })
  }, [genericAddOpen, publicClient, genericTokenA?.address, genericTokenB?.address, isWrongChain])

  const computeAmountBFromA = (amountA: string): string => {
    if (!pairReserves || !genericTokenA || !genericTokenB) return ''
    const v = parseFloat(amountA)
    if (isNaN(v) || v <= 0) return ''
    const isA_token0 = genericTokenA.address.toLowerCase() === pairReserves.token0Addr
    const ratio = isA_token0 ? pairReserves.r1 / pairReserves.r0 : pairReserves.r0 / pairReserves.r1
    const result = v * ratio
    return result > 0 ? result.toFixed(6) : ''
  }

  const computeAmountAFromB = (amountB: string): string => {
    if (!pairReserves || !genericTokenA || !genericTokenB) return ''
    const v = parseFloat(amountB)
    if (isNaN(v) || v <= 0) return ''
    const isB_token1 = genericTokenB.address.toLowerCase() === pairReserves.token1Addr
    const ratio = isB_token1 ? pairReserves.r0 / pairReserves.r1 : pairReserves.r1 / pairReserves.r0
    const result = v * ratio
    return result > 0 ? result.toFixed(6) : ''
  }

  useEffect(() => {
    if (!genericAddOpen || !address || !publicClient) {
      setBalanceA(null)
      setBalanceB(null)
      return
    }
    let cancelled = false
    const load = async () => {
      if (genericTokenA) {
        try {
          const b = (await publicClient.readContract({
            address: genericTokenA.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          })) as bigint
          if (!cancelled) setBalanceA(formatUnits(b, genericTokenA.decimals))
        } catch {
          if (!cancelled) setBalanceA(null)
        }
      } else {
        setBalanceA(null)
      }
      if (genericTokenB) {
        try {
          const b = (await publicClient.readContract({
            address: genericTokenB.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          })) as bigint
          if (!cancelled) setBalanceB(formatUnits(b, genericTokenB.decimals))
        } catch {
          if (!cancelled) setBalanceB(null)
        }
      } else {
        setBalanceB(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [genericAddOpen, address, publicClient, genericTokenA?.address, genericTokenA?.decimals, genericTokenB?.address, genericTokenB?.decimals])

  return (
    <>
      <Helmet>
        <title>Pools - FajuARC</title>
        <meta name="description" content="Explore liquidity pools on FajuARC" />
      </Helmet>

      <div className="py-8 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">Pools</h1>
        <SegmentedTabs
          tabs={[
            { id: 'v2', label: 'V2 Pools' },
            { id: 'v3', label: 'V3 Positions' },
          ]}
          activeId={tab}
          onChange={(id) => {
            const t = id as 'v2' | 'v3'
            setTab(t)
            setSearchParams(t === 'v2' ? {} : { tab: 'v3' })
          }}
          className="mb-6"
        />

        {tab === 'v3' && <V3PositionsPage />}

        {tab === 'v2' && isWrongChain && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            Connect to <strong>Arc Testnet</strong> to view pools.
          </div>
        )}

        {tab === 'v2' && !isWrongChain && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Available pairs</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setGenericAddOpen(true); setGenericTokenA(null); setGenericTokenB(null); setGenericAmountA(''); setGenericAmountB('') }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add liquidity
                </button>
                <button
                  onClick={refetch}
                  disabled={loading}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2">
                <span className="text-sm text-red-200">{error}</span>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <PoolCardSkeleton key={i} />
                ))}
              </div>
            )}

            {!loading && pools.length === 0 && !error && (
              <div className="p-8 rounded-2xl border border-slate-700/50 bg-slate-800/20 text-center">
                <p className="text-slate-400">No pools available.</p>
              </div>
            )}

            {!loading && pools.length > 0 && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: {
                    transition: { staggerChildren: 0.05 },
                  },
                }}
                className="space-y-4"
              >
                {pools.map((pool) => (
                  <PoolMarketCard
                    key={pool.pairAddress}
                    pool={pool}
                    onAddLiquidity={() => { setAddModalPool(pool); setAmount0(''); setAmount1(''); }}
                    explorerBase={ARCDEX.explorer}
                    explorerName={ARCDEX.explorerName}
                  />
                ))}
              </motion.div>
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
                  <h3 className="text-lg font-semibold text-white">Add liquidity — {addModalPool.pairName}</h3>
                  <button onClick={() => setAddModalPool(null)} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
                {!isConnected ? (
                  <p className="text-slate-400 text-sm">Connect your wallet to add liquidity.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-400">{addModalPool.token0.symbol}</label>
                        {poolModalBalance0 != null && (
                          <span className="text-xs text-cyan-400">
                            Balance: {formatNumber(poolModalBalance0, 4)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={amount0}
                          onChange={(e) => setAmount0(e.target.value)}
                          placeholder="0.0"
                          className="flex-1 bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        {poolModalBalance0 != null && parseFloat(poolModalBalance0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setAmount0(poolModalBalance0)}
                            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-slate-700/60 transition-colors"
                          >
                            Max
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-400">{addModalPool.token1.symbol}</label>
                        {poolModalBalance1 != null && (
                          <span className="text-xs text-cyan-400">
                            Balance: {formatNumber(poolModalBalance1, 4)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={amount1}
                          onChange={(e) => setAmount1(e.target.value)}
                          placeholder="0.0"
                          className="flex-1 bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        {poolModalBalance1 != null && parseFloat(poolModalBalance1) > 0 && (
                          <button
                            type="button"
                            onClick={() => setAmount1(poolModalBalance1)}
                            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-slate-700/60 transition-colors"
                          >
                            Max
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddLiquidity(addModalPool)}
                      disabled={addingLiquidity || isPending || isConfirming || !amount0 || !amount1}
                      className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {addingLiquidity || isPending || isConfirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add'}
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generic Add Liquidity Modal */}
        <AnimatePresence>
          {genericAddOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGenericAddOpen(false)}
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
                  <h3 className="text-lg font-semibold text-white">Add liquidity / Create pool</h3>
                  <button onClick={() => setGenericAddOpen(false)} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
                {!isConnected ? (
                  <p className="text-slate-400 text-sm">Connect your wallet to add liquidity.</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-slate-400">Token A</label>
                        {genericTokenA && balanceA != null && (
                          <span className="text-xs text-cyan-400">Balance: {formatNumber(balanceA, 4)}</span>
                        )}
                      </div>
                      <TokenSelectButton
                        tokens={[...ARC_TESTNET_TOKENS]}
                        selected={genericTokenA}
                        onSelect={(t) => setGenericTokenA(t as ArcTestnetToken)}
                        excludedAddress={genericTokenB?.address}
                        showBalance
                        placeholder="Select token A"
                        className="w-full justify-between"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          value={genericAmountA}
                          onChange={(e) => {
                            const val = e.target.value
                            setGenericAmountA(val)
                            if (pairReserves) setGenericAmountB(computeAmountBFromA(val))
                          }}
                          placeholder="0.0"
                          className="flex-1 bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        {genericTokenA && balanceA != null && parseFloat(balanceA) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setGenericAmountA(balanceA)
                              if (pairReserves) setGenericAmountB(computeAmountBFromA(balanceA))
                            }}
                            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-slate-700/60 transition-colors"
                          >
                            Max
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-slate-400">Token B</label>
                        {genericTokenB && balanceB != null && (
                          <span className="text-xs text-cyan-400">Balance: {formatNumber(balanceB, 4)}</span>
                        )}
                      </div>
                      <TokenSelectButton
                        tokens={[...ARC_TESTNET_TOKENS]}
                        selected={genericTokenB}
                        onSelect={(t) => setGenericTokenB(t as ArcTestnetToken)}
                        excludedAddress={genericTokenA?.address}
                        showBalance
                        placeholder="Select token B"
                        className="w-full justify-between"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          value={genericAmountB}
                          onChange={(e) => {
                            const val = e.target.value
                            setGenericAmountB(val)
                            if (pairReserves) setGenericAmountA(computeAmountAFromB(val))
                          }}
                          placeholder="0.0"
                          className="flex-1 bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        {genericTokenB && balanceB != null && parseFloat(balanceB) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setGenericAmountB(balanceB)
                              if (pairReserves) setGenericAmountA(computeAmountAFromB(balanceB))
                            }}
                            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded hover:bg-slate-700/60 transition-colors"
                          >
                            Max
                          </button>
                        )}
                      </div>
                    </div>
                    {genericTokenA && genericTokenB && (
                      <PairExistsHint tokenA={genericTokenA} tokenB={genericTokenB} publicClient={publicClient} isWrongChain={!!isWrongChain} />
                    )}
                    <button
                      onClick={handleGenericAddLiquidity}
                      disabled={addingLiquidity || isPending || isConfirming || !genericTokenA || !genericTokenB || !genericAmountA || !genericAmountB}
                      className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {addingLiquidity || isPending || isConfirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add'}
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
