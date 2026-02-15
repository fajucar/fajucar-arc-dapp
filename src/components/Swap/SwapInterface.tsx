import { useState, useEffect } from 'react'
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract } from 'wagmi'
import { NetworkSwitchModal } from './NetworkSwitchModal'
import { parseUnits, formatUnits, maxUint256, decodeErrorResult, encodeFunctionData } from 'viem'
import { ArrowDownUp, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { ARCDEX } from '@/config/arcDex'
import { CONSTANTS } from '@/config/constants'
import { EURC_ALTERNATIVE, ZERO_ADDRESS } from '@/config/tokens'
import { ensureAllowance } from '@/lib/allowance'
import { assertAddress } from '@/lib/assertAddress'
import { buildSwapPath, quoteSwap, simulateSwap } from '@/lib/dex/swapUtils'

export type SwapDebugData = {
  chainId: number | null
  routerAddress: string
  factoryAddress: string
  routerFactoryOnChain: string | null
  tokenIn: string | null
  tokenOut: string | null
  pairAddress: string | null
  reserve0: string
  reserve1: string
  token0: string | null
  token1: string | null
  balanceUser: string
  allowanceUser: string
  amountIn: string | null
  amountOut: string | null
  amountOutMin: string | null
  blockTimestamp: string | null
  deadlineClient: string
  warning: string | null
}

/** Valores RAW (bigint como string) realmente enviados ao Router no último swap */
type LastSentSwapArgs = {
  amountInRaw: string
  amountOutMinRaw: string
  path: string[]
  to: string
  deadline: string
} | null

const ARC_TESTNET_CHAIN_ID = CONSTANTS.ARC_TESTNET_CHAIN_ID
const SLIPPAGE_DEFAULT = 1
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
    name: 'supportsPrecompileTokens',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
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

// Pair ABI mínimo (getReserves retorna 2 valores no Arc Testnet)
const PAIR_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_reserve0', type: 'uint112' },
      { name: '_reserve1', type: 'uint112' },
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
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId != null && chainId !== ARC_TESTNET_CHAIN_ID

  // Log na inicialização: Router oficial e Factory em uso (arcTestnet.ts → arcDex.ts)
  useEffect(() => {
    console.log('[ArcDEX] Router oficial em uso:', DEX_ROUTER_ADDRESS ?? '(não definido)')
    console.log('[ArcDEX] Factory:', CONFIG_FACTORY)
  }, [])

  // Abrir modal de troca de rede quando detectar rede incorreta
  useEffect(() => {
    if (isWrongChain && isConnected) {
      setShowNetworkModal(true)
    }
  }, [isWrongChain, isConnected])

  const [tokenFrom, setTokenFrom] = useState<Token>(TOKENS[0])
  const [tokenTo, setTokenTo] = useState<Token | null>(TOKENS[1])
  const [amountFrom, setAmountFrom] = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [slippage, setSlippage] = useState(SLIPPAGE_DEFAULT)
  const [balanceFrom, setBalanceFrom] = useState<bigint>(0n)
  const [lastWriteType, setLastWriteType] = useState<'approve' | 'swap' | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [lastSwapTxHash, setLastSwapTxHash] = useState<string | null>(null)
  const [debugData, setDebugData] = useState<SwapDebugData | null>(null)
  const [lastSimError, setLastSimError] = useState<string | null>(null)
  const [lastSimErrorDetail, setLastSimErrorDetail] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [lastSentSwapArgs, setLastSentSwapArgs] = useState<LastSentSwapArgs>(null)
  const [lastSwapDebug, setLastSwapDebug] = useState<{
    chainId: number
    router: string
    path: string[]
    amountIn: string
    amountOut: string
    minOut: string
    deadline: string
    allowance: string
    reserve0: string
    reserve1: string
  } | null>(null)
  const [testApproveHash, setTestApproveHash] = useState<`0x${string}` | null>(null)
  const [testApproveInProgress, setTestApproveInProgress] = useState(false)
  /** true = Router novo (TransferHelper), false = Router antigo (swap vai reverter), null = ainda não verificou */
  const [routerSupportsPrecompile, setRouterSupportsPrecompile] = useState<boolean | null>(null)
  const [showNetworkModal, setShowNetworkModal] = useState(false)

  const { writeContractAsync: writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Allowance USDC → Router (para seção "Test Approve USDC" e exibição em tempo real)
  const { data: usdcAllowance, refetch: refetchUsdcAllowance } = useReadContract({
    address: ARCDEX.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && DEX_ROUTER_ADDRESS ? [address, DEX_ROUTER_ADDRESS] : undefined,
  })
  const { isLoading: isTestApproveConfirming, isSuccess: isTestApproveSuccess } = useWaitForTransactionReceipt({
    hash: testApproveHash ?? undefined,
  })

  // Allowance do token From para o Router (reactivo; refetch após approve)
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: tokenFrom.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && DEX_ROUTER_ADDRESS ? [address, DEX_ROUTER_ADDRESS] : undefined,
  })

  // Precisa de approve se amountIn > 0 e allowance < amountIn (6 decimais para USDC/EURC)
  const amountInForApproval = safeParseUnits(amountFrom, tokenFrom.decimals)
  const needsApproval = Boolean(
    amountInForApproval != null &&
    amountInForApproval > 0n &&
    DEX_ROUTER_ADDRESS &&
    address &&
    (currentAllowance === undefined ? true : currentAllowance < amountInForApproval)
  )

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

  // Verificar se o Router suporta precompile tokens. Só na Arc Testnet.
  // 1) Se supportsPrecompileTokens() existe e retorna true → OK
  // 2) Se retorna false → Router antigo
  // 3) Se a função não existe (ex.: Router oficial SingleHop) → fallback: getAmountsOut(1, [USDC,EURC])
  //    Se getAmountsOut funciona → Router operacional (permite swap)
  //    Se falha → null (não bloqueia; o swap mostrará o erro real)
  useEffect(() => {
    if (!publicClient || !DEX_ROUTER_ADDRESS || chainId !== ARC_TESTNET_CHAIN_ID) {
      setRouterSupportsPrecompile(null)
      return
    }
    let cancelled = false
    const check = async () => {
      try {
        const supports = (await publicClient.readContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ARCDEX_ROUTER_ABI,
          functionName: 'supportsPrecompileTokens',
        })) as boolean
        if (!cancelled) setRouterSupportsPrecompile(supports === true)
        return
      } catch {
        // supportsPrecompileTokens não existe ou reverteu → fallback
      }
      // Fallback: Router oficial pode não ter supportsPrecompileTokens. Testar getAmountsOut.
      try {
        const path = [ARCDEX.usdc, ARCDEX.eurc] as readonly [`0x${string}`, `0x${string}`]
        const amounts = (await publicClient.readContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ARCDEX_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [1n, path],
        })) as bigint[]
        if (!cancelled && amounts?.length >= 2 && amounts[amounts.length - 1] !== undefined) {
          setRouterSupportsPrecompile(true)
        } else {
          if (!cancelled) setRouterSupportsPrecompile(null)
        }
      } catch {
        if (!cancelled) setRouterSupportsPrecompile(null)
      }
    }
    check()
    return () => { cancelled = true }
  }, [publicClient, DEX_ROUTER_ADDRESS, chainId])

  // Debug Panel: buscar router, factory, pair, reserves, balance, allowance, block, deadline
  useEffect(() => {
    if (!publicClient || !tokenFrom || !tokenTo) {
      setDebugData(null)
      return
    }
    let cancelled = false
    const run = async () => {
        const empty: SwapDebugData = {
          chainId: chainId ?? null,
          routerAddress: DEX_ROUTER_ADDRESS || '—',
          factoryAddress: CONFIG_FACTORY,
          routerFactoryOnChain: null,
          tokenIn: tokenFrom?.address ?? null,
          tokenOut: tokenTo?.address ?? null,
          pairAddress: null,
          reserve0: '0',
          reserve1: '0',
          token0: null,
          token1: null,
          balanceUser: '0',
          allowanceUser: '0',
          amountIn: null,
          amountOut: null,
          amountOutMin: null,
          blockTimestamp: null,
          deadlineClient: String(BigInt(Math.floor(Date.now() / 1000)) + 1200n),
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
              }) as Promise<[bigint, bigint]>,
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
              warning = 'Pool sem liquidez'
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
        const deadlineClient = String(BigInt(Math.floor(Date.now() / 1000)) + 1200n)
        
        // Calcular amountIn, amountOut, amountOutMin se houver amountFrom
        let amountInStr: string | null = null
        let amountOutStr: string | null = null
        let amountOutMinStr: string | null = null
        if (amountFrom && parseFloat(amountFrom) > 0 && tokenFrom && tokenTo) {
          const amountInRaw = safeParseUnits(amountFrom, tokenFrom.decimals)
          if (amountInRaw && amountInRaw > 0n) {
            amountInStr = amountInRaw.toString()
            try {
              const amounts = (await publicClient.readContract({
                address: DEX_ROUTER_ADDRESS,
                abi: ARCDEX_ROUTER_ABI,
                functionName: 'getAmountsOut',
                args: [amountInRaw, [tokenFrom.address, tokenTo.address]],
              })) as bigint[]
              if (amounts && amounts.length > 0) {
                amountOutStr = amounts[amounts.length - 1].toString()
                const slippageBps = BigInt(Math.round(slippage * 100))
                amountOutMinStr = ((amounts[amounts.length - 1] * (10000n - slippageBps)) / 10000n).toString()
              }
            } catch {
              // Ignorar erro de getAmountsOut
            }
          }
        }
        
        if (!cancelled) {
          setDebugData({
            chainId: chainId ?? null,
            routerAddress: DEX_ROUTER_ADDRESS,
            factoryAddress: CONFIG_FACTORY,
            routerFactoryOnChain: routerFactory,
            tokenIn: tokenFrom?.address ?? null,
            tokenOut: tokenTo?.address ?? null,
            pairAddress: pairAddr,
            reserve0,
            reserve1,
            token0: token0Addr,
            token1: token1Addr,
            balanceUser,
            allowanceUser,
            amountIn: amountInStr,
            amountOut: amountOutStr,
            amountOutMin: amountOutMinStr,
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
  }, [publicClient, address, tokenFrom, tokenTo, amountFrom, slippage, chainId])

  // Calcular amountOut quando amountFrom muda (preview). Só na Arc Testnet.
  useEffect(() => {
    if (!tokenTo) {
      setAmountTo('')
      return
    }

    const amountIn = safeParseUnits(amountFrom, tokenFrom.decimals)
    if (amountIn == null || amountIn <= 0n || !tokenFrom || !publicClient) {
      setAmountTo('')
      return
    }

    // Só calcular cotação quando conectado na Arc Testnet
    if (chainId != null && chainId !== ARC_TESTNET_CHAIN_ID) {
      setAmountTo('—')
      return
    }

    const timeoutId = setTimeout(() => {
      const calculateAmountOut = async () => {
        setIsCalculating(true)
        try {
          const isUsdcEurc =
            (tokenFrom.address.toLowerCase() === ARCDEX.usdc.toLowerCase() && tokenTo.address.toLowerCase() === ARCDEX.eurc.toLowerCase()) ||
            (tokenFrom.address.toLowerCase() === ARCDEX.eurc.toLowerCase() && tokenTo.address.toLowerCase() === ARCDEX.usdc.toLowerCase())

          if (!isUsdcEurc) {
            setAmountTo('0.0')
            setIsCalculating(false)
            return
          }

          const ZERO_PREVIEW = '0x0000000000000000000000000000000000000000' as `0x${string}`
          let pairAddress = (await publicClient.readContract({
            address: ARCDEX.factory,
            abi: FACTORY_ABI,
            functionName: 'getPair',
            args: [tokenFrom.address, tokenTo.address],
          })) as `0x${string}`
          if (!pairAddress || pairAddress === ZERO_PREVIEW) {
            if (tokenTo.symbol === 'EURC') {
              pairAddress = (await publicClient.readContract({
                address: ARCDEX.factory,
                abi: FACTORY_ABI,
                functionName: 'getPair',
                args: [tokenFrom.address, EURC_ALTERNATIVE],
              })) as `0x${string}`
            }
          }
          if (!pairAddress || pairAddress === ZERO_PREVIEW) {
            setAmountTo('0.0')
            setIsCalculating(false)
            return
          }
          const path = buildSwapPath(tokenFrom.address, tokenTo.address)

          // 1) Tentar getAmountsOut no Router primeiro ( fonte mais confiável )
          if (DEX_ROUTER_ADDRESS) {
            try {
              const amounts = (await publicClient.readContract({
                address: DEX_ROUTER_ADDRESS,
                abi: ARCDEX_ROUTER_ABI,
                functionName: 'getAmountsOut',
                args: [amountIn, path],
              })) as bigint[]
              const amountOut = amounts?.[amounts.length - 1]
              if (amountOut != null && amountOut > 0n) {
                setAmountTo(formatUnits(amountOut, tokenTo.decimals))
                setIsCalculating(false)
                return
              }
            } catch (getAmountsErr: any) {
              console.warn('[Preview] getAmountsOut falhou, usando reservas:', getAmountsErr?.shortMessage || getAmountsErr?.message)
            }
          }

          // 2) Fallback: fórmula com reservas do Pair
          const [reserves, token0Addr] = await Promise.all([
            publicClient.readContract({
              address: pairAddress,
              abi: PAIR_ABI,
              functionName: 'getReserves',
            }) as Promise<[bigint, bigint]>,
            publicClient.readContract({
              address: pairAddress,
              abi: PAIR_ABI,
              functionName: 'token0',
            }) as Promise<`0x${string}`>,
          ])

          const [reserve0, reserve1] = reserves
          if (reserve0 === 0n || reserve1 === 0n) {
            setAmountTo('0.0')
            console.warn('[Preview] Pool sem liquidez (reserve0=', reserve0.toString(), 'reserve1=', reserve1.toString(), ')')
            setIsCalculating(false)
            return
          }

          const fromIsToken0Local = tokenFrom.address.toLowerCase() === String(token0Addr).toLowerCase()
          const reserveIn = fromIsToken0Local ? reserve0 : reserve1
          const reserveOut = fromIsToken0Local ? reserve1 : reserve0
          const amountInWithFee = amountIn * 997n
          const numerator = amountInWithFee * reserveOut
          const denominator = reserveIn * 1000n + amountInWithFee
          const amountOut = numerator / denominator
          setAmountTo(formatUnits(amountOut, tokenTo.decimals))
        } catch (err: any) {
          console.error('[Preview] Erro ao calcular cotação:', err?.shortMessage || err?.message || err)
          setAmountTo('0.0')
        } finally {
          setIsCalculating(false)
        }
      }

      calculateAmountOut()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [amountFrom, tokenFrom, tokenTo, publicClient, chainId])

  const handleApprove = async () => {
    if (!isConnected || !address) {
      toast.error('Conecte a carteira primeiro.')
      return
    }
    if (isWrongChain && switchChain) {
      try {
        toast.loading('Trocando para a rede Arc...')
        await switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
        toast.dismiss()
        toast.success('Rede alterada. Clique em "Approve" novamente para aprovar.')
        return
      } catch (e) {
        toast.dismiss()
        toast.error('Troque manualmente para a rede Arc no MetaMask e tente de novo.')
        return
      }
    }
    if (!tokenFrom) {
      toast.error('Selecione o token From.')
      return
    }
    // Router sempre existe (vem do JSON)

    setLastWriteType('approve')
    const toastId = toast.loading('Abrindo carteira para assinar a aprovação...')
    try {
      await writeContract({
        address: tokenFrom.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [DEX_ROUTER_ADDRESS, maxUint256],
      })
      toast.dismiss(toastId)
      toast.loading('Aguardando confirmação do approve...', { id: 'approve-pending' })
    } catch (err: any) {
      toast.dismiss(toastId)
      setLastWriteType(null)
      const errorMsg = err?.message || err?.shortMessage || ''
      if (errorMsg.includes('rejected') || errorMsg.includes('denied') || errorMsg.includes('User denied')) {
        toast.error('Aprovação cancelada na carteira.')
      } else {
        toast.error(errorMsg || 'Falha na aprovação. Tente novamente.')
      }
    }
  }

  /** Teste isolado: approve USDC para o Router (maxUint256). Mostra hash e atualiza allowance. */
  const handleTestApproveUsdc = async () => {
    if (!address || !DEX_ROUTER_ADDRESS) {
      toast.error('Conecte a carteira e configure o Router.')
      return
    }
    setTestApproveInProgress(true)
    setTestApproveHash(null)
    try {
      const txHash = await writeContract({
        address: ARCDEX.usdc,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [DEX_ROUTER_ADDRESS, maxUint256],
      })
      setTestApproveHash(txHash)
      toast.success('Tx enviada. Aguardando confirmação...')
    } catch (err: any) {
      setTestApproveInProgress(false)
      const msg = err?.shortMessage ?? err?.message ?? ''
      if (msg.includes('rejected') || msg.includes('denied')) {
        toast.error('Approve cancelado na carteira.')
      } else {
        toast.error(msg || 'Falha no approve.')
      }
    }
  }

  const handleSwap = async () => {
    console.log('handleSwap called', {
      address,
      tokenFrom: tokenFrom?.symbol,
      tokenTo: tokenTo?.symbol,
      amountFrom,
      amountTo,
      router: DEX_ROUTER_ADDRESS,
      needsApproval,
      isLoading,
      isWrongChain,
    })

    // Validações básicas
    if (!isConnected || !address) {
      toast.error('Conecte a carteira primeiro.')
      return
    }
    if (isWrongChain && switchChain) {
      try {
        toast.loading('Trocando para a rede Arc...')
        await switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
        toast.dismiss()
        toast.success('Rede alterada. Clique em Swap novamente (a carteira abrirá para aprovar o token).')
        return
      } catch (e) {
        toast.dismiss()
        toast.error('Troque manualmente para a rede Arc no MetaMask e tente de novo.')
        return
      }
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

    // amountIn em RAW (bigint): parseUnits com decimais reais do token (USDC=6, EURC=6). NUNCA parseEther/18.
    const amountIn = safeParseUnits(amountFrom, tokenFrom.decimals)
    if (amountIn == null || amountIn <= 0n) {
      toast.error('Valor inválido.')
      return
    }

    if (!publicClient) {
      toast.error('Erro: publicClient não disponível.')
      return
    }

    // Approve para o Router (spender = router). Reutiliza ensureAllowance.
    if (needsApproval && DEX_ROUTER_ADDRESS) {
      setLastWriteType('approve')
      const approveToast = toast.loading(`Aprovar ${tokenFrom.symbol} para Router...`)
      try {
        await ensureAllowance(
          publicClient,
          (opts) => writeContract({ address: opts.address, abi: opts.abi, functionName: opts.functionName, args: opts.args }),
          tokenFrom.address,
          address,
          DEX_ROUTER_ADDRESS,
          amountIn
        )
        await refetchAllowance()
        toast.dismiss(approveToast)
        toast.success('Token aprovado. Executando swap...')
      } catch (approveErr: any) {
        toast.dismiss(approveToast)
        const msg = approveErr?.shortMessage ?? approveErr?.message ?? 'Falha na aprovação.'
        if (msg.includes('rejected') || msg.includes('denied')) {
          toast.error('Aprovação cancelada na carteira.')
        } else {
          toast.error(msg)
        }
        return
      }
    }

    // Validate addresses before use (defense against corrupted config/env)
    const routerCheck = assertAddress('router', DEX_ROUTER_ADDRESS)
    if (!routerCheck.ok) {
      toast.error(routerCheck.value)
      return
    }
    const factoryCheck = assertAddress('factory', CONFIG_FACTORY)
    if (!factoryCheck.ok) {
      toast.error(factoryCheck.value)
      return
    }
    if (
      DEX_ROUTER_ADDRESS.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
      CONFIG_FACTORY.toLowerCase() === ZERO_ADDRESS.toLowerCase()
    ) {
      toast.error(
        `Router ou Factory não configurado. Router: ${DEX_ROUTER_ADDRESS} (len ${DEX_ROUTER_ADDRESS.length}) | Factory: ${CONFIG_FACTORY} (len ${CONFIG_FACTORY.length}). Verifique .env e src/config/arcTestnet.ts`
      )
      return
    }

    // Swap flow — endereços em uso (router, factory, pair via factory.getPair)
    console.log('[Swap] Router address:', DEX_ROUTER_ADDRESS)
    console.log('[Swap] Factory address:', CONFIG_FACTORY)

    // Verificar mismatch Router/Factory: ler router.factory() e logar
    try {
      if (DEX_ROUTER_ADDRESS) {
        const ROUTER_FACTORY = (await publicClient.readContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ROUTER_FACTORY_ABI,
          functionName: 'factory',
        })) as `0x${string}`
        console.log('[Swap] Router.factory() on-chain:', ROUTER_FACTORY)
      }
    } catch (factoryErr) {
      console.warn('Erro ao ler router.factory():', factoryErr)
    }

    const ZERO = '0x0000000000000000000000000000000000000000' as `0x${string}`

    // 1) Resolver par com liquidez (tentar EURC alternativo se getPair retornar zero)
    toast.loading('Verificando liquidez...', { id: 'swap-pending' })
    let pairAddress: `0x${string}`
    let path: `0x${string}`[]
    let reserveIn: bigint
    let reserveOut: bigint
    let reservesForDebug = { reserve0: '0', reserve1: '0' }

    try {
      // Sempre obter pair via factory.getPair — sem fallback para endereço hardcoded
      pairAddress = (await publicClient.readContract({
        address: ARCDEX.factory,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenFrom.address, tokenTo.address],
      })) as `0x${string}`
      if (!pairAddress || pairAddress === ZERO) {
        if (tokenTo.symbol === 'EURC') {
          pairAddress = (await publicClient.readContract({
            address: ARCDEX.factory,
            abi: FACTORY_ABI,
            functionName: 'getPair',
            args: [tokenFrom.address, EURC_ALTERNATIVE],
          })) as `0x${string}`
        }
      }

      console.log('[Swap] Pair returned by factory:', pairAddress)

      if (!pairAddress || pairAddress === ZERO) {
        toast.dismiss('swap-pending')
        toast.error('Par não encontrado. Crie o par na Factory ou acesse Pools para adicionar liquidez.')
        return
      }

      const [reserves, token0Addr, token1Addr] = await Promise.all([
        publicClient.readContract({
          address: pairAddress,
          abi: PAIR_ABI,
          functionName: 'getReserves',
        }) as Promise<[bigint, bigint]>,
        publicClient.readContract({
          address: pairAddress,
          abi: PAIR_ABI,
          functionName: 'token0',
        }) as Promise<`0x${string}`>,
        publicClient.readContract({
          address: pairAddress,
          abi: PAIR_ABI,
          functionName: 'token1',
        }) as Promise<`0x${string}`>,
      ])

      if (reserves[0] === 0n || reserves[1] === 0n) {
        toast.dismiss('swap-pending')
        toast.error('Pool sem liquidez. Adicione liquidez em Pools e tente de novo.')
        return
      }

      const fromIsToken0 = tokenFrom.address.toLowerCase() === token0Addr.toLowerCase()
      reserveIn = fromIsToken0 ? reserves[0] : reserves[1]
      reserveOut = fromIsToken0 ? reserves[1] : reserves[0]
      reservesForDebug = { reserve0: reserves[0].toString(), reserve1: reserves[1].toString() }
      // Path: Address[] real, nunca string — buildSwapPath garante tipo correto
      path = [...buildSwapPath(tokenFrom.address, tokenTo.address)]
      console.log('[Swap] path do par:', { 
        path, 
        pairAddress, 
        token0: token0Addr,
        token1: token1Addr,
        tokenFrom: tokenFrom.address,
        tokenTo: tokenTo.address,
        fromIsToken0,
        reserve0: reserves[0].toString(), 
        reserve1: reserves[1].toString() 
      })

      // Verificar Router on-chain: factory() (verificação crítica)
      let routerFactory: `0x${string}`
      let routerHasTransferHelper: boolean | null = null
      try {
        routerFactory = (await publicClient.readContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ARCDEX_ROUTER_ABI,
          functionName: 'factory',
        })) as `0x${string}`
        
        // Verificar se Router tem TransferHelper (opcional - não bloqueia se não existir)
        // Se a função não existir, assumimos que o Router pode estar correto (confiamos no JSON config)
        try {
          const supports = (await publicClient.readContract({
            address: DEX_ROUTER_ADDRESS,
            abi: ARCDEX_ROUTER_ABI,
            functionName: 'supportsPrecompileTokens',
          })) as boolean
          routerHasTransferHelper = supports === true
          console.log('[Swap] Router supportsPrecompileTokens():', routerHasTransferHelper)
        } catch (supportsErr: any) {
          // Função não existe ou erro ao chamar - não bloquear, apenas logar
          console.warn('[Swap] supportsPrecompileTokens() não disponível ou erro:', supportsErr?.message || supportsErr)
          routerHasTransferHelper = null // null = não verificado (não sabemos)
        }
      } catch (e: any) {
        toast.dismiss('swap-pending')
        const errMsg = e?.shortMessage || e?.message || String(e)
        console.error('[Swap] Erro ao ler router.factory():', e)
        toast.error('Router inválido ou rede errada: ' + (errMsg.slice(0, 80) || 'verifique src/config/arcTestnet.ts'))
        return
      }
      
      if (routerFactory.toLowerCase() !== CONFIG_FACTORY.toLowerCase()) {
        toast.dismiss('swap-pending')
        toast.error('Router usa outra Factory. Esperado: ' + CONFIG_FACTORY.slice(0, 10) + '... Atual: ' + String(routerFactory).slice(0, 10) + '...')
        return
      }
      
      // Se routerHasTransferHelper === false (explicitamente false, não null), avisar mas não bloquear
      // O Router está correto no JSON config, então confiamos nele
      if (routerHasTransferHelper === false) {
        console.warn('[Swap] Router pode não ter TransferHelper, mas está correto no config. Continuando...')
      }
      
      console.log('[Swap] Router verificado:', {
        address: DEX_ROUTER_ADDRESS,
        factory: routerFactory,
        hasTransferHelper: routerHasTransferHelper === null ? 'não verificado' : routerHasTransferHelper,
      })

      // pairFor no Router pode reverter em algumas implementações; como router.factory() já bate com a config, seguimos para getAmountsOut/swap
      try {
        const routerPair = (await publicClient.readContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ARCDEX_ROUTER_ABI,
          functionName: 'pairFor',
          args: [path[0], path[1]],
        })) as `0x${string}`
        if (routerPair.toLowerCase() !== pairAddress.toLowerCase()) {
          console.warn('[Swap] Router.pairFor difere do par da Factory; continuando mesmo assim.', { routerPair, pairAddress })
        }
      } catch (_) {
        // pairFor reverteu (ex.: Router exige par existente); não bloquear — getAmountsOut/swap validarão
        console.warn('[Swap] router.pairFor reverteu; seguindo com path da Factory.')
      }
    } catch (pairErr: any) {
      toast.dismiss('swap-pending')
      const msg = pairErr?.shortMessage || pairErr?.message || String(pairErr)
      console.error('[Swap] Erro ao verificar par/reservas:', pairErr)
      const userMsg = msg.length > 100 ? msg.slice(0, 100) + '...' : msg
      toast.error(userMsg || 'Falha ao ler par ou reservas. Confira Factory e rede.')
      return
    }

    // Quote via getAmountsOut (1% slippage default). Fallback para fórmula com reservas se Router falhar.
    let amountOut: bigint
    let amountOutMin: bigint
    try {
      const quote = await quoteSwap(
        publicClient,
        DEX_ROUTER_ADDRESS,
        amountIn,
        [path[0], path[1]],
        slippage
      )
      amountOut = quote.amountOut
      amountOutMin = quote.amountOutMin
      console.log('[Swap] quoteSwap:', { amountOut: amountOut.toString(), amountOutMin: amountOutMin.toString(), slippagePercent: slippage })
    } catch (quoteErr: any) {
      console.warn('[Swap] quoteSwap/getAmountsOut reverteu; usando cotação pelas reservas.', quoteErr)
      const amountInWithFee = amountIn * 997n
      const numerator = amountInWithFee * reserveOut
      const denominator = reserveIn * 1000n + amountInWithFee
      amountOut = numerator / denominator
      if (amountOut === 0n) {
        toast.dismiss('swap-pending')
        toast.error('Não foi possível calcular valor de saída. Tente um valor menor.')
        return
      }
      // 1% slippage: amountOut * 99 / 100
      amountOutMin = (amountOut * 99n) / 100n
      console.log('[Swap] fallback formula:', { amountOut: amountOut.toString(), amountOutMin: amountOutMin.toString() })
    }

    try {

      // deadline = 20 min a partir do timestamp do bloco (mais confiável que Date.now em testnets com skew)
      let blockTimestamp: bigint
      try {
        const block = await publicClient.getBlock({ blockTag: 'latest' })
        blockTimestamp = block.timestamp
      } catch {
        blockTimestamp = BigInt(Math.floor(Date.now() / 1000))
      }
      const deadline = blockTimestamp + 1200n

      console.log('Preparando swap:', {
        deadline: deadline.toString(),
        blockTimestamp: blockTimestamp.toString(),
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        path,
      })

      // Router.factory() já foi verificado (igual à config). Se pairFor retornar 0 mas a Factory tem o par, pode ser bug de view/RPC — seguimos para simulação e ela valida.
      let routerPair: `0x${string}` | null = null
      try {
        routerPair = (await publicClient.readContract({
          address: DEX_ROUTER_ADDRESS,
          abi: ARCDEX_ROUTER_ABI,
          functionName: 'pairFor',
          args: [path[0], path[1]],
        })) as `0x${string}`
      } catch (e) {
        console.warn('[Swap] router.pairFor reverteu:', e)
      }
      if (routerPair && routerPair !== ZERO && routerPair.toLowerCase() !== pairAddress.toLowerCase()) {
        toast.dismiss('swap-pending')
        const msg = 'Router enxerga outro par que a Factory. O swap vai reverter. Redeploy o Router com Factory ' + CONFIG_FACTORY.slice(0, 10) + '... (docs/DEX_DEPLOYMENT.md).'
        setLastSimError(msg)
        setLastSimErrorDetail(`Router.pairFor = ${routerPair} | Factory.getPair par = ${pairAddress}`)
        toast.error(msg, { duration: 15000 })
        return
      }
      if (!routerPair || routerPair === ZERO) {
        console.warn('[Swap] router.pairFor retornou 0; router.factory() já bate com config e a Factory tem o par. Seguindo para simulação — ela validará se o swap é possível.')
      }

      // Simular ANTES de enviar: capturar revert reason e exibir no toast / Debug Panel
      setLastSimError(null)
      setLastSimErrorDetail(null)
      toast.loading('Simulando transação...', { id: 'swap-pending' })
      
      // Verificar allowance antes da simulação
      let currentAllowanceCheck: bigint | null = null
      try {
        currentAllowanceCheck = (await publicClient.readContract({
          address: tokenFrom.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, DEX_ROUTER_ADDRESS],
        })) as bigint
        console.log('[Swap] Allowance verificado:', {
          allowance: currentAllowanceCheck.toString(),
          amountIn: amountIn.toString(),
          suficiente: currentAllowanceCheck >= amountIn,
        })
        if (currentAllowanceCheck < amountIn) {
          toast.dismiss('swap-pending')
          toast.error(`Approve insuficiente. Allowance: ${formatUnits(currentAllowanceCheck, tokenFrom.decimals)} ${tokenFrom.symbol}, necessário: ${amountFrom} ${tokenFrom.symbol}. Clique em "Approve USDC" primeiro.`)
          return
        }
      } catch (allowanceErr: any) {
        console.warn('[Swap] Erro ao verificar allowance:', allowanceErr)
        toast.dismiss('swap-pending')
        toast.error('Erro ao verificar approve. Tente novamente.')
        return
      }
      
      // Log/Debug: chainId, router, path, amountIn, amountOut, minOut, deadline, allowance, reserves
      const debugPayload = {
        chainId: chainId ?? 0,
        router: DEX_ROUTER_ADDRESS,
        path: path.map((p) => String(p)),
        amountIn: amountIn.toString(),
        amountOut: amountOut.toString(),
        minOut: amountOutMin.toString(),
        deadline: deadline.toString(),
        allowance: currentAllowanceCheck?.toString() ?? 'N/A',
        reserve0: reservesForDebug.reserve0,
        reserve1: reservesForDebug.reserve1,
      }
      setLastSwapDebug({
        chainId: debugPayload.chainId,
        router: debugPayload.router,
        path: debugPayload.path,
        amountIn: debugPayload.amountIn,
        amountOut: debugPayload.amountOut,
        minOut: debugPayload.minOut,
        deadline: debugPayload.deadline,
        allowance: debugPayload.allowance,
        reserve0: debugPayload.reserve0,
        reserve1: debugPayload.reserve1,
      })
      console.log('[Swap] === DEBUG (quote/simulate) ===', debugPayload)
      
      try {
        await simulateSwap(
          publicClient,
          DEX_ROUTER_ADDRESS,
          address,
          amountIn,
          amountOutMin,
          [path[0], path[1]],
          deadline
        )
        console.log('[Swap] Simulação passou!')
      } catch (simErr: any) {
        toast.dismiss('swap-pending')

        // Erro completo: objeto inteiro para diagnóstico (F12)
        console.error('[Swap] === ERRO COMPLETO simulateContract ===')
        console.error('Objeto erro:', simErr)
        try {
          console.error('Erro JSON (keys):', Object.keys(simErr || {}))
          console.error('message:', simErr?.message)
          console.error('shortMessage:', simErr?.shortMessage)
          console.error('name:', simErr?.name)
          console.error('data:', simErr?.data)
          console.error('details:', simErr?.details)
        } catch (_) {}

        if (simErr?.cause) {
          console.error('ERRO simulateContract — cause:', simErr.cause)
          try {
            console.error('cause.data:', (simErr.cause as any)?.data)
            console.error('cause.message:', (simErr.cause as any)?.message)
          } catch (_) {}
        }

        // Detalhe bruto para mostrar na tela (não depende do F12)
        let errDetail = [
          simErr?.shortMessage || simErr?.message,
          simErr?.details ? `Detalhes: ${simErr.details}` : '',
          (simErr?.data || simErr?.cause?.data) ? `Data: ${String(simErr?.data || simErr?.cause?.data).slice(0, 66)}...` : '',
        ].filter(Boolean).join(' | ')

        // Tentar obter causa raiz usando walk() do viem
        let rootCause = simErr
        if (simErr?.walk) {
          try {
            rootCause = simErr.walk()
            const walkMsg = rootCause?.shortMessage || rootCause?.message
            if (walkMsg) errDetail = errDetail ? `${errDetail} | Causa: ${walkMsg}` : `Causa: ${walkMsg}`
          } catch {
            // Ignorar se walk() falhar
          }
        }
        console.error('Causa raiz (swap):', rootCause?.shortMessage || rootCause?.message || errDetail, rootCause)

        // Coletar data de erro da cadeia (Arc RPC pode aninhar em cause.cause, error.data, etc.)
        const getRevertData = (e: any): string | undefined => {
          if (!e) return undefined
          const sources = [
            e?.data,
            e?.cause?.data,
            (e?.cause as any)?.cause?.data,
            (e?.cause as any)?.error?.data,
            e?.error?.data,
            (e?.cause as any)?.value?.data,
            (e?.cause as any)?.response?.error?.data,
          ]
          for (const d of sources) {
            if (d && typeof d === 'string' && d.startsWith('0x') && d.length >= 10) return d
          }
          const msg = String(e?.message ?? e?.shortMessage ?? e?.cause?.message ?? '')
          const hexMatch = msg.match(/0x[a-fA-F0-9]{8,}/)
          if (hexMatch) return hexMatch[0]
          return undefined
        }
        let errorData = getRevertData(simErr) ?? getRevertData(rootCause) ?? getRevertData((rootCause as any)?.cause) ?? getRevertData((simErr?.cause as any)?.cause)
        // Fallback: se não temos payload, fazer eth_call explícito para capturar o revert data (alguns RPCs não devolvem no simulateContract)
        if (!errorData && publicClient && address && DEX_ROUTER_ADDRESS) {
          try {
            const calldata = encodeFunctionData({
              abi: ARCDEX_ROUTER_ABI,
              functionName: 'swapExactTokensForTokens',
              args: [amountIn, amountOutMin, path, address, deadline],
            })
            await publicClient.call({
              to: DEX_ROUTER_ADDRESS,
              data: calldata,
              account: address,
            })
          } catch (callErr: any) {
            const callData = getRevertData(callErr) ?? (callErr?.data ?? callErr?.cause?.data ?? (callErr?.cause as any)?.data)
            if (callData && typeof callData === 'string' && callData.startsWith('0x')) {
              errorData = callData
              console.log('[Swap] Revert data obtido via eth_call:', callData.slice(0, 74) + '...')
            }
          }
        }
        if (!errorData) {
          console.warn('[Swap] Revert sem data (simulação). Objeto de erro:', { simErrData: simErr?.data, causeData: simErr?.cause?.data, rootData: (rootCause as any)?.data })
          console.warn('[Swap] Estrutura completa do erro (para debug):', JSON.stringify({
            name: simErr?.name,
            message: simErr?.message,
            causeKeys: simErr?.cause ? Object.keys(simErr.cause) : [],
          }, null, 2))
        } else {
          console.log('[Swap] Raw revert data (hex):', errorData.slice(0, 10) + '...' + errorData.slice(-20))
        }
        let decodedError: string | null = null
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
            console.error('[Swap] === REVERT REASON (contrato) ===', decodedError)
          } catch {
            // Ignorar se decodificação falhar
          }
        }
        // Detalhe técnico: incluir erro decodificado para o usuário ver na caixa vermelha
        const detailWithDecoded = decodedError
          ? `${decodedError}${errDetail ? ` | ${errDetail}` : ''}`
          : errDetail
        setLastSimErrorDetail(detailWithDecoded || null)

        // Mensagem para toast (prioridade: decodificado > causa raiz > erro original)
        let toastMsg = decodedError ||
                       rootCause?.shortMessage ||
                       rootCause?.message ||
                       simErr?.shortMessage ||
                       simErr?.message ||
                       'Erro na simulação'

        // Mensagens específicas por tipo de revert do contrato
        if (decodedError && /ArcDEX:\s*TRANSFER_FROM_FAILED|TRANSFER_FROM_FAILED|TRANSFER_FAILED/i.test(decodedError)) {
          toastMsg = 'Router on-chain sem TransferHelper (bytecode antigo). Redeploy com docs/ArcDEXRouter_Remix.sol e atualize o router em arcTestnet.ts.'
        } else if (decodedError && /ArcDEX:\s*PAIR_NOT_EXIST|PAIR_NOT_EXIST/i.test(decodedError)) {
          toastMsg = 'Par não encontrado na Factory. O Router usa Factory.getPair(). Confira se o par existe em Pools.'
        } else if (decodedError && /ArcDEX:\s*INSUFFICIENT_OUTPUT_AMOUNT/i.test(decodedError)) {
          toastMsg = 'Slippage: valor mínimo de saída não atingido. Aumente a tolerância de slippage ou reduza o valor e tente de novo.'
        } else if (decodedError && /ArcDEX:\s*EXPIRED/i.test(decodedError)) {
          toastMsg = 'Deadline expirado. Clique em Swap novamente.'
        }

        if (simErr?.details) {
          toastMsg += ` | Detalhes: ${simErr.details}`
        }
        const causeMsg = rootCause?.message || simErr?.cause?.message
        if (causeMsg && causeMsg !== toastMsg && !toastMsg.includes(causeMsg)) {
          toastMsg += ` | Causa: ${causeMsg}`
        }

        // Se ainda for apenas "reverted" genérico (e não decodificamos nada), diagnosticar sem assumir transferFrom
        if (toastMsg.toLowerCase().includes('reverted') && !toastMsg.match(/ArcDEX:|EXPIRED|INSUFFICIENT|TRANSFER|INVALID|Panic|Router on-chain|Slippage|Deadline|Redeploy|PAIR_NOT/i)) {
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
              // Allowance OK mas revert genérico: não assumir transferFrom; sugerir slippage e reservas
              try {
                await publicClient.readContract({
                  address: DEX_ROUTER_ADDRESS,
                  abi: ARCDEX_ROUTER_ABI,
                  functionName: 'getAmountsOut',
                  args: [amountIn, path],
                })
                // getAmountsOut passou; o revert é no swap em si (transfer ou pair). Mensagem neutra + dicas.
                toastMsg = 'Revert na simulação (motivo não decodificado). Tente: 1) Redeploy do Router com docs/ArcDEXRouter_Remix.sol e atualize arcTestnet.ts 2) Aumentar slippage para 2% 3) Conferir reservas no Debug Panel.'
                refetchAllowance()
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
                  toastMsg = `Router: ${decodedRouterMsg}`
                } else if (toastMsg.toLowerCase().includes('reverted') || toastMsg.length < 20) {
                  toastMsg = `Simulação falhou (swap revertido). Veja o "Detalhe técnico" na caixa vermelha abaixo. Possíveis causas: par sem liquidez, slippage alto ou approve insuficiente.`
                }
              }
            }
          } catch {
            toastMsg = 'Transação revertida. Veja o detalhe técnico na caixa vermelha abaixo ou use Tenderly/Remix para debugar on-chain.'
          }
        }
        
        setLastSimError(toastMsg)
        toast.error(toastMsg, { duration: 12000 })
        return
      }

      // Simulação passou: chamar a carteira para executar o swap
      setLastWriteType('swap')
      setLastSentSwapArgs({
        amountInRaw: amountIn.toString(),
        amountOutMinRaw: amountOutMin.toString(),
        path: path as string[],
        to: address,
        deadline: deadline.toString(),
      })
      toast.loading('Abrindo carteira para confirmar o swap...', { id: 'swap-pending' })
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
        setLastWriteType(null)
        // Log no console para F12
        console.error('ERRO writeContract (swap):', writeErr?.shortMessage || writeErr?.message, writeErr)
        if (writeErr?.cause) {
          console.error('ERRO writeContract — cause:', writeErr.cause)
        }

        // Tentar obter causa raiz usando walk() do viem
        let rootCause = writeErr
        if (writeErr?.walk) {
          try {
            rootCause = writeErr.walk()
            console.error('Causa raiz (write swap):', rootCause?.shortMessage || rootCause?.message, rootCause)
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
        
        // Se ainda for apenas "reverted" genérico, simular de novo para obter o motivo exato do contrato
        let decodedDetail = rootCause?.shortMessage || rootCause?.message || writeErr?.shortMessage || writeErr?.message || ''
        if (publicClient && toastMsg.toLowerCase().includes('reverted') && !toastMsg.match(/ArcDEX:|EXPIRED|INSUFFICIENT|TRANSFER|INVALID|Panic/i)) {
          try {
            await publicClient.simulateContract({
              address: DEX_ROUTER_ADDRESS,
              abi: ARCDEX_ROUTER_ABI,
              functionName: 'swapExactTokensForTokens',
              args: [amountIn, amountOutMin, path, address, deadline],
              account: address ?? undefined,
            })
          } catch (simErr: any) {
            const errData = simErr?.data ?? simErr?.cause?.data
            if (errData && typeof errData === 'string' && errData.startsWith('0x')) {
              try {
                const decoded = decodeErrorResult({
                  abi: ROUTER_ERROR_ABI,
                  data: errData as `0x${string}`,
                })
                let decodedMsg = ''
                if (decoded.errorName === 'Error' && decoded.args?.[0]) {
                  decodedMsg = String(decoded.args[0])
                } else if (decoded.errorName === 'Panic' && decoded.args?.[0] !== undefined) {
                  decodedMsg = `Panic(${decoded.args[0]}) — overflow ou par sem liquidez`
                } else {
                  decodedMsg = decoded.errorName || ''
                }
                if (decodedMsg) {
                  decodedDetail = decodedMsg
                  toastMsg = decodedMsg
                  if (/ArcDEX:\s*TRANSFER_FAILED|TRANSFER_FAILED/i.test(decodedMsg)) {
                    toastMsg = 'Falha no transferFrom (token não transferido para o par). Aprove o token para ESTE Router e tente de novo.'
                    refetchAllowance()
                  } else if (/INSUFFICIENT_OUTPUT_AMOUNT|INSUFFICIENT_OUTPUT/i.test(decodedMsg)) {
                    toastMsg = 'Slippage: valor mínimo de saída não atingido. Aumente a tolerância de slippage e tente de novo.'
                  } else if (/EXPIRED/i.test(decodedMsg)) {
                    toastMsg = 'Deadline expirado. Clique em Swap novamente.'
                  }
                }
              } catch { /* ignorar decodificação */ }
            }
          }
        }

        // Se ainda genérico, adicionar dicas
        if (toastMsg.toLowerCase().includes('reverted') && !toastMsg.match(/ArcDEX:|EXPIRED|INSUFFICIENT|TRANSFER|INVALID|Panic|Slippage|Deadline|Aprove|approve/i)) {
          toastMsg = `Transação revertida. ${toastMsg.length < 60 ? toastMsg + ' — Verifique: 1) Token aprovado para o Router atual? 2) Slippage 3) Liquidez no par.' : toastMsg}`
        }

        setLastSimError(toastMsg)
        setLastSimErrorDetail(decodedDetail || '')
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
            const explorerUrl = `${ARCDEX.explorer}/tx/${txHash}`
            toast.success(
              () => (
                <span>
                  Swap confirmado na blockchain!{' '}
                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    Ver no {ARCDEX.explorerName}
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

            const explorerUrl = `${ARCDEX.explorer}/tx/${txHash}`
            setLastSimError(`Swap revertido na blockchain: ${revertReason}`)
            setLastSimErrorDetail(`Tx hash: ${txHash}. Veja o motivo no Explorer: ${explorerUrl}`)
            toast.error(`Swap falhou: ${revertReason}. Ver detalhes no Explorer.`, { duration: 12000 })
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

  // Após confirmar "Test Approve USDC": atualizar allowance exibido
  useEffect(() => {
    if (!isTestApproveSuccess || !testApproveHash) return
    refetchUsdcAllowance()
    setTestApproveInProgress(false)
    setTestApproveHash(null)
  }, [isTestApproveSuccess, testApproveHash, refetchUsdcAllowance])

  // Feedback ao confirmar approve ou swap
  useEffect(() => {
    if (!isSuccess) return
    const type = lastWriteType
    setLastWriteType(null)
    toast.dismiss('approve-pending')

    if (type === 'approve') {
      refetchAllowance()
      toast.success('✅ Approve confirmado! Agora clique em "2. Swap".')
    } else if (type === 'swap') {
      toast.success('✅ Swap executado com sucesso!')
      setAmountFrom('')
      setAmountTo('')
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
    } else {
      toast.success('Transação confirmada!')
      setAmountFrom('')
      setAmountTo('')
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
  }, [isSuccess, lastWriteType, refetchAllowance, address, publicClient, tokenFrom])

  if (!isConnected) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">Please connect your wallet to swap tokens</p>
      </div>
    )
  }

  const isLoading = isPending || isConfirming
  const minReceived = amountTo && tokenTo && parseFloat(amountTo) > 0
    ? (parseFloat(amountTo) * (1 - slippage / 100)).toFixed(6)
    : null
  // Botão Swap habilitado quando: rede correta, valores válidos, não está carregando
  const poolSemLiquidez = debugData?.warning === 'Pool sem liquidez'
  const canSwap = !isWrongChain && routerSupportsPrecompile !== false && !poolSemLiquidez && amountFrom && amountTo && parseFloat(amountFrom) > 0 && parseFloat(amountTo) > 0 && !isLoading
  const isApproveLoading = (isPending || isConfirming) && lastWriteType === 'approve'
  const isSwapLoading = (isPending || isConfirming) && lastWriteType === 'swap'

  // TEMP DEBUG: remove after validation — addresses in use (same source as swap)
  const fmt = (addr: string) =>
    addr.toLowerCase() === ZERO_ADDRESS.toLowerCase()
      ? 'ZERO (not configured)'
      : `${addr} (len ${addr.length})`
  const debugFactory = fmt(ARCDEX.factory)
  const debugRouter = fmt(ARCDEX.router)
  const debugPair = fmt(ARCDEX.pair)

  return (
    <div className="space-y-4">
      {/* TEMP DEBUG: addresses in use — remove after validation */}
      <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-[10px] font-mono text-slate-400 space-y-1">
        <div className="text-slate-500 font-semibold mb-1">Config addresses (arcTestnet)</div>
        <div>Factory: {debugFactory}</div>
        <div>Router:  {debugRouter}</div>
        <div>Pair:    {debugPair}</div>
      </div>

      {/* Rede errada: aviso + modal de troca/adicionar rede */}
      {isWrongChain && (
        <>
          <NetworkSwitchModal
            isOpen={showNetworkModal}
            onClose={() => setShowNetworkModal(false)}
          />
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-red-200/90">
              <span className="font-medium">Rede incorreta.</span>
              {' '}Conecte na <strong>Arc Testnet</strong> (Chain ID 5042002) para usar o Swap.
            </div>
            <button
              type="button"
              onClick={() => setShowNetworkModal(true)}
              className="shrink-0 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
            >
              Trocar rede
            </button>
          </div>
        </>
      )}

      {/* Pool sem liquidez: bloquear swap */}
      {!isWrongChain && poolSemLiquidez && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90">
            <span className="font-medium">Pool sem liquidez.</span>
            {' '}Adicione liquidez em Pools e tente de novo.
          </div>
        </div>
      )}

      {/* Router antigo: swap vai reverter — bloquear uso até atualizar config */}
      {!isWrongChain && routerSupportsPrecompile === false && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/15 p-4 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-200 text-sm">Router na versão antiga</p>
              <p className="text-xs text-amber-200/90 mt-1">
                O contrato no endereço configurado retornou <code className="bg-slate-800 px-1 rounded">supportsPrecompileTokens() = false</code>. O swap com USDC (precompile) pode reverter.
              </p>
              <p className="text-xs text-slate-300 mt-1 font-mono break-all">
                Router em uso: <span className="text-cyan-300">{DEX_ROUTER_ADDRESS}</span>
              </p>
              <p className="text-xs text-amber-200/90 mt-2">
                Se esse já é o endereço que você deployou com <code className="bg-slate-800 px-1 rounded">docs/ArcDEXRouter_Remix.sol</code>, confira no Remix (aba &quot;Read&quot;) ou no block explorer: o contrato nesse endereço deve ter a função <code className="bg-slate-800 px-1 rounded">supportsPrecompileTokens()</code> e retornar <strong>true</strong>. Se não existir ou retornar false, o deploy foi feito com a versão antiga do contrato — faça um novo deploy com o arquivo completo do Remix.
              </p>
              <p className="text-xs text-amber-200/90 mt-2 font-medium">O que fazer:</p>
              <ol className="text-xs text-amber-200/90 list-decimal list-inside mt-1 space-y-1">
                <li>Deploy do Router com <code className="bg-slate-800 px-1 rounded">docs/ArcDEXRouter_Remix.sol</code> no Remix (Factory: <code className="bg-slate-800 px-1 rounded">{CONFIG_FACTORY}</code>).</li>
                <li>Atualize <code className="bg-slate-800 px-1 rounded">src/config/arcTestnet.ts</code> → <code className="bg-slate-800 px-1 rounded">addresses.router</code> com o endereço do novo contrato.</li>
                <li>Recarregue a página e aprove USDC para o novo Router; depois tente o swap.</li>
              </ol>
              <p className="text-xs text-slate-400 mt-2">Detalhes: <code className="bg-slate-800 px-1 rounded">docs/O_QUE_ESTAVA_FALTANDO_SWAP.md</code></p>
            </div>
          </div>
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
          <label className="text-xs text-slate-400">Slippage tolerance (default 1%)</label>
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
      </div>

      {/* Um único botão Swap: aprova automaticamente se necessário e em seguida faz o swap */}
      {isWrongChain ? (
        <motion.button
          type="button"
          onClick={() => setShowNetworkModal(true)}
          className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-4 font-semibold transition-colors"
        >
          Conecte na Arc Testnet
        </motion.button>
      ) : (
        <motion.button
          type="button"
          onClick={handleSwap}
          disabled={!canSwap || isLoading}
          className="w-full rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white py-3 px-4 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          title={routerSupportsPrecompile === false ? 'Atualize o Router no config (veja o aviso acima)' : !canSwap ? 'Preencha From/To e valor' : needsApproval ? 'Clique para aprovar e fazer swap' : 'Clique para fazer swap'}
        >
          {(isSwapLoading || isApproveLoading) ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isPending ? 'Aguardando assinatura...' : isApproveLoading ? 'Confirmando aprovação...' : 'Executando swap...'}</span>
            </>
          ) : (
            <span>{needsApproval ? `Aprovar e Swap (${tokenFrom.symbol})` : 'Swap'}</span>
          )}
        </motion.button>
      )}

      {!needsApproval && amountFrom && parseFloat(amountFrom) > 0 && currentAllowance !== undefined && currentAllowance >= (amountInForApproval ?? 0n) && (
        <div className="text-xs text-emerald-400/90 flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            Token aprovado para o Router atual. Clique em Swap para trocar.
          </div>
          {DEX_ROUTER_ADDRESS && (
            <span className="text-slate-500 font-mono text-[10px]">Router: {DEX_ROUTER_ADDRESS.slice(0, 10)}...{DEX_ROUTER_ADDRESS.slice(-6)}</span>
          )}
        </div>
      )}

      {/* Último erro da simulação — visível na tela (não precisa abrir F12) */}
      {lastSimError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Último erro (simulação ou swap)
          </div>
          <div className="text-red-200/90 break-words text-xs">{lastSimError}</div>
          {lastSimErrorDetail && (
            <div className="mt-2 pt-2 border-t border-red-500/30">
              <span className="text-slate-400 text-xs">Detalhe técnico (pode copiar e colar para análise):</span>
              <div className="text-amber-200/90 text-xs break-all mt-1 font-mono">{lastSimErrorDetail}</div>
            </div>
          )}
          {/* Mostrar Approve só quando o erro for explicitamente sobre allowance (não na lista "approve em outro endereço") */}
          {lastSimError && /Aprove o token|Clique em.*Approve|allowance.*Router|approve para este Router/i.test(lastSimError) ? (
            <div className="mt-2 space-y-2">
              <p className="text-cyan-300/90 text-xs font-medium">Falta de <strong>approve</strong> do token &quot;From&quot; para o Router. Aprove e tente o Swap de novo:</p>
              <button
                type="button"
                onClick={handleApprove}
                disabled={!address || !DEX_ROUTER_ADDRESS || !tokenFrom || isLoading}
                className="rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2"
              >
                Approve {tokenFrom?.symbol ?? 'token From'}
              </button>
            </div>
          ) : lastSimError && /Router on-chain sem TransferHelper|bytecode antigo|novo deploy/i.test(lastSimError) ? (
            <div className="mt-2 space-y-2 text-xs">
              <p className="text-amber-200/90 font-medium">O contrato no endereço do Router foi deployado com código antigo (sem TransferHelper).</p>
              <p className="text-slate-400">Faça um novo deploy usando <code className="text-cyan-400">docs/ArcDEXRouter_Remix.sol</code> no Remix (Factory = <code className="text-cyan-400">{CONFIG_FACTORY}</code>), copie o novo endereço do Router e atualize <code className="text-cyan-400">src/config/arcTestnet.ts</code> → <code className="text-cyan-400">addresses.router</code>.</p>
            </div>
          ) : (
            <>
              <p className="text-slate-400 text-xs mt-2">Se o token já está aprovado, o revert pode ser do Router/Factory on-chain. Abra &quot;Debug Panel (Swap)&quot; abaixo para router, pair e reserves.</p>
              {lastSimError && /Revert na simulação|motivo não decodificado|não decodificado|Redeploy do Router/i.test(lastSimError) && (
                <p className="text-amber-200/90 text-xs mt-2"><strong>Passos para corrigir:</strong> 1) Abra Remix e cole <code className="bg-slate-800 px-1 rounded">docs/ArcDEXRouter_Remix.sol</code>. 2) Deploy com Factory = <code className="text-cyan-400">{CONFIG_FACTORY?.slice(0, 10)}...</code>. 3) Atualize <code className="text-cyan-400">src/config/arcTestnet.ts</code> com o novo endereço do Router.</p>
              )}
            </>
          )}
        </div>
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
                <div><span className="text-slate-500">chainId atual:</span> <span className="text-cyan-400">{debugData.chainId ?? '—'}</span></div>
                <div><span className="text-slate-500">router usado:</span> <span className="text-cyan-400 break-all">{debugData.routerAddress}</span></div>
                <div><span className="text-slate-500">factoryAddress (config):</span> <span className="text-cyan-400 break-all">{debugData.factoryAddress}</span></div>
                <div><span className="text-slate-500">router.factory() on-chain:</span> <span className="text-cyan-400 break-all">{debugData.routerFactoryOnChain ?? '—'}</span></div>
                {debugData.routerFactoryOnChain && debugData.factoryAddress && (
                  <div>
                    <span className="text-slate-500">Factory match:</span>{' '}
                    {debugData.routerFactoryOnChain.toLowerCase() === debugData.factoryAddress.toLowerCase() ? (
                      <span className="text-emerald-400">✓ OK</span>
                    ) : (
                      <span className="text-red-400">✗ MISMATCH</span>
                    )}
                  </div>
                )}
                <div><span className="text-slate-500">tokenIn:</span> <span className="text-cyan-400 break-all">{debugData.tokenIn ?? '—'}</span></div>
                <div><span className="text-slate-500">tokenOut:</span> <span className="text-cyan-400 break-all">{debugData.tokenOut ?? '—'}</span></div>
                <div><span className="text-slate-500">pair = factory.getPair(tokenIn, tokenOut):</span> <span className="text-cyan-400 break-all">{debugData.pairAddress ?? 'address(0)'}</span></div>
                <div><span className="text-slate-500">reserves (getReserves):</span> reserve0={debugData.reserve0} reserve1={debugData.reserve1}</div>
                <div><span className="text-slate-500">token0:</span> <span className="break-all">{debugData.token0 ?? '—'}</span></div>
                <div><span className="text-slate-500">token1:</span> <span className="break-all">{debugData.token1 ?? '—'}</span></div>
                <div><span className="text-slate-500">balance do usuário (tokenIn):</span> {debugData.balanceUser}</div>
                <div><span className="text-slate-500">allowance (tokenIn → router):</span> {debugData.allowanceUser}</div>
                <div><span className="text-slate-500">amountIn (raw):</span> {debugData.amountIn ?? '—'}</div>
                <div><span className="text-slate-500">amountOut esperado:</span> {debugData.amountOut ?? '—'}</div>
                <div><span className="text-slate-500">amountOutMin (com slippage):</span> {debugData.amountOutMin ?? '—'}</div>
                <div><span className="text-slate-500">block timestamp (último bloco):</span> {debugData.blockTimestamp ?? '—'}</div>
                <div><span className="text-slate-500">deadline (client, unix sec):</span> {debugData.deadlineClient}</div>
                {lastSwapDebug && (
                  <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
                    <div className="text-cyan-300/90 font-medium">Params do último swap (pré-simulação):</div>
                    <div><span className="text-slate-500">chainId:</span> {lastSwapDebug.chainId}</div>
                    <div><span className="text-slate-500">router:</span> <span className="break-all">{lastSwapDebug.router}</span></div>
                    <div><span className="text-slate-500">path:</span> <span className="break-all font-mono">[{lastSwapDebug.path.join(', ')}]</span></div>
                    <div><span className="text-slate-500">amountIn:</span> {lastSwapDebug.amountIn}</div>
                    <div><span className="text-slate-500">amountOut:</span> {lastSwapDebug.amountOut}</div>
                    <div><span className="text-slate-500">minOut:</span> {lastSwapDebug.minOut}</div>
                    <div><span className="text-slate-500">deadline:</span> {lastSwapDebug.deadline}</div>
                    <div><span className="text-slate-500">allowance:</span> {lastSwapDebug.allowance}</div>
                    <div><span className="text-slate-500">reserves:</span> reserve0={lastSwapDebug.reserve0} reserve1={lastSwapDebug.reserve1}</div>
                  </div>
                )}
                {lastSentSwapArgs && (
                  <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
                    <div className="text-amber-400/90 font-medium">Último swap enviado (RAW bigint):</div>
                    <div><span className="text-slate-500">amountInRaw:</span> <span className="text-cyan-400 font-mono">{lastSentSwapArgs.amountInRaw}</span></div>
                    <div><span className="text-slate-500">amountOutMinRaw:</span> <span className="text-cyan-400 font-mono">{lastSentSwapArgs.amountOutMinRaw}</span> <span className="text-slate-500 text-[10px]">(ex: 3.705530 EURC = 3705530, não 3705530e18)</span></div>
                    <div><span className="text-slate-500">path:</span> <span className="text-cyan-400 break-all font-mono">{JSON.stringify(lastSentSwapArgs.path)}</span></div>
                    <div><span className="text-slate-500">to:</span> <span className="text-cyan-400 break-all font-mono">{lastSentSwapArgs.to}</span></div>
                    <div><span className="text-slate-500">deadline:</span> <span className="text-cyan-400 font-mono">{lastSentSwapArgs.deadline}</span></div>
                  </div>
                )}
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

      {/* Allowance (só leitura); approve é feito pelo botão Swap quando necessário */}
      {debugOpen && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-3 text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span>Allowance USDC → Router:</span>
            <span className="font-mono text-cyan-400">
              {usdcAllowance !== undefined
                ? `${formatUnits(usdcAllowance, ARCDEX.decimals.USDC)} USDC`
                : address && DEX_ROUTER_ADDRESS
                  ? 'Carregando...'
                  : '—'}
            </span>
          </div>
          {DEX_ROUTER_ADDRESS && (
            <div className="text-slate-500 truncate">
              Router: <span className="font-mono text-slate-400">{DEX_ROUTER_ADDRESS}</span>
            </div>
          )}
          {address && DEX_ROUTER_ADDRESS && (
            <button
              type="button"
              onClick={handleTestApproveUsdc}
              disabled={testApproveInProgress || isTestApproveConfirming}
              className="mt-2 px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded text-cyan-400 disabled:opacity-50"
            >
              {testApproveInProgress || isTestApproveConfirming ? 'Aguardando...' : 'Test Approve USDC'}
            </button>
          )}
        </div>
      )}

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
