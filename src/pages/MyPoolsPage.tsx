/*
  My Pools Page — User Positions (DEX architecture)
  - Shows ONLY pools where user has LP balance > 0
  - Uses useUserPositions(address) — NO general pool list
  - LP balance, deposited amounts, participation %, Remove Liquidity, Manage
*/

import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { RefreshCw, AlertCircle, Trash2, Loader2, Wallet, X, ExternalLink, Plus, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { parseUnits } from 'viem'
import { toast } from 'react-hot-toast'
import { useUserPositions } from '@/hooks/usePools'
import { ensureAllowance } from '@/lib/allowance'
import { ARCDEX } from '@/config/arcDex'
import { formatNumber, formatPercent } from '@/lib/format'
import type { UserPoolPosition } from '@/lib/arcDexRead'

const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const

const PAIR_BURN_ABI = [
  { name: 'burn', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }], outputs: [{ name: 'amount0', type: 'uint256' }, { name: 'amount1', type: 'uint256' }] },
] as const

const LIQUIDITY_HELPER_ABI = [
  { name: 'addLiquidity', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'pair', type: 'address' }, { name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'amountA', type: 'uint256' }, { name: 'amountB', type: 'uint256' }], outputs: [{ name: 'liquidity', type: 'uint256' }] },
] as const

function PositionCard({
  pool,
  onManage,
  onRemove,
  removingLiquidity,
  isPending,
  isConfirming,
  explorerBase,
  explorerName,
}: {
  pool: UserPoolPosition
  onManage: () => void
  onRemove: () => void
  removingLiquidity: boolean
  isPending: boolean
  isConfirming: boolean
  explorerBase: string
  explorerName: string
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const isActive = BigInt(pool.lpBalance) > 0n
  const sharePct = BigInt(pool.totalSupply) > 0n
    ? formatPercent((Number(pool.lpBalance) / Number(pool.totalSupply)) * 100, 2)
    : '-'

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 shadow-lg shadow-black/20 p-5 transition-all hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/25">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-white">{pool.token0.symbol} / {pool.token1.symbol}</h3>
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/60 text-slate-300 border border-slate-500/40">v2</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-600/60 text-slate-300 border border-slate-500/40">0.30%</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={onManage}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-600 text-white transition-colors"
          >
            Gerenciar
          </button>
          <button
            onClick={onRemove}
            disabled={removingLiquidity || isPending || isConfirming}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {removingLiquidity || isPending || isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover liquidez
          </button>
          <a
            href={`${explorerBase}/address/${pool.pairAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            Ver no explorer
            <ExternalLink className="inline h-3.5 w-3.5 ml-1 align-middle" />
          </a>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          Ativa
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Posição LP</div>
          <div className="text-base font-semibold text-white">{formatNumber(pool.lpBalanceFormatted, 3)} LP</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Tokens depositados</div>
          <div className="text-sm text-slate-200">
            {formatNumber(pool.token0AmountFormatted, 3)} {pool.token0.symbol}<br />
            {formatNumber(pool.token1AmountFormatted, 3)} {pool.token1.symbol}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-0.5">Participação</div>
          <div className="text-base font-medium text-slate-200">{sharePct}</div>
        </div>
      </div>
      <div className="flex items-center justify-end mb-3">
        <div className="w-20 h-8 rounded bg-slate-700/40 border border-slate-600/30 flex items-center justify-center">
          <svg width="64" height="24" viewBox="0 0 64 24" className="opacity-40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 20 L8 16 L16 18 L24 10 L32 14 L40 8 L48 12 L56 6 L64 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" />
          </svg>
        </div>
      </div>
      <div className="border-t border-slate-700/50 pt-3">
        <button
          onClick={() => setDetailsOpen((o) => !o)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Detalhes
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
        </button>
        {detailsOpen && (
          <div className="mt-3 space-y-2 text-xs text-slate-400 font-mono">
            <div>
              <span className="text-slate-500">Pair:</span>{' '}
              <a href={`${explorerBase}/address/${pool.pairAddress}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">
                {pool.pairAddress}
              </a>
            </div>
            <div><span className="text-slate-500">LP (raw):</span> {pool.lpBalance}</div>
            <div>
              <span className="text-slate-500">Token0:</span>{' '}
              <a href={`${explorerBase}/address/${pool.token0.address}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">{pool.token0.address}</a>
            </div>
            <div>
              <span className="text-slate-500">Token1:</span>{' '}
              <a href={`${explorerBase}/address/${pool.token1.address}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300">{pool.token1.address}</a>
            </div>
            <a href={`${explorerBase}/address/${pool.pairAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 pt-1">
              Ver em {explorerName}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export function MyPoolsPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { writeContractAsync, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const isWrongChain = chainId != null && chainId !== ARCDEX.chainId
  const { positions, loading, error, refetch } = useUserPositions(address, isConnected, isWrongChain)

  const [managePool, setManagePool] = useState<typeof positions[0] | null>(null)
  const [manageAction, setManageAction] = useState<'add' | 'remove' | null>(null)
  const [removingLiquidity, setRemovingLiquidity] = useState<`0x${string}` | null>(null)
  const [amount0, setAmount0] = useState('')
  const [amount1, setAmount1] = useState('')
  const [addingLiquidity, setAddingLiquidity] = useState(false)

  useEffect(() => {
    if (isSuccess) {
      toast.success('Transação confirmada')
      refetch()
    }
  }, [isSuccess, refetch])

  const handleAddLiquidity = async (pool: typeof positions[0]) => {
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
      setManagePool(null)
      setManageAction(null)
    } catch (err: unknown) {
      toast.dismiss()
      toast.error(err instanceof Error ? err.message : 'Falha ao adicionar liquidez')
    } finally {
      setAddingLiquidity(false)
    }
  }

  const handleRemoveLiquidity = async (pool: typeof positions[0]) => {
    setManageAction(null)
    if (!address || !publicClient) {
      toast.error('Conecte sua carteira')
      return
    }
    setRemovingLiquidity(pool.pairAddress)
    const lpBalanceBigInt = BigInt(pool.lpBalance)
    try {
      const allowance = (await publicClient.readContract({
        address: pool.pairAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, pool.pairAddress],
      })) as bigint
      if (allowance < lpBalanceBigInt) {
        toast.loading('Aprovando LP tokens...', { id: 'ap' })
        const apHash = await writeContractAsync({ address: pool.pairAddress, abi: ERC20_ABI, functionName: 'approve', args: [pool.pairAddress, lpBalanceBigInt] })
        await publicClient.waitForTransactionReceipt({ hash: apHash })
        toast.dismiss('ap')
      }
      toast.loading('Removendo liquidez...', { id: 'rm' })
      const trHash = await writeContractAsync({ address: pool.pairAddress, abi: ERC20_ABI, functionName: 'transfer', args: [pool.pairAddress, lpBalanceBigInt] })
      await publicClient.waitForTransactionReceipt({ hash: trHash })
      const burnHash = await writeContractAsync({ address: pool.pairAddress, abi: PAIR_BURN_ABI, functionName: 'burn', args: [address] })
      await publicClient.waitForTransactionReceipt({ hash: burnHash })
      toast.dismiss('rm')
      toast.success('Liquidez removida')
      setManagePool(null)
    } catch (err: unknown) {
      toast.dismiss()
      toast.error(err instanceof Error ? err.message : 'Erro ao remover liquidez')
    } finally {
      setRemovingLiquidity(null)
    }
  }

  if (!isConnected) {
    return (
      <>
        <Helmet><title>Minhas posições - FajuARC</title></Helmet>
        <div className="py-12 px-4 max-w-3xl mx-auto text-center">
          <Wallet className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Conecte sua carteira</h1>
          <p className="text-slate-400">Conecte para ver e gerenciar suas posições de liquidez.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>Minhas posições - FajuARC</title>
        <meta name="description" content="Suas posições de liquidez no FajuARC" />
      </Helmet>

      <div className="py-8 px-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Minhas posições</h1>

        {isWrongChain && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            Conecte à <strong>Arc Testnet</strong> para gerenciar suas posições.
          </div>
        )}

        {!isWrongChain && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Suas posições de LP</h2>
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
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-sm text-red-200">{error}</span>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 py-12">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando posições...
              </div>
            )}

            {!loading && positions.length === 0 && (
              <div className="p-8 rounded-2xl border border-slate-700/50 bg-slate-800/20 text-center">
                <p className="text-slate-400 mb-4">Você ainda não tem posições. Adicione liquidez em Pools.</p>
                <a href="/pools" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">
                  Pools →
                </a>
              </div>
            )}

            {!loading && positions.length > 0 && (
              <div className="space-y-4">
                {positions.map((pool) => (
                  <PositionCard
                    key={pool.pairAddress}
                    pool={pool}
                    onManage={() => { setManagePool(pool); setManageAction(null); setAmount0(''); setAmount1(''); }}
                    onRemove={() => { setManagePool(pool); setManageAction('remove'); }}
                    removingLiquidity={removingLiquidity === pool.pairAddress}
                    isPending={isPending}
                    isConfirming={isConfirming}
                    explorerBase={ARCDEX.explorer}
                    explorerName={ARCDEX.explorerName}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manage modal (Add / Remove) */}
        <AnimatePresence>
          {managePool && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setManagePool(null)}
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
                  <h3 className="text-lg font-semibold text-white">Gerenciar {managePool.token0.symbol} / {managePool.token1.symbol}</h3>
                  <button onClick={() => setManagePool(null)} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <X className="h-5 w-5 text-slate-400" />
                  </button>
                </div>
                {!manageAction ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setManageAction('add')}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-600 bg-slate-800/60 text-white font-medium hover:bg-slate-700/60 transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                      Adicionar liquidez
                    </button>
                    <button
                      onClick={() => setManageAction('remove')}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                      Remover liquidez
                    </button>
                  </div>
                ) : manageAction === 'add' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">{managePool.token0.symbol}</label>
                      <input
                        type="number"
                        value={amount0}
                        onChange={(e) => setAmount0(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">{managePool.token1.symbol}</label>
                      <input
                        type="number"
                        value={amount1}
                        onChange={(e) => setAmount1(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-slate-800/60 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setManageAction(null)} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 font-medium hover:bg-slate-800 transition-colors">Voltar</button>
                      <button
                        onClick={() => managePool && handleAddLiquidity(managePool)}
                        disabled={addingLiquidity || isPending || isConfirming || !amount0 || !amount1}
                        className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {addingLiquidity || isPending || isConfirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Adicionar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-slate-400 text-sm">Você receberá {managePool.token0.symbol} e {managePool.token1.symbol} de volta.</p>
                    <div className="flex gap-3">
                      <button onClick={() => setManageAction(null)} className="flex-1 py-3 rounded-xl border border-slate-600 text-slate-300 font-medium hover:bg-slate-800 transition-colors">Voltar</button>
                      <button
                        onClick={() => managePool && handleRemoveLiquidity(managePool)}
                        disabled={removingLiquidity === managePool.pairAddress || isPending || isConfirming}
                        className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {removingLiquidity === managePool.pairAddress || isPending || isConfirming ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar'}
                      </button>
                    </div>
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
