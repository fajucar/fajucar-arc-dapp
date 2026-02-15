/*
  My Pools - Visualizar posições de liquidez do usuário
  - Mostra todos os pools onde o usuário tem LP tokens
  - Exibe saldo de LP tokens e valores equivalentes em token0/token1
  - Permite remover liquidez
*/

import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { RefreshCw, AlertCircle, Trash2, Loader2, Wallet } from 'lucide-react'
import { getUserPools, type UserPoolPosition } from '@/lib/arcDexRead'
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits } from 'viem'
import { toast } from 'react-hot-toast'

// ABI para LP token (transfer, approve)
const LP_TOKEN_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// ABI para Pair (burn)
const PAIR_BURN_ABI = [
  {
    name: 'burn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
] as const

export function MyPoolsPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [pools, setPools] = useState<UserPoolPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingLiquidity, setRemovingLiquidity] = useState<`0x${string}` | null>(null)

  const loadUserPools = async () => {
    if (!address || !publicClient) {
      setPools([])
      return
    }

    setLoading(true)
    setError(null)

    console.log('[MyPoolsPage] Loading pools for address:', address)

    try {
      const userPools = await getUserPools(address, publicClient)
      console.log('[MyPoolsPage] Loaded pools:', userPools)
      setPools(userPools)
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro ao carregar pools'
      setError(errorMsg)
      console.error('[MyPoolsPage] Error loading user pools:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected && address && publicClient) {
      loadUserPools()
    } else {
      setPools([])
    }
  }, [isConnected, address, publicClient])

  // Recarregar após transação confirmada
  useEffect(() => {
    if (isSuccess) {
      toast.success('Transação confirmada!')
      loadUserPools()
    }
  }, [isSuccess])

  const handleRemoveLiquidity = async (pool: UserPoolPosition) => {
    if (!address || !publicClient) {
      toast.error('Conecte sua carteira')
      return
    }

    setRemovingLiquidity(pool.pairAddress)

    try {
      // 1. Verificar allowance
      const lpBalanceBigInt = BigInt(pool.lpBalance)
      const allowance = (await publicClient.readContract({
        address: pool.pairAddress,
        abi: LP_TOKEN_ABI,
        functionName: 'allowance',
        args: [address, pool.pairAddress],
      })) as bigint

      // 2. Se necessário, aprovar LP tokens
      if (allowance < lpBalanceBigInt) {
        toast.loading('Aprovando LP tokens...', { id: 'approve' })
        await writeContract({
          address: pool.pairAddress,
          abi: LP_TOKEN_ABI,
          functionName: 'approve',
          args: [pool.pairAddress, lpBalanceBigInt],
        })
        toast.dismiss('approve')
        toast.success('LP tokens aprovados')
      }

      // 3. Transferir LP tokens para o Pair
      toast.loading('Transferindo LP tokens...', { id: 'transfer' })
      await writeContract({
        address: pool.pairAddress,
        abi: LP_TOKEN_ABI,
        functionName: 'transfer',
        args: [pool.pairAddress, lpBalanceBigInt],
      })
      toast.dismiss('transfer')

      // 4. Chamar burn() no Pair
      toast.loading('Removendo liquidez...', { id: 'burn' })
      await writeContract({
        address: pool.pairAddress,
        abi: PAIR_BURN_ABI,
        functionName: 'burn',
        args: [address],
      })
      toast.dismiss('burn')
      toast.success('Liquidez removida com sucesso!')
    } catch (err: any) {
      toast.dismiss()
      const errorMsg = err?.shortMessage || err?.message || 'Erro ao remover liquidez'
      toast.error(errorMsg)
      console.error('Error removing liquidity:', err)
    } finally {
      setRemovingLiquidity(null)
    }
  }

  if (!isConnected) {
    return (
      <>
        <Helmet>
          <title>My Pools - Arc Network</title>
          <meta name="description" content="View your liquidity positions on ArcDEX" />
        </Helmet>

        <div className="min-h-screen bg-slate-950 py-8 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-lg p-8 text-center">
              <Wallet className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Conecte sua carteira</h2>
              <p className="text-slate-400">Conecte sua carteira para visualizar suas posições de liquidez.</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>My Pools - Arc Network</title>
        <meta name="description" content="View and manage your liquidity positions on ArcDEX" />
      </Helmet>

      <div className="min-h-screen bg-slate-950 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">My Pools</h1>
              {address && (
                <div className="text-xs text-slate-400 font-mono">
                  Carteira: {address}
                </div>
              )}
            </div>
            <button
              onClick={loadUserPools}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 font-semibold hover:bg-cyan-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando suas posições...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-red-400 mb-1">Erro</div>
                  <div className="text-xs text-red-300">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && pools.length === 0 && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-lg p-8 text-center">
              <Wallet className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Nenhuma posição encontrada</h2>
              <p className="text-slate-400 mb-4">
                Você não possui LP tokens em nenhum pool no momento.
              </p>
              <a
                href="/pools"
                className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all"
              >
                Adicionar Liquidez
              </a>
            </div>
          )}

          {/* Pools List */}
          {!loading && pools.length > 0 && (
            <div className="space-y-4">
              {pools.map((pool) => (
                <div
                  key={pool.pairAddress}
                  className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-lg p-6"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {pool.token0.symbol} / {pool.token1.symbol}
                      </h3>
                      <div className="text-xs text-slate-400 font-mono">
                        {pool.pairAddress}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveLiquidity(pool)}
                      disabled={removingLiquidity === pool.pairAddress || isPending || isConfirming}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/50 bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {removingLiquidity === pool.pairAddress || isPending || isConfirming ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Removendo...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          <span>Remover Liquidez</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* LP Token Balance */}
                  <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-400 mb-1">LP Tokens</div>
                    <div className="text-lg font-semibold text-cyan-400">
                      {pool.lpBalanceFormatted} ARC-LP
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Raw: {pool.lpBalance}
                    </div>
                  </div>

                  {/* Token Amounts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Token 0 */}
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">{pool.token0.symbol}</div>
                      <div className="text-lg font-semibold text-white">
                        {pool.token0AmountFormatted}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        Raw: {pool.token0Amount}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Reserve: {formatUnits(BigInt(pool.reserve0), pool.token0.decimals)}
                      </div>
                    </div>

                    {/* Token 1 */}
                    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">{pool.token1.symbol}</div>
                      <div className="text-lg font-semibold text-white">
                        {pool.token1AmountFormatted}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        Raw: {pool.token1Amount}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Reserve: {formatUnits(BigInt(pool.reserve1), pool.token1.decimals)}
                      </div>
                    </div>
                  </div>

                  {/* Pool Info */}
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="text-xs text-slate-400">
                      Total Supply (LP): {pool.totalSupplyFormatted} ARC-LP
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
