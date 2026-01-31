import { useState, useEffect, useRef, useCallback } from 'react'
import React from 'react'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { useSearchParams } from 'react-router-dom'
import { Loader2, RefreshCw, ExternalLink, Copy, CheckCircle2, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { parseAbiItem, erc721Abi } from 'viem'
import { useWalletModal } from '@/contexts/WalletModalContext'
import { AppShell } from '@/components/Layout/AppShell'
import { motion } from 'framer-motion'
import { CONSTANTS } from '@/config/constants'

const GLOBAL_TIMEOUT_MS = 15000
const CHUNK = 5000n
const MAX_LOOKBACK = 200000n

/**
 * Helper function to add timeout to promises
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout: ${operation} took longer than ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

interface NFTInfo {
  contractAddress: string
  tokenId: string
  owner: string
  tokenUri?: string
  name?: string
  image?: string
}

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
)

export function MyNFTsPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const chainId = useChainId()
  const [searchParams] = useSearchParams()
  const { openModal } = useWalletModal()

  const [nfts, setNfts] = useState<NFTInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lookbackNotice, setLookbackNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const loadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const highlightedTokenIdRef = useRef<HTMLDivElement>(null)

  const ownerParam = searchParams.get('owner')
  const highlightParam = searchParams.get('highlight')

  // Use owner from URL param or connected wallet
  const ownerAddress = ownerParam || address

  const loadNFTs = useCallback(async () => {
    if (loadingRef.current) return

    // Abort previous operation if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()
    const abortSignal = abortControllerRef.current.signal

    // Set loading guard FIRST before any early returns
    loadingRef.current = true
    setLoading(true)
    setError(null)

    if (!publicClient) {
      setNfts([])
      setError(null)
      setLoading(false)
      loadingRef.current = false
      return
    }

    if (!ownerAddress) {
      setNfts([])
      setError(null)
      setLoading(false)
      loadingRef.current = false
      return
    }

    if (!chainId) {
      setNfts([])
      setError(null)
      setLoading(false)
      loadingRef.current = false
      return
    }

    const rawContract = import.meta.env.VITE_FAJUCAR_COLLECTION_ADDRESS
    const contract =
      typeof rawContract === 'string' &&
      rawContract.trim().length === 42 &&
      /^0x[a-fA-F0-9]{40}$/i.test(rawContract.trim())
        ? (rawContract.trim() as `0x${string}`)
        : null

    if (!contract) {
      setError('Missing VITE_FAJUCAR_COLLECTION_ADDRESS')
      setNfts([])
      setLoading(false)
      loadingRef.current = false
      return
    }

    const owner = ownerAddress as `0x${string}`

    try {
      const latest = await withTimeout(
        publicClient.getBlockNumber(),
        GLOBAL_TIMEOUT_MS,
        'Get block number'
      )
      const start = latest > MAX_LOOKBACK ? latest - MAX_LOOKBACK : 0n

      type TransferLog = { args?: { tokenId?: bigint } }
      const allLogs: TransferLog[] = []
      let from = start
      while (from <= latest) {
        const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n
        const logsChunk = await withTimeout(
          publicClient.getLogs({
            address: contract,
            event: TRANSFER_EVENT,
            args: { to: owner },
            fromBlock: from,
            toBlock: to,
          }),
          GLOBAL_TIMEOUT_MS,
          'Load NFTs'
        )
        allLogs.push(...(logsChunk as TransferLog[]))
        from = to + 1n
      }

      const tokenIds = new Set<string>()
      for (const log of allLogs) {
        if (log.args?.tokenId !== undefined) {
          tokenIds.add(log.args.tokenId.toString())
        }
      }

      const allNFTs: NFTInfo[] = []
      for (const tokenIdStr of tokenIds) {
        try {
          const currentOwner = await publicClient.readContract({
            address: contract,
            abi: erc721Abi,
            functionName: 'ownerOf',
            args: [BigInt(tokenIdStr)],
          })
          if (currentOwner?.toLowerCase() !== owner.toLowerCase()) continue
        } catch {
          continue
        }
        allNFTs.push({
          contractAddress: contract,
          tokenId: tokenIdStr,
          owner: ownerAddress,
        })
      }

      setNfts(allNFTs)
      setError(null)
      setLookbackNotice(start > 0n ? 'Scanning recent blocks only. If you minted long ago, increase lookback.' : null)
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      if (abortSignal.aborted || errorMsg.includes('aborted')) {
        const errorMessage = 'Operation cancelled or timeout.'
        setError(errorMessage)
        setNfts([])
        setLookbackNotice(null)
        return
      }

      const errorMessage = errorMsg || 'Error loading NFTs'
      toast.error(errorMessage)
      setError(errorMessage)
      setNfts([])
      setLookbackNotice(null)
    } finally {
      setLoading(false)
      loadingRef.current = false
      abortControllerRef.current = null
    }
  }, [publicClient, ownerAddress, chainId])

  // Use ref to store loadNFTs to avoid dependency issues
  const loadNFTsRef = useRef(loadNFTs)
  useEffect(() => {
    loadNFTsRef.current = loadNFTs
  }, [loadNFTs])

  useEffect(() => {
    if (ownerAddress && chainId && publicClient && !loadingRef.current) {
      loadNFTsRef.current()
    } else if (!ownerAddress || !chainId || !publicClient) {
      if (nfts.length > 0 || loading) {
        setNfts([])
        setError(null)
        setLoading(false)
        loadingRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAddress, chainId])

  // Reload NFTs when highlight param changes (e.g., after mint)
  useEffect(() => {
    if (highlightParam && ownerAddress && chainId && publicClient && !loadingRef.current) {
      loadNFTsRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightParam])

  // Scroll to highlighted NFT when it appears
  useEffect(() => {
    if (highlightParam && highlightedTokenIdRef.current) {
      setTimeout(() => {
        highlightedTokenIdRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 500)
    }
  }, [highlightParam, nfts])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      toast.success(`${label} copied!`)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  // Gate: não auto-conectar, mostrar tela gated
  // Allow viewing NFTs if ownerParam is provided (even if wallet not connected)
  if (!isConnected && !ownerParam) {
    return (
      <AppShell
        title="My NFTs"
        subtitle="Connect your wallet to view your NFTs"
      >
        <div className="text-center py-12">
          <ImageIcon className="h-16 w-16 mx-auto text-cyan-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-white">Connect Your Wallet</h2>
          <p className="text-slate-400 mb-6">Connect your wallet to view your NFTs</p>
          <button
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all"
            onClick={() => openModal?.()}
          >
            Connect Wallet
          </button>
        </div>
      </AppShell>
    )
  }

  const subtitle = ownerAddress
    ? `Owner: ${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}`
    : 'View and manage your Arc Network NFTs'

  return (
    <AppShell
      title="My NFTs"
      subtitle={subtitle}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setError(null)
              loadNFTsRef.current()
            }}
            disabled={loading}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white hover:bg-slate-800/70 hover:border-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-2xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {lookbackNotice && !error && (
        <div className="mb-6 rounded-xl border border-cyan-500/30 bg-slate-800/50 p-3">
          <p className="text-slate-400 text-sm">{lookbackNotice}</p>
        </div>
      )}

      {loading && nfts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-4" />
          <p className="text-slate-400">Loading your NFTs...</p>
        </div>
      ) : error ? (
        <div className="bg-slate-800/50 border border-red-500/20 rounded-2xl p-12 text-center">
          <p className="text-red-400 mb-4 font-medium">
            {error}
          </p>
          <p className="text-sm text-slate-500 mb-4">
            Clique em Refresh para tentar novamente.
          </p>
        </div>
      ) : nfts.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-12 text-center">
          <p className="text-white font-semibold mb-2">Nenhum NFT encontrado</p>
          <p className="text-sm text-slate-400 mb-6">
            Se você acabou de mintar, às vezes leva alguns segundos pra aparecer. Clique em Refresh.
          </p>
          <button
            onClick={() => {
              setError(null)
              loadNFTsRef.current()
            }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nfts.map((nft, index) => (
            <motion.div
              key={`${nft.contractAddress}-${nft.tokenId}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <NFTCard
                nft={nft}
                copied={copied}
                onCopy={copyToClipboard}
                isHighlighted={highlightParam === nft.tokenId}
                ref={highlightParam === nft.tokenId ? highlightedTokenIdRef : undefined}
              />
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
  )
}

// Componente NFT Card simples
const NFTCard = React.forwardRef<HTMLDivElement, {
  nft: NFTInfo
  copied: string | null
  onCopy: (text: string, label: string) => void
  isHighlighted?: boolean
}>(({ nft, copied, onCopy, isHighlighted }, ref) => {
  return (
    <div
      ref={ref}
      className={`rounded-2xl border bg-slate-900/50 backdrop-blur-xl overflow-hidden transition-all ${
        isHighlighted
          ? 'border-cyan-500 shadow-lg shadow-cyan-500/30 scale-105'
          : 'border-cyan-500/25 hover:border-cyan-500/50'
      }`}
    >
      {/* NFT Image */}
      <div className="relative aspect-square bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden">
        {nft.image ? (
          <img
            src={nft.image}
            alt={nft.name || `NFT #${nft.tokenId}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="w-16 h-16 text-cyan-400/50" />
        )}
      </div>

      {/* NFT Info */}
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2 text-white">
          {nft.name ?? `NFT #${nft.tokenId}`}
        </h3>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Token ID:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-300">#{nft.tokenId}</span>
              <button
                onClick={() => onCopy(nft.tokenId, 'Token ID')}
                className="p-1 hover:bg-slate-800 rounded transition-colors"
              >
                {copied === 'Token ID' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Contract:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-300 text-[10px]">
                {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)}
              </span>
              <button
                onClick={() => onCopy(nft.contractAddress, 'Address')}
                className="p-1 hover:bg-slate-800 rounded transition-colors"
              >
                {copied === 'Address' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <a
            href={`${CONSTANTS.LINKS.explorer}/token/${nft.contractAddress}?a=${nft.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>View on Explorer</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
})

NFTCard.displayName = 'NFTCard'
