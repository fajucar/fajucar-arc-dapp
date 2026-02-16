import { useState, useEffect, useRef, useCallback } from 'react'
import React from 'react'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, ExternalLink, Copy, CheckCircle2, Image as ImageIcon, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useWalletModal } from '@/contexts/WalletModalContext'
import { FAJUCAR_COLLECTION_ADDRESS } from '@/config/contracts'
import { ARC_COLLECTION, getImageURL } from '@/config/arcCollection'
import { AppShell } from '@/components/Layout/AppShell'
import { motion, AnimatePresence } from 'framer-motion'
import { CONSTANTS } from '@/config/constants'

const GLOBAL_TIMEOUT_MS = 30000
/** Default 200; can be increased to 1000 in this file if the collection has more token IDs. */
const MAX_TOKEN_ID_SCAN = 200
const OWNER_OF_CONCURRENCY = 10
const FIXED_IPFS_TOKEN_URI = 'ipfs://bafkreicisecsndv777lv3hfafh3kfgvxf25al2mf7rifrqbdbbjqvcrs6u'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout: ${operation} took longer than ${timeoutMs}ms`)), timeoutMs)
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

const FAJUCAR_READ_ABI = [
  { type: 'function' as const, name: 'balanceOf' as const, stateMutability: 'view' as const, inputs: [{ name: 'owner', type: 'address' as const }], outputs: [{ type: 'uint256' }] },
  { type: 'function' as const, name: 'tokenOfOwnerByIndex' as const, stateMutability: 'view' as const, inputs: [{ name: 'owner', type: 'address' as const }, { name: 'index', type: 'uint256' as const }], outputs: [{ type: 'uint256' }] },
  { type: 'function' as const, name: 'getUserTokens' as const, stateMutability: 'view' as const, inputs: [{ name: 'user', type: 'address' as const }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function' as const, name: 'ownerOf' as const, stateMutability: 'view' as const, inputs: [{ name: 'tokenId', type: 'uint256' as const }], outputs: [{ type: 'address' }] },
  { type: 'function' as const, name: 'tokenURI' as const, stateMutability: 'view' as const, inputs: [{ name: 'tokenId', type: 'uint256' as const }], outputs: [{ type: 'string' }] },
] as const

function ipfsToHttp(uri: string): string {
  const s = (uri || '').trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${s.replace(/^ipfs:\/\//, '')}`
  if (s.startsWith('ipfs/')) return `https://ipfs.io/ipfs/${s.replace(/^ipfs\//, '')}`
  return s
}

/** Resolve image URL so it loads in the browser: relative paths and localhost use current origin. */
function resolveImageUrl(imageUrl: string, metadataOrigin?: string): string {
  const s = (imageUrl || '').trim()
  if (!s) return ''
  let normalized = ipfsToHttp(s)
  // Relative path (e.g. /assets/nfts/arc_explorer.png) -> use current origin so image loads
  if (normalized.startsWith('/')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : metadataOrigin || ''
    return origin ? `${origin}${normalized}` : normalized
  }
  // If metadata points to localhost but app is served from another origin, use current origin for same path (e.g. deployed app)
  if (typeof window !== 'undefined' && window.location.origin && (normalized.includes('localhost') || normalized.includes('127.0.0.1'))) {
    try {
      const u = new URL(normalized)
      const path = u.pathname + u.search
      if (path && path !== '/') normalized = `${window.location.origin}${path}`
    } catch {
      // keep normalized as-is
    }
  }
  return normalized
}

async function fetchMetadata(tokenUri: string): Promise<{ name?: string; image?: string }> {
  let url = ipfsToHttp(tokenUri)
  // Resolve relative metadata URLs (e.g. /metadata/arc-explorer.json) so fetch works
  if (url.startsWith('/') && typeof window !== 'undefined') {
    url = `${window.location.origin}${url}`
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), mode: 'cors' })
    if (!res.ok) return {}
    const json = (await res.json()) as { name?: string; image?: string; image_url?: string }
    const name = typeof json.name === 'string' ? json.name : undefined
    const rawImage = typeof json.image === 'string' ? json.image : typeof json.image_url === 'string' ? json.image_url : undefined
    let origin: string | undefined
    try {
      origin = new URL(url).origin
    } catch {
      origin = typeof window !== 'undefined' ? window.location.origin : undefined
    }
    const image = rawImage ? resolveImageUrl(rawImage, origin) : undefined
    return { name, image }
  } catch {
    return {}
  }
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

export function MyNFTsPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const chainId = useChainId()
  const [searchParams] = useSearchParams()
  const { openModal } = useWalletModal()

  const [nfts, setNfts] = useState<NFTInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [selectedNft, setSelectedNft] = useState<NFTInfo | null>(null)

  const loadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const highlightedTokenIdRef = useRef<HTMLDivElement>(null)

  const highlightParam = searchParams.get('highlight')

  // Cada usuário vê apenas os NFTs que possui (carteira conectada)
  const ownerAddress = address ?? null

  // Listagem 100% on-chain: balanceOf -> tokenOfOwnerByIndex ou getUserTokens ou ownerOf(tokenId) scan. Sem mocks, totalSupply isolado ou IDs fixos.
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

    if (!FAJUCAR_COLLECTION_ADDRESS) {
      setError('Invalid contract. Check VITE_FAJUCAR_COLLECTION_ADDRESS (no quotes or spaces).')
      setNfts([])
      setLoading(false)
      loadingRef.current = false
      return
    }
    const contract = FAJUCAR_COLLECTION_ADDRESS as `0x${string}`
    const owner = ownerAddress as `0x${string}`

    try {
      const balance = await withTimeout(
        publicClient.readContract({
          address: contract,
          abi: FAJUCAR_READ_ABI,
          functionName: 'balanceOf',
          args: [owner],
        }),
        GLOBAL_TIMEOUT_MS,
        'balanceOf'
      )

      if (balance === undefined || balance === null || balance === 0n) {
        setNfts([])
        setError(null)
        return
      }

      let tokenIds: string[] = []
      let enumerableSupported = false
      try {
        await publicClient.readContract({
          address: contract,
          abi: FAJUCAR_READ_ABI,
          functionName: 'tokenOfOwnerByIndex',
          args: [owner, 0n],
        })
        enumerableSupported = true
      } catch {
        // tokenOfOwnerByIndex not available
      }

      if (enumerableSupported) {
        for (let i = 0; i < Number(balance); i++) {
          try {
            const tokenId = await publicClient.readContract({
              address: contract,
              abi: FAJUCAR_READ_ABI,
              functionName: 'tokenOfOwnerByIndex',
              args: [owner, BigInt(i)],
            })
            tokenIds.push(tokenId.toString())
          } catch {
            // skip failed index
          }
        }
      }

      if (tokenIds.length === 0) {
        try {
          const userTokens = await withTimeout(
            publicClient.readContract({
              address: contract,
              abi: FAJUCAR_READ_ABI,
              functionName: 'getUserTokens',
              args: [owner],
            }),
            GLOBAL_TIMEOUT_MS,
            'getUserTokens'
          )
          if (Array.isArray(userTokens) && userTokens.length > 0) {
            tokenIds = userTokens.map((id: bigint) => id.toString())
          }
        } catch {
          // getUserTokens not available or reverted
        }
      }

      if (tokenIds.length === 0) {
        const scanIds = Array.from({ length: Number(MAX_TOKEN_ID_SCAN) }, (_, i) => i + 1)
        const owners = await runWithConcurrency(scanIds, OWNER_OF_CONCURRENCY, async (tokenId) => {
          try {
            return await publicClient.readContract({
              address: contract,
              abi: FAJUCAR_READ_ABI,
              functionName: 'ownerOf',
              args: [BigInt(tokenId)],
            })
          } catch {
            return null
          }
        })
        tokenIds = scanIds
          .map((id, i) => (owners[i]?.toLowerCase() === owner.toLowerCase() ? String(id) : null))
          .filter((id): id is string => id !== null)
      }

      const allNFTs: NFTInfo[] = []
      for (const tokenIdStr of tokenIds) {
        let tokenUri: string | undefined
        try {
          tokenUri = await publicClient.readContract({
            address: contract,
            abi: FAJUCAR_READ_ABI,
            functionName: 'tokenURI',
            args: [BigInt(tokenIdStr)],
          })
        } catch {
          tokenUri = FIXED_IPFS_TOKEN_URI
        }
        const uriToFetch = tokenUri || FIXED_IPFS_TOKEN_URI
        let name: string | undefined
        let image: string | undefined
        try {
          const meta = await fetchMetadata(uriToFetch)
          name = meta.name
          image = meta.image
        } catch {
          // leave name/image undefined
        }
        // Fallback: if metadata had no image but tokenURI is a direct image URL, use it
        if (!image && /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(uriToFetch)) {
          image = resolveImageUrl(uriToFetch)
        }
        // Fallback FajucarCollection: use app assets so images always show when contract tokenURI is localhost or fails (tokenId 1..5 = modelo exato; 6+ = ciclo)
        const tokenIdNum = parseInt(tokenIdStr, 10)
        if (!image && !isNaN(tokenIdNum) && tokenIdNum >= 1 && ARC_COLLECTION.length > 0) {
          const index = (tokenIdNum - 1) % ARC_COLLECTION.length
          const item = ARC_COLLECTION[index]
          if (item?.image) {
            image = getImageURL(item.image)
            if (!name) name = item.name
          }
        }
        allNFTs.push({
          contractAddress: contract,
          tokenId: tokenIdStr,
          owner: ownerAddress,
          tokenUri: uriToFetch,
          name,
          image,
        })
      }

      allNFTs.sort((a, b) => {
        const idA = BigInt(a.tokenId)
        const idB = BigInt(b.tokenId)
        return idA < idB ? -1 : idA > idB ? 1 : 0
      })

      setNfts(allNFTs)
      setError(null)
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      if (abortSignal.aborted || errorMsg.includes('aborted')) {
        setError('Operation cancelled or timeout.')
        setNfts([])
        return
      }

      toast.error(errorMsg || 'Error loading NFTs')
      setError(errorMsg || 'Error loading NFTs')
      setNfts([])
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

  // Gate: usuário precisa conectar a carteira para ver seus NFTs
  if (!isConnected) {
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

  const subtitle = ownerAddress ? `${ownerAddress.slice(0, 6)}…${ownerAddress.slice(-4)}` : ''

  return (
    <AppShell
      title="My NFTs"
      subtitle={subtitle}
      titleClassName="text-xl md:text-2xl font-semibold tracking-tight"
    >
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => {
            setError(null)
            loadNFTsRef.current()
          }}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-slate-800/40 border border-slate-700/40 text-slate-300 hover:bg-slate-800/60 hover:border-slate-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs font-medium"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-900/15 border border-red-500/20 px-4 py-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading && nfts.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="rounded-2xl border border-slate-700/40 bg-slate-800/40 overflow-hidden"
            >
              <div className="aspect-square bg-slate-700/50 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-slate-700/50 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-slate-700/50 rounded animate-pulse" />
              </div>
            </motion.div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-slate-800/40 border border-red-500/20 px-6 py-8 text-center">
          <p className="text-red-400 text-sm font-medium mb-2">{error}</p>
          <p className="text-slate-500 text-xs mb-4">Clique em Refresh para tentar novamente.</p>
          <button
            onClick={() => { setError(null); loadNFTsRef.current() }}
            className="px-4 py-2 rounded-lg bg-slate-700/50 text-slate-300 text-sm hover:bg-slate-600/50 transition-colors"
          >
            Refresh
          </button>
        </div>
      ) : nfts.length === 0 ? (
        <div className="rounded-xl bg-slate-800/40 border border-slate-700/40 px-6 py-10 text-center">
          <p className="text-white font-medium text-sm mb-1">No NFTs found</p>
          <p className="text-slate-500 text-xs mb-4">Se acabou de mintar, aguarde alguns segundos e clique em Refresh.</p>
          <button
            onClick={() => { setError(null); loadNFTsRef.current() }}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="w-full">
          <div className={`grid gap-4 ${nfts.length <= 3 ? 'grid-cols-3 w-fit mx-auto' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5'}`}>
            {nfts.map((nft, index) => (
              <motion.div
                key={`${nft.contractAddress}-${nft.tokenId}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
              >
                <NFTCard
                  nft={nft}
                  isHighlighted={highlightParam === nft.tokenId}
                  ref={highlightParam === nft.tokenId ? highlightedTokenIdRef : undefined}
                  onClick={() => setSelectedNft(nft)}
                />
              </motion.div>
            ))}
          </div>
          <NFTModal nft={selectedNft} copied={copied} onCopy={copyToClipboard} onClose={() => setSelectedNft(null)} />
        </div>
      )}
    </AppShell>
  )
}

// Card: imagem + ID, hover zoom, click to open modal
const NFTCard = React.forwardRef<HTMLDivElement, {
  nft: NFTInfo
  isHighlighted?: boolean
  onClick?: () => void
}>(({ nft, isHighlighted, onClick }, ref) => {
  const [imageError, setImageError] = useState(false)
  const showImage = nft.image && !imageError

  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      className={`cursor-pointer rounded-2xl border overflow-hidden transition-all duration-300 ease-in-out
        ${isHighlighted
          ? 'border-cyan-400/60 shadow-[0_0_24px_rgba(34,211,238,0.2)] ring-1 ring-cyan-400/30 scale-[1.02]'
          : 'border-slate-700/40 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)]'
        }`}
    >
      <div className="relative aspect-square bg-slate-800/50 flex items-center justify-center overflow-hidden group">
        {showImage ? (
          <img
            src={nft.image}
            alt={`#${nft.tokenId}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <ImageIcon className="w-12 h-12 text-slate-600" />
        )}
      </div>
      <div className="px-3 py-2.5 bg-slate-900/60 border-t border-slate-700/40 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="font-mono text-xs text-slate-300 truncate">#{nft.tokenId}</span>
          <span className="text-xs text-slate-400 truncate">{nft.name || 'Unknown'}</span>
        </div>
      </div>
    </motion.div>
  )
})

NFTCard.displayName = 'NFTCard'

// Modal: glass background, large preview, metadata, copy contract, explorer link
function NFTModal({ nft, copied, onCopy, onClose }: {
  nft: NFTInfo | null
  copied: string | null
  onCopy: (text: string, label: string) => void
  onClose: () => void
}) {
  const [imageError, setImageError] = useState(false)

  return (
    <AnimatePresence mode="wait">
      {nft && (
      <motion.div
        key={`modal-${nft.contractAddress}-${nft.tokenId}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden"
        >
          <div className="relative aspect-square bg-slate-800/50 flex items-center justify-center overflow-hidden">
            {(nft.image && !imageError) ? (
              <img src={nft.image} alt={`#${nft.tokenId}`} className="w-full h-full object-contain" onError={() => setImageError(true)} />
            ) : (
              <ImageIcon className="w-20 h-20 text-slate-600" />
            )}
            <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{nft.name || `Token #${nft.tokenId}`}</h3>
              <p className="font-mono text-sm text-slate-400">#{nft.tokenId}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
              <span className="font-mono text-xs text-slate-300 truncate flex-1 mr-2">{nft.contractAddress}</span>
              <button onClick={() => onCopy(nft.contractAddress, 'Address')} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors text-sm font-medium">
                {copied === 'Address' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copy Contract
              </button>
            </div>
            <a
              href={`${CONSTANTS.LINKS.explorer}/token/${nft.contractAddress}?a=${nft.tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 transition-colors font-medium"
            >
              View on Explorer
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}
