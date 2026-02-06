import { useState, useEffect } from 'react'
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits, maxUint256, decodeErrorResult } from 'viem'
import { ArrowDownUp, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { ARCDEX } from '@/config/arcDex'
import { CONSTANTS } from '@/config/constants'

export type SwapDebugData = {
  routerAddress: string
  factoryAddress: string
  routerFactoryOnChain: string | null
  pairAddress: string | null
  reserve0: string
  reserve1: string
  token0: string | null
  token1: string | null
  balanceUser: string
  allowanceUser: string
  blockTimestamp: string | null
  deadlineClient: string
  warning: string | null
}

const ARC_TESTNET_CHAIN_ID = CONSTANTS.ARC_TESTNET_CHAIN_ID
const SLIPPAGE_DEFAULT = 0.5
// 1% em basis points para amountOutMin (evita revert INSUFFICIENT_OUTPUT_AMOUNT por arredondamento)
const SLIPPAGE_BPS = 100n
const DEX_ROUTER_ADDRESS = ARCDEX.router
const CONFIG_FACTORY = ARCDEX.factory

function safeParseUnits(value: string, decimals: number): bigint | null {
  try {
    const t = (value ?? '').trim()
    if (!t) return null
    const n = parseFloat(t)
    if (isNaN(n) || n < 0) return null
    return parseUnits(t, decimals)
  } catch {
    return null
  }
}

// ERC20 ABI mínimo (balanceOf, approve, transfer, allowance, decimals)
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
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
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const

// ABI mínima do Router para ler factory()
const ROUTER_FACTORY_ABI = [
  {
    name: 'factory',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

// ArcDEX Router ABI (fork customizado do Uniswap V2 para Arc Network)
// Compatível com USDC como gas token (Arc Testnet)
// Ver: docs/ArcDEX_Simple.sol
const ARCDEX_ROUTER_ABI = [
  {
    name: 'factory',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'pairFor',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  // Erro padrão Solidity require(msg) = Error(string), selector 0x08c379a0
  {
    name: 'Error',
    type: 'error',
    inputs: [{ name: 'message', type: 'string' }],
  },
  // Panic(uint256) para reverts de assert/overflow
  {
    name: 'Panic',
    type: 'error',
    inputs: [{ name: 'code', type: 'uint256' }],
  },
] as const

// ABI só com erros para decodificação (evita conflito de nomes)
const ROUTER_ERROR_ABI = [
  { name: 'Error', type: 'error', inputs: [{ name: 'message', type: 'string' }] },
  { name: 'Panic', type: 'error', inputs: [{ name: 'code', type: 'uint256' }] },
] as const

// Helper para extrair mensagem real do erro
function extractRevertReason(error: any): string {
  // Tentar usar o método walk() do viem para obter causa raiz
  if (error?.walk) {
    try {
      const rootCause = error.walk()
      if (rootCause && rootCause !== error) {
        const rootMsg = extractRevertReason(rootCause)
        if (rootMsg && rootMsg !== 'Erro desconhecido' && rootMsg.length > 3) {
          return rootMsg
        }
      }
    } catch {
      // Ignorar erro ao usar walk()
    }
  }

  // Tentar decodificar erro usando decodeErrorResult
  if (error?.data && typeof error.data === 'string' && error.data.startsWith('0x')) {
    try {
      const decoded = decodeErrorResult({
        abi: ARCDEX_ROUTER_ABI,
        data: error.data as `0x${string}`,
      })
      if (decoded.args && decoded.args.length > 0) {
        return String(decoded.args[0])
      }
      if (decoded.errorName) {
        return decoded.errorName
      }
    } catch {
      // Se não conseguir decodificar, continuar com outras opções
    }
  }

  // Tentar extrair mensagem de diferentes propriedades do erro (prioridade: shortMessage > message > cause)
  let errorMsg = 
    error?.shortMessage ||
    error?.message ||
    error?.cause?.message ||
    error?.cause?.shortMessage ||
    error?.reason ||
    error?.data?.message ||
    error?.details ||
    error?.toString() ||
    'Erro desconhecido'

  // Converter para string se necessário
  errorMsg = String(errorMsg)
  
  // Se a mensagem é apenas "reverted" sem detalhes, tentar obter mais informações
  if (errorMsg.toLowerCase().includes('reverted') && errorMsg.length < 50) {
    // Tentar obter informações do cause ou walk
    if (error?.cause) {
      const causeMsg = String(error.cause?.message || error.cause?.shortMessage || '')
      if (causeMsg && causeMsg.length > errorMsg.length) {
        errorMsg = causeMsg
      }
    }
  }

  // Tentar extrair mensagem específica do Router (ArcDEX: ...)
  const arcDexMatch = errorMsg.match(/ArcDEX:\s*([^\n"']+)/i)
  if (arcDexMatch) {
    return arcDexMatch[1].trim()
  }

  // Tentar extrair mensagem de revert genérico com diferentes padrões
  const revertPatterns = [
    /revert(?:ed)?(?:\s+with\s+reason\s+string)?\s*["']?([^"'\n]+)["']?/i,
    /execution\s+reverted(?:\s+with\s+reason)?\s*["']?([^"'\n]+)["']?/i,
    /reason:\s*["']?([^"'\n]+)["']?/i,
    /message:\s*["']?([^"'\n]+)["']?/i,
  ]

  for (const pattern of revertPatterns) {
    const match = errorMsg.match(pattern)
    if (match && match[1]) {
      const extracted = match[1].trim()
      if (extracted && extracted !== 'revert' && extracted !== 'reverted') {
        return extracted
      }
    }
  }

  // Se contém "reverted" mas não conseguiu extrair mensagem específica
  if (errorMsg.toLowerCase().includes('reverted') && !errorMsg.toLowerCase().includes('ArcDEX')) {
    // Tentar pegar a última parte da mensagem após "reverted"
    const parts = errorMsg.split(/reverted/i)
    if (parts.length > 1) {
      const afterRevert = parts[parts.length - 1].trim()
      if (afterRevert) {
        // Limpar aspas e espaços extras
        const cleaned = afterRevert.replace(/^["']+|["']+$/g, '').trim()
        if (cleaned && cleaned.length > 2) {
          return cleaned
        }
      }
    }
  }

  // Se a mensagem contém informações úteis mas não foi extraída, retornar ela mesma
  if (errorMsg && errorMsg.length > 5 && errorMsg !== 'Erro desconhecido') {
    // Remover partes comuns que não são úteis
    const cleaned = errorMsg
      .replace(/^Error:\s*/i, '')
      .replace(/^The contract function .+ reverted\.?$/i, '')
      .trim()
    
    if (cleaned && cleaned.length > 2) {
      return cleaned
    }
  }

  // Fallback final: retornar mensagem original se tiver conteúdo útil
  return errorMsg && errorMsg.length > 2 ? errorMsg : 'Erro desconhecido na simulação'
}

// Factory ABI mínimo (getPair)
const FACTORY_ABI = [
  {
    name: 'getPair',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
] as const

// Pair ABI mínimo (getReserves, token0, token1)
const PAIR_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_reserve0', type: 'uint112' },
      { name: '_reserve1', type: 'uint112' },
      { name: '_blockTimestampLast', type: 'uint32' },
    ],
  },
  {
    name: 'token0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'token1',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

interface Token {
  address: `0x${string}`
  symbol: string
  decimals: number
}

const TOKENS: Token[] = [
  { address: ARCDEX.usdc, symbol: 'USDC', decimals: ARCDEX.decimals.USDC },
  { address: ARCDEX.eurc, symbol: 'EURC', decimals: ARCDEX.decimals.EURC },
]

export function SwapInterface() {
  const { address, isConnected, chainId } = useAccount()
  const publicClient = usePublicClient()
  const isWrongChain = chainId != null && chainId !== ARC_TESTNET_CHAIN_ID

  const [tokenFrom, setTokenFrom] = useState<Token>(TOKENS[0])
  const [tokenTo, setTokenTo] = useState<Token | null>(null)
  const [amountFrom, setAmountFrom] = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [slippage, setSlippage] = useState(SLIPPAGE_DEFAULT)
  const [balanceFrom, setBalanceFrom] = useState<bigint>(0n)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [lastSwapTxHash, setLastSwapTxHash] = useState<string | null>(null)
  const [routerFactoryOk, setRouterFactoryOk] = useState<boolean | null>(null)
  const [debugData, setDebugData] = useState<SwapDebugData | null>(null)
  const [lastSimError, setLastSimError] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)

  const { writeContractAsync: writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Carregar balance do token origem
  useEffect(() => {
    if (!address || !publicClient || !tokenFrom) return

    const loadBalance = async () => {
      try {
        const balance = (await publicClient.readContract({
          address: tokenFrom.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        })) as bigint

        setBalanceFrom(balance)
      } catch (err) {
        console.error('Error loading balance:', err)
        setBalanceFrom(0n)
      }
    }

    loadBalance()
  }, [address, publicClient, tokenFrom])

  // Verificar se precisa de approve
  useEffect(() => {
    const amountIn = safeParseUnits(amountFrom, tokenFrom.decimals)
    if (!address || !publicClient || !tokenFrom || !DEX_ROUTER_ADDRESS || amountIn == null || amountIn <= 0n) {
      setNeedsApproval(false)
      return
    }

    const checkAllowance = async () => {
      try {
        const allowance = (await publicClient.readContract({
          address: tokenFrom.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, DEX_ROUTER_ADDRESS],
        })) as bigint

        setNeedsApproval(allowance < amountIn)
      } catch (err) {
        console.error('Error checking allowance:', err)
        setNeedsApproval(true)
      }
    }

    checkAllowance()
  }, [address, publicClient, tokenFrom, amountFrom, DEX_ROUTER_ADDRESS])

  // Verificar se o Router usa a mesma Factory da config (só informativo)
  useEffect(() => {
    if (!publicClient || !DEX_ROUTER_ADDRESS) {
      setRouterFactoryOk(null)
      return
    }
    let cancelled = false
    const check = async () => {
      try {
        const rf = (await publicClient.readContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ARCDEX_ROUTER_ABI,
          functionName: 'factory',
        })) as string
        if (!cancelled) {
          setRouterFactoryOk(rf.toLowerCase() === CONFIG_FACTORY.toLowerCase())
        }
      } catch {
        if (!cancelled) setRouterFactoryOk(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [publicClient, DEX_ROUTER_ADDRESS])

  // Debug Panel: buscar router, factory, pair, reserves, balance, allowance, block, deadline
  useEffect(() => {
    if (!publicClient || !tokenFrom || !tokenTo) {
      setDebugData(null)
      return
    }
    let cancelled = false
    const run = async () => {
      const empty: SwapDebugData = {
        routerAddress: DEX_ROUTER_ADDRESS || '—',
        factoryAddress: CONFIG_FACTORY,
        routerFactoryOnChain: null,
        pairAddress: null,
        reserve0: '0',
        reserve1: '0',
        token0: null,
        token1: null,
        balanceUser: '0',
        allowanceUser: '0',
        blockTimestamp: null,
        deadlineClient: String(BigInt(Math.floor(Date.now() / 1000)) + 60n * 20n),
        warning: null,
      }
      try {
        if (!DEX_ROUTER_ADDRESS) {
          if (!cancelled) setDebugData(empty)
          return
        }
        const [routerFactory, pairAddr, block] = await Promise.all([
          publicClient.readContract({
            address: DEX_ROUTER_ADDRESS,
            abi: ARCDEX_ROUTER_ABI,
            functionName: 'factory',
          }).then((r) => String(r)).catch(() => null),
          publicClient.readContract({
            address: CONFIG_FACTORY,
            abi: FACTORY_ABI,
            functionName: 'getPair',
            args: [tokenFrom.address, tokenTo.address],
          }).then((r) => (r && r !== '0x0000000000000000000000000000000000000000' ? String(r) : null)).catch(() => null),
          publicClient.getBlock({ blockTag: 'latest' }).catch(() => null),
        ])
        if (cancelled) return
        let reserve0 = '0', reserve1 = '0', token0Addr: string | null = null, token1Addr: string | null = null
        let warning: string | null = null
        if (pairAddr) {
          try {
            const [reserves, t0, t1] = await Promise.all([
              publicClient.readContract({
                address: pairAddr as `0x${string}`,
                abi: PAIR_ABI,
                functionName: 'getReserves',
              }) as Promise<[bigint, bigint, number]>,
              publicClient.readContract({
                address: pairAddr as `0x${string}`,
                abi: PAIR_ABI,
                functionName: 'token0',
              }) as Promise<`0x${string}`>,
              publicClient.readContract({
                address: pairAddr as `0x${string}`,
                abi: PAIR_ABI,
                functionName: 'token1',
              }) as Promise<`0x${string}`>,
            ])
            reserve0 = reserves[0].toString()
            reserve1 = reserves[1].toString()
            token0Addr = String(t0)
            token1Addr = String(t1)
            if (reserves[0] === 0n || reserves[1] === 0n) {
              warning = 'Sem liquidez ou par inexistente (reserves = 0).'
            }
          } catch {
            warning = 'Sem liquidez ou par inexistente (erro ao ler reserves).'
          }
        } else {
          warning = 'Sem liquidez ou par inexistente (pair = address(0)).'
        }
        let balanceUser = '0', allowanceUser = '0'
        if (address) {
          try {
            const [bal, allow] = await Promise.all([
              publicClient.readContract({
                address: tokenFrom.address,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address],
              }) as Promise<bigint>,
              publicClient.readContract({
                address: tokenFrom.address,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [address, DEX_ROUTER_ADDRESS],
              }) as Promise<bigint>,
            ])
            balanceUser = bal.toString()
            allowanceUser = allow.toString()
          } catch { /* keep 0 */ }
        }
        const deadlineClient = String(BigInt(Math.floor(Date.now() / 1000)) + 60n * 20n)
        if (!cancelled) {
          setDebugData({
            routerAddress: DEX_ROUTER_ADDRESS,
            factoryAddress: CONFIG_FACTORY,
            routerFactoryOnChain: routerFactory,
            pairAddress: pairAddr,
            reserve0,
            reserve1,
            token0: token0Addr,
            token1: token1Addr,
            balanceUser,
            allowanceUser,
            blockTimestamp: block ? String(block.timestamp) : null,
            deadlineClient,
            warning,
          })
        }
      } catch (e) {
        if (!cancelled) setDebugData(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [publicClient, address, tokenFrom, tokenTo])

  // Calcular amountOut quando amountFrom muda (usando Pair diretamente)
  useEffect(() => {
    // Se não tem tokenTo selecionado, limpar amountTo
    if (!tokenTo) {
      setAmountTo('')
      return
    }

    const amountIn = safeParseUnits(amountFrom, tokenFrom.decimals)
    if (amountIn == null || amountIn <= 0n || !tokenFrom || !publicClient) {
      setAmountTo('')
      return
    }

    // Debounce: aguardar 300ms após parar de digitar antes de calcular
    const timeoutId = setTimeout(() => {
      const calculateAmountOut = async () => {
        setIsCalculating(true)
        try {
          // 1. Obter endereço do Pair via Factory
          const pairAddress = (await publicClient.readContract({
            address: ARCDEX.factory,
            abi: FACTORY_ABI,
            functionName: 'getPair',
            args: [tokenFrom.address, tokenTo.address],
          })) as `0x${string}`

          // Se pair não existe ou é zero address, retornar 0.0
          if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
            setAmountTo('0.0')
            return
          }

          // 2. Ler reserves e token0/token1 do Pair
          const [reserves, token0] = await Promise.all([
            publicClient.readContract({
              address: pairAddress,
              abi: PAIR_ABI,
              functionName: 'getReserves',
            }) as Promise<[bigint, bigint, number]>,
            publicClient.readContract({
              address: pairAddress,
              abi: PAIR_ABI,
              functionName: 'token0',
            }) as Promise<`0x${string}`>,
          ])

          const [reserve0, reserve1] = reserves

          // Se reservas são zero, retornar 0.0
          if (reserve0 === 0n || reserve1 === 0n) {
            setAmountTo('0.0')
            return
          }

          // 3. Identificar qual reserve corresponde a cada token
          const token0IsFrom = token0.toLowerCase() === tokenFrom.address.toLowerCase()
          const reserveIn = token0IsFrom ? reserve0 : reserve1
          const reserveOut = token0IsFrom ? reserve1 : reserve0

          // 4. Calcular amountOut usando fórmula Uniswap V2 (fee 0.3% = 997/1000)
          // amountInWithFee = amountIn * 997
          // amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee)
          const amountInWithFee = amountIn * 997n
          const numerator = amountInWithFee * reserveOut
          const denominator = reserveIn * 1000n + amountInWithFee
          const amountOut = numerator / denominator

          // 5. Formatar com decimals do token de saída
          setAmountTo(formatUnits(amountOut, tokenTo.decimals))
        } catch (err) {
          console.error('Error calculating amount out:', err)
          setAmountTo('0.0')
        } finally {
          setIsCalculating(false)
        }
      }

      calculateAmountOut()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [amountFrom, tokenFrom, tokenTo, publicClient])

  const handleApprove = async () => {
    if (!address || !tokenFrom || !DEX_ROUTER_ADDRESS) return

    try {
      await writeContract({
        address: tokenFrom.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [DEX_ROUTER_ADDRESS, maxUint256], // Approve máximo
      })

      toast.success('Aprovação enviada. Aguarde a confirmação.')
    } catch (err: any) {
      const errorMsg = err?.message || err?.shortMessage || ''
      if (errorMsg.includes('rejected') || errorMsg.includes('denied') || errorMsg.includes('User denied')) {
        toast.error('Aprovação cancelada na carteira.')
      } else {
        toast.error(errorMsg || 'Falha na aprovação. Tente novamente.')
      }
    }
  }

  const handleSwap = async () => {
    const routerConfigured = !!DEX_ROUTER_ADDRESS
    const canSwapLocal = routerConfigured && !isWrongChain && amountFrom && amountTo && parseFloat(amountFrom) > 0 && parseFloat(amountTo) > 0 && !needsApproval && !isLoading

    console.log('handleSwap called', {
      address,
      tokenFrom: tokenFrom?.symbol,
      tokenTo: tokenTo?.symbol,
      amountFrom,
      amountTo,
      routerConfigured,
      DEX_ROUTER_ADDRESS,
      needsApproval,
      isLoading,
      isWrongChain,
      canSwapLocal,
    })

    // Validações básicas
    if (!address) {
      toast.error('Conecte sua carteira primeiro.')
      return
    }
    if (!tokenFrom || !tokenTo) {
      toast.error('Selecione os tokens From e To.')
      return
    }
    if (!amountFrom || parseFloat(amountFrom) <= 0) {
      toast.error('Digite um valor válido.')
      return
    }
    if (!amountTo || parseFloat(amountTo) <= 0) {
      toast.error('Aguardando cálculo do valor de saída...')
      return
    }
    if (!DEX_ROUTER_ADDRESS) {
      toast.error('Router não configurado. Configure o Router primeiro.')
      return
    }

    const amountIn = safeParseUnits(amountFrom, tokenFrom.decimals)
    if (amountIn == null || amountIn <= 0n) {
      toast.error('Valor inválido.')
      return
    }

    if (!publicClient) {
      toast.error('Erro: publicClient não disponível.')
      return
    }

    // Verificar mismatch Router/Factory: ler router.factory() e logar
    try {
      if (DEX_ROUTER_ADDRESS) {
        const ROUTER_FACTORY = (await publicClient.readContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ROUTER_FACTORY_ABI,
          functionName: 'factory',
        })) as `0x${string}`
        console.log('CONFIG_FACTORY', CONFIG_FACTORY)
        console.log('ROUTER_FACTORY', ROUTER_FACTORY)
      }
    } catch (factoryErr) {
      console.warn('Erro ao ler router.factory():', factoryErr)
    }

    // Se allowance < amountIn: fazer approve(router, MaxUint256) e aguardar 1 confirmação
    let currentAllowance: bigint
    try {
      currentAllowance = (await publicClient.readContract({
        address: tokenFrom.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, DEX_ROUTER_ADDRESS],
      })) as bigint
      if (currentAllowance < amountIn) {
        toast.loading('Aprovação necessária. Confirme na carteira...', { id: 'swap-pending' })
        const approveHash = await writeContract({
          address: tokenFrom.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [DEX_ROUTER_ADDRESS, maxUint256],
        })
        toast.loading('Aguardando 1 confirmação da aprovação...', { id: 'swap-pending' })
        await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60_000 })
        toast.dismiss('swap-pending')
        toast.success('Aprovação confirmada. Pode fazer o Swap.')
        setNeedsApproval(false)
      }
    } catch (allowanceErr: any) {
      toast.dismiss('swap-pending')
      if (allowanceErr?.message?.includes('rejected') || allowanceErr?.shortMessage?.includes('denied')) {
        toast.error('Aprovação cancelada na carteira.')
      } else {
        toast.error(allowanceErr?.shortMessage || allowanceErr?.message || 'Erro ao aprovar token.')
      }
      return
    }

    // Calcular amountOutMin somente com bigint: amountOutMin = amountOut * (10000 - slippageBps) / 10000
    const amountOut = safeParseUnits(amountTo, tokenTo.decimals)
    if (amountOut == null || amountOut <= 0n) {
      toast.error('Erro ao calcular valor de saída.')
      return
    }
    // Mínimo 1% no cálculo do amountOutMin para evitar revert INSUFFICIENT_OUTPUT_AMOUNT
    const slippageBps = BigInt(Math.min(500, Math.max(100, Math.round(slippage * 100)))) // 1% a 5%
    const amountOutMin = (amountOut * (10000n - slippageBps)) / 10000n
    
    console.log('Cálculo amountOutMin:', {
      amountOut: amountOut.toString(),
      slippageBps: slippageBps.toString(),
      amountOutMin: amountOutMin.toString(),
    })
    
    const path: `0x${string}`[] = [tokenFrom.address, tokenTo.address]

    try {

      // Verificar se o pair existe antes de tentar swap
      toast.loading('Verificando liquidez...', { id: 'swap-pending' })
      try {
        const pairAddress = await publicClient.readContract({
          address: ARCDEX.factory,
          abi: FACTORY_ABI,
          functionName: 'getPair',
          args: [tokenFrom.address, tokenTo.address],
        }) as `0x${string}`

        if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
          toast.dismiss('swap-pending')
          toast.error('Par USDC/EURC não encontrado. Crie o par na Factory ou acesse Pools para adicionar liquidez.')
          return
        }

        // Verificar reservas do pair
        const reserves = await publicClient.readContract({
          address: pairAddress,
          abi: PAIR_ABI,
          functionName: 'getReserves',
        }) as [bigint, bigint, number]

        console.log('Pair info:', {
          pairAddress,
          reserve0: reserves[0].toString(),
          reserve1: reserves[1].toString(),
        })

        if (reserves[0] === 0n || reserves[1] === 0n) {
          toast.dismiss('swap-pending')
          toast.error('Par sem liquidez. Adicione liquidez em Pools (USDC + EURC) e tente o Swap de novo.')
          return
        }

        // Verificação opcional: Router deve usar a mesma Factory (se falhar, seguimos e deixamos o swap tentar)
        try {
          const routerFactory = (await publicClient.readContract({
            address: DEX_ROUTER_ADDRESS,
            abi: ARCDEX_ROUTER_ABI,
            functionName: 'factory',
          })) as `0x${string}`

          const configFactoryLower = CONFIG_FACTORY.toLowerCase()
          const routerFactoryLower = String(routerFactory).toLowerCase()
          if (routerFactoryLower !== configFactoryLower) {
            toast.dismiss('swap-pending')
            toast.error(
              `O Router está ligado a outra Factory (${routerFactory.slice(0, 10)}...). A config usa ${CONFIG_FACTORY.slice(0, 10)}.... Faça redeploy do Router com a Factory da config.`,
              { duration: 14000 }
            )
            return
          }

          const routerPair = (await publicClient.readContract({
            address: DEX_ROUTER_ADDRESS,
            abi: ARCDEX_ROUTER_ABI,
            functionName: 'pairFor',
            args: [tokenFrom.address, tokenTo.address],
          })) as `0x${string}`

          if (routerPair.toLowerCase() !== pairAddress.toLowerCase()) {
            toast.dismiss('swap-pending')
            toast.error(
              `O Router aponta para outro par. Use um Router deployado com a Factory da config (deployments.arc-testnet.json).`,
              { duration: 12000 }
            )
            return
          }
        } catch (routerCheckErr: any) {
          // Não bloquear: pode ser Router antigo sem factory()/pairFor(). Segue para o swap.
          console.warn('Verificação Router (factory/pairFor) falhou, seguindo para swap:', routerCheckErr?.shortMessage || routerCheckErr?.message)
        }
      } catch (pairErr: any) {
        toast.dismiss('swap-pending')
        const msg = pairErr?.shortMessage || pairErr?.message || String(pairErr)
        console.error('Erro ao verificar liquidez:', pairErr)
        toast.error(msg.includes('revert') || msg.length > 80 ? 'Falha ao ler par ou reservas. Confira Factory e rede em deployments.arc-testnet.json.' : msg)
        return
      }

      // deadline = 20 min em segundos (Unix), sem milissegundos
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20)
      let blockTimestamp: bigint | null = null
      try {
        const block = await publicClient.getBlock({ blockTag: 'latest' })
        blockTimestamp = block.timestamp
      } catch { /* opcional para log */ }

      console.log('Preparando swap:', {
        deadline: deadline.toString(),
        deadlineClientSec: Number(deadline),
        blockTimestamp: blockTimestamp?.toString() ?? 'N/A',
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        path,
      })

      // Simular ANTES de enviar: capturar revert reason e exibir no toast / Debug Panel
      setLastSimError(null)
      toast.loading('Simulando transação...', { id: 'swap-pending' })
      try {
        await publicClient.simulateContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ARCDEX_ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [amountIn, amountOutMin, path, address, deadline],
          account: address,
        })
        console.log('Simulação passou!')
      } catch (simErr: any) {
        toast.dismiss('swap-pending')
        
        // Log completo do erro no formato solicitado
        console.log('ERRO simulateContract:', simErr, simErr?.shortMessage, simErr?.details, simErr?.cause, simErr?.message)
        
        // Tentar obter causa raiz usando walk() do viem
        let rootCause = simErr
        if (simErr?.walk) {
          try {
            rootCause = simErr.walk()
            console.log('Causa raiz (walk):', rootCause)
          } catch {
            // Ignorar se walk() falhar
          }
        }
        
        // Tentar decodificar erro se houver data (simErr.data ou simErr.cause?.data)
        let decodedError: string | null = null
        const errorData = (simErr?.data || simErr?.cause?.data) as string | undefined
        if (errorData && typeof errorData === 'string' && errorData.startsWith('0x')) {
          try {
            const decoded = decodeErrorResult({
              abi: ROUTER_ERROR_ABI,
              data: errorData as `0x${string}`,
            })
            if (decoded.errorName === 'Error' && decoded.args?.[0]) {
              decodedError = String(decoded.args[0])
            } else if (decoded.errorName === 'Panic' && decoded.args?.[0] !== undefined) {
              const code = Number(decoded.args[0])
              const panicMsg: Record<number, string> = {
                0x11: 'Overflow/underflow',
                0x12: 'Divisão por zero',
                0x21: 'Assert falhou',
                0x31: 'Underflow em conversão',
                0x32: 'Conversão para enum inválida',
                0x41: 'Acesso a memória fora dos limites',
                0x51: 'Array vazio',
              }
              decodedError = panicMsg[code] || `Panic(${code})`
            } else {
              decodedError = decoded.errorName || ((decoded as { args?: unknown[] }).args?.[0] ? String((decoded as { args?: unknown[] }).args![0]) : null)
            }
            console.log('Erro decodificado:', decodedError)
          } catch {
            // Ignorar se decodificação falhar
          }
        }
        
        // Construir mensagem para toast (prioridade: decodificado > causa raiz > erro original)
        let toastMsg = decodedError ||
                       rootCause?.shortMessage ||
                       rootCause?.message ||
                       simErr?.shortMessage ||
                       simErr?.message ||
                       'Erro na simulação'
        
        // Evitar repetir "Causa: ..." se for igual ao toastMsg
        if (simErr?.details) {
          toastMsg += ` | Detalhes: ${simErr.details}`
        }
        const causeMsg = rootCause?.message || simErr?.cause?.message
        if (causeMsg && causeMsg !== toastMsg && !toastMsg.includes(causeMsg)) {
          toastMsg += ` | Causa: ${causeMsg}`
        }
        
        // Se ainda for apenas "reverted" genérico, diagnosticar: allowance e depois getAmountsOut
        if (toastMsg.toLowerCase().includes('reverted') && !toastMsg.match(/ArcDEX:|EXPIRED|INSUFFICIENT|TRANSFER|INVALID|Panic/i)) {
          try {
            const recheckAllowance = (await publicClient.readContract({
              address: tokenFrom.address,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address, DEX_ROUTER_ADDRESS],
            })) as bigint
            if (recheckAllowance < amountIn) {
              toastMsg = `Aprove o token para este Router (${DEX_ROUTER_ADDRESS.slice(0, 8)}...). Clique em "Approve USDC" e tente o Swap de novo.`
            } else {
              try {
                await publicClient.readContract({
                  address: DEX_ROUTER_ADDRESS,
                  abi: ARCDEX_ROUTER_ABI,
                  functionName: 'getAmountsOut',
                  args: [amountIn, path],
                })
                toastMsg = 'Revert provável: falha no transferFrom (approve pode estar em outro endereço). Clique em "Approve USDC" e tente de novo. Dica: use Tenderly ou Remix para ver o erro exato.'
              } catch (getAmountsErr: any) {
                let decodedRouterMsg = ''
                const errData = getAmountsErr?.data || getAmountsErr?.cause?.data
                if (errData && typeof errData === 'string' && errData.startsWith('0x')) {
                  try {
                    const dec = decodeErrorResult({
                      abi: ROUTER_ERROR_ABI,
                      data: errData as `0x${string}`,
                    })
                    if (dec.errorName === 'Error' && dec.args?.[0]) {
                      decodedRouterMsg = String(dec.args[0])
                    } else if (dec.errorName === 'Panic' && dec.args?.[0] !== undefined) {
                      decodedRouterMsg = `Panic(${dec.args[0]}). Possível overflow ou par sem liquidez.`
                    }
                  } catch { /* ignorar */ }
                }
                if (decodedRouterMsg) {
                  toastMsg = `Router: ${decodedRouterMsg} — O Router pode estar usando outra Factory. No Remix, confira router.factory() e faça redeploy com a Factory da config (0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F).`
                } else if (toastMsg.toLowerCase().includes('reverted') || toastMsg.length < 20) {
                  toastMsg = 'O Router não conseguiu calcular o swap. O Router deve ter sido deployado com a Factory da config. Em deployments.arc-testnet.json: factory 0x386c7... e router 0x2C1aA... — no Remix, router.factory() deve retornar 0x386c7...'
                }
              }
            }
          } catch {
            toastMsg = 'Transação revertida. Abra o Console (F12) e veja "ERRO simulateContract" para o motivo. Ou use Tenderly/Remix para debugar.'
          }
        }
        
        setLastSimError(toastMsg)
        toast.error(toastMsg, { duration: 12000 })
        return
      }

      // Simulação passou: SEMPRE chamar a carteira (não só simular)
      toast.loading('Abrindo carteira para confirmar...', { id: 'swap-pending' })
      let txHash: `0x${string}`
      try {
        txHash = await writeContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ARCDEX_ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [amountIn, amountOutMin, path, address, deadline],
        })
      } catch (writeErr: any) {
        toast.dismiss('swap-pending')
        
        // Log completo do erro no formato solicitado
        console.log('ERRO writeContract:', writeErr, writeErr?.shortMessage, writeErr?.details, writeErr?.cause, writeErr?.message)
        
        // Tentar obter causa raiz usando walk() do viem
        let rootCause = writeErr
        if (writeErr?.walk) {
          try {
            rootCause = writeErr.walk()
            console.log('Causa raiz (walk):', rootCause)
          } catch {
            // Ignorar se walk() falhar
          }
        }
        
        // Construir mensagem para toast usando informações do erro (prioridade: causa raiz > erro original)
        let toastMsg = rootCause?.shortMessage || 
                       rootCause?.message || 
                       writeErr?.shortMessage || 
                       writeErr?.message || 
                       'Erro ao enviar transação'
        
        // Adicionar detalhes se disponíveis
        if (writeErr?.details) {
          toastMsg += ` | Detalhes: ${writeErr.details}`
        }
        if (rootCause?.message && rootCause.message !== toastMsg) {
          toastMsg += ` | Causa: ${rootCause.message}`
        } else if (writeErr?.cause?.message && writeErr.cause.message !== toastMsg) {
          toastMsg += ` | Causa: ${writeErr.cause.message}`
        }
        
        // Se ainda for apenas "reverted" genérico, tentar diagnosticar
        if (toastMsg.toLowerCase().includes('reverted') && !toastMsg.match(/ArcDEX:|EXPIRED|INSUFFICIENT|TRANSFER|INVALID/i)) {
          const diagnosticMsg = 'Transação revertida. Verifique: 1) Token aprovado? 2) Slippage adequado? 3) Liquidez suficiente?'
          toastMsg = diagnosticMsg + ` (Erro: ${toastMsg})`
        }
        
        toast.error(toastMsg, { duration: 12000 })
        return
      }

      console.log('SWAP_TX_HASH', txHash)
      toast.dismiss('swap-pending')
      toast.loading(`Transação enviada. Aguardando confirmação...`, { id: 'swap-confirming' })
      
      // Aguardar confirmação
      if (publicClient) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ 
            hash: txHash,
            timeout: 120_000, // 2 minutos
          })
          
          console.log('SWAP_RECEIPT', receipt)
          toast.dismiss('swap-confirming')
          
          if (receipt.status === 'success') {
            setLastSwapTxHash(txHash)
            const explorerUrl = `https://testnet.arcscan.app/tx/${txHash}`
            toast.success(
              (t) => (
                <span>
                  Swap confirmado na blockchain!{' '}
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    Ver no Explorer
                  </a>
                </span>
              ),
              { duration: 8000 }
            )
            console.log('Swap tx no explorer:', explorerUrl)
            // Limpar campos após sucesso
            setAmountFrom('')
            setAmountTo('')
            // Recarregar balance
            if (address && tokenFrom) {
              try {
                const newBalance = await publicClient.readContract({
                  address: tokenFrom.address,
                  abi: ERC20_ABI,
                  functionName: 'balanceOf',
                  args: [address],
                })
                setBalanceFrom(newBalance as bigint)
              } catch (balanceErr) {
                console.error('Error reloading balance:', balanceErr)
              }
            }
          } else {
            // Transação foi revertida - tentar obter erro real via simulação
            console.error('SWAP_ERROR_RAW - Transaction reverted', receipt)
            let revertReason = 'Transação revertida na blockchain'
            
            try {
              // Simular novamente para capturar o erro real
              const retryBlock = await publicClient.getBlock({ blockTag: 'latest' })
              const retryDeadline = BigInt(Number(retryBlock.timestamp) + 20 * 60)
              await publicClient.simulateContract({
                address: DEX_ROUTER_ADDRESS!,
                abi: ARCDEX_ROUTER_ABI,
                functionName: 'swapExactTokensForTokens',
                args: [amountIn, amountOutMin, path, address, retryDeadline],
                account: address,
              })
            } catch (simErr: any) {
              // Capturar mensagem REAL do erro usando helper
              const errorMsg = extractRevertReason(simErr)
              if (errorMsg) {
                revertReason = errorMsg
              }
            }
            
            toast.error(`Swap falhou: ${revertReason}`)
          }
        } catch (waitErr: any) {
          toast.dismiss('swap-confirming')
          console.error('SWAP_ERROR_RAW - Error waiting for receipt', waitErr)
          const errorMsg = extractRevertReason(waitErr) || 'Erro desconhecido ao aguardar confirmação'
          toast.error(`Erro ao aguardar confirmação: ${errorMsg}`)
        }
      }
    } catch (err: any) {
      toast.dismiss('swap-pending')
      toast.dismiss('swap-confirming')
      
      // Log completo do erro no formato solicitado
      console.log('ERRO handleSwap (catch geral):', err, err?.shortMessage, err?.details, err?.cause, err?.message)
      
      // Construir mensagem para toast usando informações do erro
      let toastMsg = err?.shortMessage || err?.message || 'Erro no swap'
      
      // Adicionar detalhes se disponíveis
      if (err?.details) {
        toastMsg += ` | Detalhes: ${err.details}`
      }
      if (err?.cause?.message) {
        toastMsg += ` | Causa: ${err.cause.message}`
      }
      
      // Detectar cancelamento do usuário
      if (toastMsg.includes('User rejected') || toastMsg.includes('User denied') || toastMsg.includes('rejected') || toastMsg.includes('denied') || err?.code === 4001) {
        toast.error('Transação cancelada pelo usuário.')
        return
      }
      
      // Não mostrar apenas "reverted" genérico
      if (toastMsg.toLowerCase().includes('reverted') && toastMsg.length < 50) {
        toastMsg = `Erro: ${toastMsg}. Verifique console (F12) para detalhes completos.`
      }
      
      toast.error(toastMsg, { duration: 10000 })
    }
  }

  const handleAmountFromChange = (value: string) => {
    // Permitir apenas números, ponto decimal e vírgula (para formato brasileiro)
    const cleaned = value.replace(/[^\d.,]/g, '').replace(',', '.')
    // Permitir apenas um ponto decimal
    const parts = cleaned.split('.')
    if (parts.length > 2) return
    // Limitar casas decimais ao número de decimals do token
    if (parts[1] && parts[1].length > tokenFrom.decimals) return
    setAmountFrom(cleaned)
  }

  const handleMax = () => {
    if (balanceFrom > 0n) {
      setAmountFrom(formatUnits(balanceFrom, tokenFrom.decimals))
    }
  }

  const handleSwitchTokens = () => {
    if (tokenTo) {
      const temp = tokenFrom
      setTokenFrom(tokenTo)
      setTokenTo(temp)
      const tempAmount = amountFrom
      setAmountFrom(amountTo)
      setAmountTo(tempAmount)
    }
  }

  useEffect(() => {
    if (isSuccess) {
      toast.success('Transação confirmada!')
      setAmountFrom('')
      setAmountTo('')
      // Recarregar balance
      if (address && publicClient && tokenFrom) {
        publicClient.readContract({
          address: tokenFrom.address,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }).then((balance) => {
          setBalanceFrom(balance as bigint)
        }).catch(console.error)
      }
    }
  }, [isSuccess, address, publicClient, tokenFrom])

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">Please connect your wallet to swap tokens</p>
      </div>
    )
  }

  const isLoading = isPending || isConfirming
  const routerConfigured = !!DEX_ROUTER_ADDRESS
  const minReceived = amountTo && tokenTo && parseFloat(amountTo) > 0
    ? (parseFloat(amountTo) * (1 - slippage / 100)).toFixed(6)
    : null
  // Botão Swap habilitado: router, rede, valores; approve é feito dentro de handleSwap se necessário
  const canSwap = routerConfigured && !isWrongChain && amountFrom && amountTo && parseFloat(amountFrom) > 0 && parseFloat(amountTo) > 0 && !isLoading

  return (
    <div className="space-y-4">
      {/* Rede errada: aviso Arc Testnet */}
      {isWrongChain && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-200/90">
            <span className="font-medium">Rede incorreta.</span>
            {' '}Conecte na <strong>Arc Testnet</strong> (Chain ID 5042002) para usar o Swap.
          </div>
        </div>
      )}

      {/* Aviso só quando router não configurado */}
      {!routerConfigured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200/90">
            Router não configurado. Configure <code className="bg-slate-800/80 px-1 rounded">router</code> em <code className="bg-slate-800/80 px-1 rounded">src/config/deployments.arc-testnet.json</code> ou <code className="bg-slate-800/80 px-1 rounded">VITE_DEX_ROUTER_ADDRESS</code> no .env.
          </p>
        </div>
      )}

      {/* Token From */}
      <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-400">From</label>
          <button
            onClick={handleMax}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Max: {formatUnits(balanceFrom, tokenFrom.decimals)}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={tokenFrom.address}
            onChange={(e) => {
              const token = TOKENS.find((t) => t.address === e.target.value)
              if (token) setTokenFrom(token)
            }}
            className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            {TOKENS.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={amountFrom}
            onChange={(e) => handleAmountFromChange(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent border-none text-right text-lg text-white placeholder-slate-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* Switch Button */}
      <div className="flex justify-center -my-2">
        <button
          onClick={handleSwitchTokens}
          disabled={!tokenTo}
          className="rounded-full bg-slate-800 border border-cyan-500/20 p-2 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowDownUp className="h-4 w-4 text-cyan-400" />
        </button>
      </div>

      {/* Token To */}
      <div className="rounded-lg border border-cyan-500/20 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-slate-400">To</label>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={tokenTo?.address || ''}
            onChange={(e) => {
              const token = TOKENS.find((t) => t.address === e.target.value)
              if (token) setTokenTo(token)
            }}
            className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">Select token</option>
            {TOKENS.filter((t) => t.address !== tokenFrom.address).map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </select>
          <div className="flex-1 text-right">
            {isCalculating ? (
              <Loader2 className="h-5 w-5 text-slate-500 animate-spin inline-block" />
            ) : (
              <input
                type="text"
                value={amountTo}
                readOnly
                placeholder="0.0"
                className="w-full bg-transparent border-none text-right text-lg text-white placeholder-slate-500 focus:outline-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* Slippage e Min received */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-slate-400">Slippage tolerance (default 0.5%)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
              min="0"
              max="50"
              step="0.1"
              className="w-16 bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-cyan-500"
            />
            <span className="text-xs text-slate-400">%</span>
          </div>
        </div>
        {minReceived != null && tokenTo && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Min received (deadline 20 min)</span>
            <span className="text-cyan-400 font-mono">{minReceived} {tokenTo.symbol}</span>
          </div>
        )}
        {routerFactoryOk === false && (
          <div className="text-xs text-amber-400/90 mt-2 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>O Router não usa a mesma Factory da config. Para o swap funcionar, faça redeploy do Router passando a Factory: 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F</span>
          </div>
        )}
        {routerFactoryOk === true && (
          <div className="text-xs text-emerald-400/80 mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            <span>Router compatível com a Factory da config</span>
          </div>
        )}
      </div>

      {/* Action: Swap (dentro de handleSwap faz approve + espera 1 conf se necessário, depois envia tx) */}
      {!routerConfigured || isWrongChain ? (
        <motion.button
          disabled
          className="w-full rounded-lg bg-slate-600 text-slate-400 py-3 px-4 font-semibold cursor-not-allowed"
        >
          {isWrongChain ? 'Conecte na Arc Testnet' : 'Configure o Router para habilitar Swap'}
        </motion.button>
      ) : (
        <motion.button
          onClick={handleSwap}
          disabled={!canSwap || isLoading}
          className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-4 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          title={!canSwap ? 'Preencha From/To e valor' : needsApproval ? 'Clique para aprovar e swap (se necessário)' : 'Clique para fazer swap'}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{needsApproval ? 'Aprovando...' : 'Swapping...'}</span>
            </>
          ) : (
            <span>Swap</span>
          )}
        </motion.button>
      )}

      {/* Último swap: hash e link para o Explorer (ver na blockchain) */}
      {lastSwapTxHash && (
        <div className="rounded-lg border border-cyan-500/30 bg-slate-900/40 p-3 text-sm">
          <div className="text-slate-400 mb-1">Última transação de swap</div>
          <div className="font-mono text-cyan-400 break-all mb-2">
            {lastSwapTxHash.slice(0, 10)}...{lastSwapTxHash.slice(-8)}
          </div>
          <a
            href={`https://testnet.arcscan.app/tx/${lastSwapTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            Ver no Explorer (blockchain)
          </a>
        </div>
      )}

      {/* Debug Panel */}
      <div className="rounded-lg border border-slate-600/60 bg-slate-900/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setDebugOpen((o) => !o)}
          className="w-full flex items-center justify-between py-2 px-3 text-left text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800/50"
        >
          <span className="font-medium">Debug Panel (Swap)</span>
          {debugOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {debugOpen && (
          <div className="border-t border-slate-700/50 p-3 space-y-2 text-xs font-mono">
            {debugData ? (
              <>
                <div><span className="text-slate-500">routerAddress (config):</span> <span className="text-cyan-400 break-all">{debugData.routerAddress}</span></div>
                <div><span className="text-slate-500">factoryAddress (config):</span> <span className="text-cyan-400 break-all">{debugData.factoryAddress}</span></div>
                <div><span className="text-slate-500">router.factory() on-chain:</span> <span className="text-cyan-400 break-all">{debugData.routerFactoryOnChain ?? '—'}</span></div>
                <div><span className="text-slate-500">pair = factory.getPair(tokenFrom, tokenTo):</span> <span className="text-cyan-400 break-all">{debugData.pairAddress ?? 'address(0)'}</span></div>
                <div><span className="text-slate-500">reserves (getReserves):</span> reserve0={debugData.reserve0} reserve1={debugData.reserve1}</div>
                <div><span className="text-slate-500">token0:</span> <span className="break-all">{debugData.token0 ?? '—'}</span></div>
                <div><span className="text-slate-500">token1:</span> <span className="break-all">{debugData.token1 ?? '—'}</span></div>
                <div><span className="text-slate-500">balanceOf(tokenFrom) user:</span> {debugData.balanceUser}</div>
                <div><span className="text-slate-500">allowance(tokenFrom, router) user:</span> {debugData.allowanceUser}</div>
                <div><span className="text-slate-500">block timestamp (último bloco):</span> {debugData.blockTimestamp ?? '—'}</div>
                <div><span className="text-slate-500">deadline (client, unix sec):</span> {debugData.deadlineClient}</div>
                {debugData.warning && (
                  <div className="text-amber-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    {debugData.warning}
                  </div>
                )}
              </>
            ) : (
              <div className="text-slate-500">Selecione From e To para carregar dados.</div>
            )}
            {lastSimError && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <span className="text-slate-500">Último erro da simulação:</span>
                <div className="text-red-400 mt-1 break-words">{lastSimError}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ferramentas para debugar revert */}
      <details className="mt-3 rounded-lg border border-slate-700/50 bg-slate-900/30 text-xs text-slate-400">
        <summary className="cursor-pointer py-2 px-3 hover:text-slate-300">Ferramentas para debugar revert</summary>
        <ul className="list-disc list-inside py-2 px-3 space-y-1 text-slate-500">
          <li><a href="https://dashboard.tenderly.co/simulator" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Tenderly</a> — simule a tx e veja o motivo exato do revert</li>
          <li><a href="https://remix.ethereum.org" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Remix</a> — conecte na Arc Testnet e chame o Router (swapExactTokensForTokens) com os mesmos args</li>
          <li><a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">ArcScan</a> — confira allowance do USDC para o Router e reservas do par</li>
        </ul>
      </details>

      {/* Success Indicator */}
      {isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-green-400 text-sm"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Transação confirmada.</span>
        </motion.div>
      )}
    </div>
  )
}
