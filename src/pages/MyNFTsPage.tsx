import { useState, useEffect, useRef, useCallback } from 'react'
import React from 'react'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { useSearchParams } from 'react-router-dom'
import { Loader2, RefreshCw, ExternalLink, Copy, CheckCircle2, Image as ImageIcon, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { useWalletModal } from '@/contexts/WalletModalContext'
import { NFT_ADDRESS, validateConfig } from '@/lib/addresses'
import FajuARC_ABI from '@/abis/FajuARC.json'
import { AppShell } from '@/components/Layout/AppShell'
import { motion } from 'framer-motion'

// Timeout for RPC operations (15 seconds per operation)
const RPC_TIMEOUT_MS = 15000

// Global watchdog timeout (15 seconds total)
const GLOBAL_TIMEOUT_MS = 15000

// Timeout per token metadata fetch (8 seconds)
const METADATA_TIMEOUT_MS = 8000

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

/**
 * Helper function to fetch JSON with timeout and AbortController
 */
async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<any> {
  // Convert IPFS to HTTP if needed
  const httpUrl = ipfsToHttp(url)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(httpUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError' || signal.aborted) {
      throw new Error(`Timeout fetching metadata from ${url}`)
    }
    throw error
  }
}

interface NFTInfo {
  tokenId: string
  tokenURI: string
  owner: string
  metadata?: {
    name?: string
    description?: string
    image?: string
  }
  useFallbackImage?: boolean // Flag to force fallback image
}

// ArcScan base URL (fallback to testnet)
// Safe access - never throws
function getArcscanBaseUrl(): string {
  try {
    const url = import.meta.env.VITE_ARCSCAN_BASE_URL
    if (url && typeof url === 'string' && url.trim() !== '') {
      return url.trim()
    }
  } catch {
    // Ignore - use fallback
  }
  return 'https://testnet.arcscan.app'
}

const ARCSCAN_BASE_URL = getArcscanBaseUrl()

/**
 * Get fallback image path based on tokenId
 * tokenId 1 -> explorer
 * tokenId 2 -> builder
 * tokenId 3 -> guardian
 */
function getFallbackImage(tokenId: string): string {
  const id = parseInt(tokenId, 10)
  if (id === 1) {
    return '/assets/nfts/arc_explorer.png'
  } else if (id === 2) {
    return '/assets/nfts/arc_builder.png'
  } else if (id === 3) {
    return '/assets/nfts/arc_guardian.png'
  }
  // Default fallback for other tokenIds
  return '/assets/nfts/arc_explorer.png'
}

// Helper para converter IPFS para HTTP
function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`
  }
  if (uri.startsWith('https://')) {
    return uri
  }
  if (uri.startsWith('http://')) {
    return uri
  }
  return uri
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
  const [showImportInstructions, setShowImportInstructions] = useState(false)

  const loadingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const highlightedTokenIdRef = useRef<HTMLDivElement>(null)

  const ownerParam = searchParams.get('owner')
  const highlightParam = searchParams.get('highlight')

  // Use owner from URL param or connected wallet
  const ownerAddress = ownerParam || address

  // Use NFT_ADDRESS from addresses.ts
  const nftContractAddress = NFT_ADDRESS

  // Validate config on mount
  useEffect(() => {
    const config = validateConfig()
    if (!config.valid) {
      console.error('❌ Configuração inválida:', config.errors)
      config.errors.forEach((error) => {
        console.error(`  - ${error}`)
      })
    }
  }, [])

  const loadNFTs = useCallback(async () => {
    // Guard: prevent concurrent executions
    if (loadingRef.current) {
      console.log('⚠️ loadNFTs já está em execução, ignorando chamada duplicada')
      return
    }

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

    // Global watchdog timer (15s max)
    let watchdogTimer: NodeJS.Timeout | null = null
    const startWatchdog = () => {
      watchdogTimer = setTimeout(() => {
        console.error('⏰ WATCHDOG: Timeout global de 15s estourado! Forçando finalização...')
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        setError('Request timeout. Please try again.')
        setLoading(false)
        loadingRef.current = false
        abortControllerRef.current = null
      }, GLOBAL_TIMEOUT_MS)
    }
    
    const clearWatchdog = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer)
        watchdogTimer = null
      }
    }

    if (!publicClient) {
      console.warn('⚠️ publicClient não disponível')
      setNfts([])
      setError(null)
      setLoading(false)
      loadingRef.current = false
      return
    }

    if (!ownerAddress) {
      console.warn('⚠️ ownerAddress não disponível')
      setNfts([])
      setError(null)
      setLoading(false)
      loadingRef.current = false
      return
    }

    if (!nftContractAddress) {
      console.warn('⚠️ NFT contract address não configurado (VITE_GIFT_CARD_NFT_ADDRESS)')
      setNfts([])
      setError('NFT contract address not configured')
      setLoading(false)
      loadingRef.current = false
      return
    }

    const startTime = Date.now()
    console.log('🚀 START loadNFTs')
    console.log('  👤 Owner:', ownerAddress)
    console.log('  📍 NFT Address:', nftContractAddress)
    console.log('  🔗 Chain ID:', chainId)
    
    // Start watchdog
    startWatchdog()

    try {
      // Step 1: Read balanceOf(owner)
      console.log('📊 Step 1: Reading balanceOf(owner)...')
      const balancePromise = publicClient.readContract({
        address: nftContractAddress,
        abi: FajuARC_ABI,
        functionName: 'balanceOf',
        args: [ownerAddress as `0x${string}`],
      })
      
      const balance = await withTimeout(
        balancePromise,
        RPC_TIMEOUT_MS,
        'readContract balanceOf'
      ) as bigint

      console.log(`  ✅ Balance: ${balance.toString()}`)

      if (balance === 0n) {
        console.log('  ℹ️ Balance is 0, no NFTs to load')
        clearWatchdog()
        setNfts([])
        setError(null)
        setLoading(false)
        loadingRef.current = false
        abortControllerRef.current = null
        return
      }

      // Step 2: Try to read totalSupply, fallback to iterating
      let maxTokenId: bigint
      try {
        console.log('📊 Step 2: Trying to read totalSupply()...')
        const totalSupplyPromise = publicClient.readContract({
          address: nftContractAddress,
          abi: FajuARC_ABI,
          functionName: 'totalSupply',
          args: [],
        })
        
        const totalSupply = await withTimeout(
          totalSupplyPromise,
          RPC_TIMEOUT_MS,
          'readContract totalSupply'
        ) as bigint

        console.log(`  ✅ totalSupply: ${totalSupply.toString()}`)
        maxTokenId = totalSupply
      } catch (error: any) {
        console.warn('  ⚠️ totalSupply() não disponível ou falhou, usando fallback:', error.message)
        // Fallback: iterate from 1 to (balance + buffer 5)
        maxTokenId = balance + 5n
        console.log(`  📊 Fallback: iterando até tokenId ${maxTokenId.toString()} (balance + 5)`)
      }

      // Step 3: Iterate through tokenIds and check ownerOf
      console.log(`📊 Step 3: Iterando tokenIds de 1 até ${maxTokenId.toString()}...`)
      const ownedTokenIds: bigint[] = []
      let errorsIgnored = 0

      // Use Promise.allSettled for parallel checks (but limit concurrency)
      const batchSize = 10 // Check 10 tokens at a time
      for (let start = 1n; start <= maxTokenId; start += BigInt(batchSize)) {
        if (abortSignal.aborted) {
          throw new Error('Operation aborted')
        }

        const end = start + BigInt(batchSize) - 1n > maxTokenId ? maxTokenId : start + BigInt(batchSize) - 1n
        const batch: bigint[] = []
        for (let i = start; i <= end; i++) {
          batch.push(i)
        }

        const results = await Promise.allSettled(
          batch.map(async (tokenId) => {
            try {
              const ownerPromise = publicClient.readContract({
                address: nftContractAddress,
                abi: FajuARC_ABI,
                functionName: 'ownerOf',
                args: [tokenId],
              })
              
              const tokenOwner = await withTimeout(
                ownerPromise,
                RPC_TIMEOUT_MS,
                `readContract ownerOf for token ${tokenId.toString()}`
              ) as `0x${string}`

              const ownerLower = ownerAddress.toLowerCase()
              const tokenOwnerLower = tokenOwner.toLowerCase()

              if (tokenOwnerLower === ownerLower) {
                return tokenId
              }
              return null
            } catch (error: any) {
              // Ignore errors (token doesn't exist or other issues)
              errorsIgnored++
              return null
            }
          })
        )

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value !== null) {
            ownedTokenIds.push(result.value)
          }
        }

        // Small delay between batches to avoid overwhelming RPC
        if (end < maxTokenId) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }

      console.log(`✅ Step 3 concluído:`)
      console.log(`  - TokenIds encontrados: ${ownedTokenIds.length}`)
      console.log(`  - Erros ignorados: ${errorsIgnored}`)
      if (ownedTokenIds.length > 0) {
        console.log(`  - Token IDs:`, ownedTokenIds.map(id => id.toString()).join(', '))
      }

      // Step 4: Sort tokenIds (descending)
      const tokenIds = ownedTokenIds.sort((a, b) => {
        if (a > b) return -1
        if (a < b) return 1
        return 0
      })

      // Step 5: Render immediately with tokenIds (without metadata)
      const nftInfosBasic: NFTInfo[] = tokenIds.map((tokenId) => ({
        tokenId: tokenId.toString(),
        tokenURI: '', // Will be loaded in background
        owner: ownerAddress,
      }))
      
      setNfts(nftInfosBasic)
      console.log(`  ✅ Renderizados ${nftInfosBasic.length} NFTs básicos (tokenIds apenas)`)

      // Step 6: Load tokenURI + metadata in background (non-blocking)
      if (tokenIds.length > 0) {
        console.log(`  🖼️ Background: FETCH tokenURI + metadata para ${tokenIds.length} tokens...`)
        
        Promise.allSettled(
          tokenIds.map(async (tokenId) => {
            try {
              if (abortSignal.aborted) {
                return null
              }

              console.log(`  Background FETCH tokenURI tokenId=${tokenId.toString()}`)
              
              const tokenURIPromise = publicClient.readContract({
                address: nftContractAddress,
                abi: FajuARC_ABI,
                functionName: 'tokenURI',
                args: [tokenId],
              })

              const tokenURI = await withTimeout(
                tokenURIPromise,
                RPC_TIMEOUT_MS,
                `readContract tokenURI for token ${tokenId.toString()}`
              ) as string

              console.log(`    ✅ Background: Token ${tokenId.toString()} tokenURI = ${tokenURI}`)

              // Fetch metadata and update NFT with both tokenURI and metadata
              let metadata: any = null
              if (tokenURI && typeof tokenURI === 'string' && tokenURI.trim() !== '' && !abortSignal.aborted) {
                try {
                  console.log(`  Background FETCH metadata tokenId=${tokenId.toString()} url=${tokenURI}`)
                  metadata = await fetchJsonWithTimeout(tokenURI, METADATA_TIMEOUT_MS, abortSignal)
                  console.log(`    ✅ Background FETCH metadata result tokenId=${tokenId.toString()}:`)
                  console.log(`      - name: ${metadata?.name || 'N/A'}`)
                  console.log(`      - image: ${metadata?.image || 'N/A'}`)
                } catch (metaError: any) {
                  console.warn(`    ⚠️ Background FETCH metadata result tokenId=${tokenId.toString()} failed:`, metaError.message)
                  // Keep metadata as null if fetch fails
                }
              }

              // Update NFT with tokenURI and metadata
              setNfts((prev) =>
                prev.map((nft) =>
                  nft.tokenId === tokenId.toString()
                    ? { 
                        ...nft, 
                        tokenURI: tokenURI,
                        metadata: metadata || undefined
                      }
                    : nft
                )
              )

              return {
                tokenId: tokenId.toString(),
                tokenURI: tokenURI,
                owner: ownerAddress,
                metadataImage: metadata?.image || null,
              }
            } catch (error: any) {
              const errorMsg = error.message || String(error)
              console.warn(`    ⚠️ Background: Erro ao carregar token ${tokenId}:`, errorMsg)
              // Keep NFT with empty tokenURI
              return null
            }
          })
        ).then((results) => {
          const successful = results.filter((r) => r.status === 'fulfilled' && r.value !== null).length
          const failed = results.length - successful
          console.log(`  📊 Background: Metadata carregada - ${successful} ok, ${failed} falharam`)
          
          // Collect all metadata images from results
          const metadataImages: string[] = []
          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value?.metadataImage) {
              metadataImages.push(result.value.metadataImage)
            }
          })
          
          // Check if all metadata images are identical
          const uniqueImages = new Set(metadataImages)
          const allImagesIdentical = metadataImages.length > 1 && uniqueImages.size === 1
          
          if (allImagesIdentical) {
            console.warn(`  ⚠️ All metadata images are identical: ${metadataImages[0]}`)
            console.warn(`  ℹ️ Will use fallback images based on tokenId for all tokens`)
            
            // Force fallback for all NFTs
            setNfts((prev) =>
              prev.map((nft) => ({
                ...nft,
                useFallbackImage: true,
              }))
            )
          } else if (metadataImages.length > 0) {
            console.log(`  ✅ Metadata images are distinct:`, Array.from(uniqueImages))
          }
          
          // Also check for missing images and force fallback
          setNfts((prev) =>
            prev.map((nft) => {
              const hasMetadata = nft.metadata && nft.metadata.image
              if (!hasMetadata) {
                console.log(`  ℹ️ tokenId=${nft.tokenId}: No metadata image, will use fallback`)
                return {
                  ...nft,
                  useFallbackImage: true,
                }
              }
              return nft
            })
          )
        })
      }

      const elapsedTime = Date.now() - startTime
      const renderedCount = nftInfosBasic.length
      
      console.log(`🎉 END loadNFTs`)
      console.log(`  - Duration: ${elapsedTime}ms`)
      console.log(`  - Balance: ${balance.toString()}`)
      console.log(`  - Token IDs found: ${tokenIds.length}`)
      console.log(`  - Errors ignored: ${errorsIgnored}`)
      console.log(`  - Rendered count: ${renderedCount}`)
      
      // Clear watchdog before setting results
      clearWatchdog()
      
      // NFTs already set above (immediate render)
      setError(null)
    } catch (error: any) {
      const errorMsg = error.message || String(error)
      const errorCode = error.code || error.status || ''
      
      console.error('❌ Erro ao carregar NFTs:', error)
      console.error('  Detalhes do erro:', {
        message: errorMsg,
        code: errorCode,
        data: error.data,
      })
      
      // Clear watchdog on error
      clearWatchdog()
      
      // Check for abort signal
      if (abortSignal.aborted || errorMsg.includes('aborted')) {
        const errorMessage = 'Operation cancelled or timeout.'
        setError(errorMessage)
        setNfts([])
        return
      }
      
      // Set error message
      if (errorMsg.includes('Timeout') || errorMsg.includes('timeout')) {
        const errorMessage = 'Request timeout. Please try again.'
        toast.error(errorMessage)
        setError(errorMessage)
      } else {
        const errorMessage = errorMsg || 'Error loading NFTs'
        toast.error(errorMessage)
        setError(errorMessage)
      }
      
      // IMPORTANT: On error/timeout, clear NFTs and don't show "You don't have any NFTs yet"
      setNfts([])
    } finally {
      // Always reset loading state and clear watchdog
      clearWatchdog()
      setLoading(false)
      loadingRef.current = false
      abortControllerRef.current = null
    }
  }, [publicClient, ownerAddress, nftContractAddress, chainId])

  // Use ref to store loadNFTs to avoid dependency issues
  const loadNFTsRef = useRef(loadNFTs)
  useEffect(() => {
    loadNFTsRef.current = loadNFTs
  }, [loadNFTs])

  useEffect(() => {
    // Create a unique key for current load parameters
    const loadKey = `${ownerAddress || ''}-${nftContractAddress || ''}-${chainId || ''}`
    
    // Only load if parameters are available and not already loading
    if (ownerAddress && nftContractAddress && publicClient && !loadingRef.current) {
      console.log('🔄 useEffect: Carregando NFTs com parâmetros:', loadKey)
      loadNFTsRef.current()
    } else if (!ownerAddress || !nftContractAddress || !publicClient) {
      if (nfts.length > 0 || loading) {
        setNfts([])
        setError(null)
        setLoading(false)
        loadingRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerAddress, nftContractAddress, chainId])

  // Reload NFTs when highlight param changes (e.g., after mint)
  useEffect(() => {
    if (highlightParam && ownerAddress && nftContractAddress && publicClient && !loadingRef.current) {
      console.log('🔄 Reloading NFTs due to highlight param:', highlightParam)
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

  if (!nftContractAddress) {
    return (
      <AppShell
        title="My NFTs"
        subtitle="Contract not configured"
      >
        <div className="text-center py-12">
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4 text-amber-400">Contract not configured</h2>
            <p className="text-slate-400 mb-2">
              Configure VITE_GIFT_CARD_NFT_ADDRESS in the .env file
            </p>
          </div>
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
            onClick={() => setShowImportInstructions(!showImportInstructions)}
            className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white hover:bg-slate-800/70 hover:border-cyan-500/30 transition-all flex items-center gap-2 text-sm font-medium"
          >
            <Info className="w-4 h-4" />
            Import Guide
          </button>
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

      {showImportInstructions && (
        <div className="mb-6 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
            <ImageIcon className="w-5 h-5" />
            How to import NFT to MetaMask
          </h3>
          <ol className="space-y-2 text-sm text-slate-300">
            <li>1. Open MetaMask</li>
            <li>2. Go to NFTs → Import NFT</li>
            <li>3. Paste the contract address: <code className="bg-slate-800/50 px-2 py-1 rounded-lg">{nftContractAddress}</code></li>
            <li>4. Paste the Token ID of the NFT you want to import</li>
          </ol>
          <button
            onClick={() => copyToClipboard(nftContractAddress, 'Contract')}
            className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-xl text-white text-sm font-medium flex items-center gap-2 transition-all"
          >
            {copied === 'Contract' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copy Contract Address
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-500/30 rounded-2xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {loading && nfts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-4" />
          <p className="text-slate-400">Loading your NFTs...</p>
        </div>
      ) : error ? (
        // IMPORTANT: If error/timeout, show error and DON'T show "You don't have any NFTs yet" and DON'T suggest mint
        <div className="bg-slate-800/50 border border-red-500/20 rounded-2xl p-12 text-center">
          <p className="text-red-400 mb-4 font-medium">
            {error}
          </p>
          <p className="text-sm text-slate-500 mb-4">
            Clique em Refresh para tentar novamente.
          </p>
        </div>
      ) : nfts.length === 0 ? (
        // Only show "You don't have any NFTs yet" if NO error and NO highlight
        <div className="bg-slate-800/50 border border-cyan-500/20 rounded-2xl p-12 text-center">
          {highlightParam ? (
            <p className="text-slate-400 mb-4">
              NFT not found or still loading...
            </p>
          ) : (
            <>
              <p className="text-slate-400 mb-4">
                You don't have any NFTs yet
              </p>
              {/* Only show "Mint an NFT" CTA if no NFTs found, no highlight, no error, and not loading */}
              {!loading && (
                <a
                  href="/mint"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-xl text-white font-medium transition-all shadow-lg shadow-cyan-500/25"
                >
                  Mint an NFT
                </a>
              )}
            </>
          )}
        </div>
      ) : (
        // Hide Mint CTA when NFTs exist - Grid igual ao MintPage
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nfts.map((nft, index) => (
            <motion.div
              key={nft.tokenId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <NFTCard
                nft={nft}
                contractAddress={nftContractAddress!}
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

// Componente NFT Card simples (sem criar arquivo extra)
const NFTCard = React.forwardRef<HTMLDivElement, {
  nft: NFTInfo
  contractAddress: string
  copied: string | null
  onCopy: (text: string, label: string) => void
  isHighlighted?: boolean
}>(({ nft, contractAddress, copied, onCopy, isHighlighted }, ref) => {
  const [metadata, setMetadata] = useState<any>(nft.metadata || null)
  const [metadataError, setMetadataError] = useState(false)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [imageLoadError, setImageLoadError] = useState(false)
  const [useFallback, setUseFallback] = useState(false)

  // Use tokenId as key to ensure each card has its own state
  useEffect(() => {
    // Reset state when tokenId changes (ensures isolation)
    setImageLoadError(false)
    
    // Check if parent marked this NFT to use fallback
    if (nft.useFallbackImage) {
      console.log(`[NFTCard] tokenId=${nft.tokenId}: useFallbackImage flag set, using fallback`)
      setUseFallback(true)
      setMetadataError(false)
      setIsLoadingMetadata(false)
      return
    }
    
    setUseFallback(false)
    
    // If metadata already loaded from parent, use it
    if (nft.metadata) {
      setMetadata(nft.metadata)
      setMetadataError(false)
      // Check if metadata.image is missing
      if (!nft.metadata.image) {
        console.log(`[NFTCard] tokenId=${nft.tokenId}: metadata.image is missing, will use fallback`)
        setUseFallback(true)
      }
      return
    }

    // Otherwise, fetch metadata if tokenURI is available
    if (nft.tokenURI && nft.tokenURI.trim() !== '') {
      setIsLoadingMetadata(true)
      setMetadataError(false)
      
      const fetchMetadata = async () => {
        try {
          console.log(`[NFTCard] Fetching metadata for tokenId=${nft.tokenId}, tokenURI=${nft.tokenURI}`)
          const httpUrl = ipfsToHttp(nft.tokenURI)
          const response = await fetch(httpUrl, {
            headers: { 'Accept': 'application/json' },
          })
          if (response.ok) {
            const data = await response.json()
            console.log(`[NFTCard] Metadata loaded for tokenId=${nft.tokenId}:`, {
              name: data?.name || 'N/A',
              image: data?.image || 'N/A'
            })
            setMetadata(data)
            setMetadataError(false)
            // Check if metadata.image is missing
            if (!data?.image) {
              console.log(`[NFTCard] tokenId=${nft.tokenId}: metadata.image is missing, will use fallback`)
              setUseFallback(true)
            }
          } else {
            console.warn(`[NFTCard] Failed to fetch metadata for tokenId=${nft.tokenId}: HTTP ${response.status}`)
            setMetadataError(true)
            setUseFallback(true)
          }
        } catch (error) {
          console.warn(`[NFTCard] Error fetching metadata for tokenId=${nft.tokenId}:`, error)
          setMetadataError(true)
          setUseFallback(true)
        } finally {
          setIsLoadingMetadata(false)
        }
      }
      fetchMetadata()
    } else {
      // No tokenURI available
      console.log(`[NFTCard] tokenId=${nft.tokenId}: No tokenURI available, will use fallback`)
      setMetadataError(true)
      setIsLoadingMetadata(false)
      setUseFallback(true)
    }
  }, [nft.tokenId, nft.tokenURI, nft.metadata, nft.useFallbackImage]) // Include tokenId, metadata, and useFallbackImage in dependencies

  return (
    <div
      ref={ref}
      className={`rounded-2xl border bg-slate-900/50 backdrop-blur-xl overflow-hidden transition-all ${
        isHighlighted
          ? 'border-cyan-500 shadow-lg shadow-cyan-500/30 scale-105'
          : 'border-cyan-500/25 hover:border-cyan-500/50'
      }`}
    >
      {/* NFT Image - igual ao MintPage */}
      <div className="relative aspect-square bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
        {(metadata?.image && !useFallback && !imageLoadError && !nft.useFallbackImage) ? (
          <img
            src={ipfsToHttp(metadata.image)}
            alt={metadata.name || `NFT #${nft.tokenId}`}
            className="w-full h-full object-cover"
            onError={() => {
              console.warn(`[NFTCard] Image load error for tokenId=${nft.tokenId}, image=${metadata.image}`)
              console.log(`[NFTCard] tokenId=${nft.tokenId}: Switching to fallback image`)
              setImageLoadError(true)
              setUseFallback(true)
            }}
          />
        ) : useFallback || imageLoadError ? (
          <img
            src={getFallbackImage(nft.tokenId)}
            alt={`NFT #${nft.tokenId} (fallback)`}
            className="w-full h-full object-cover"
            onError={() => {
              console.error(`[NFTCard] Fallback image failed to load for tokenId=${nft.tokenId}`)
            }}
          />
        ) : (
          <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center">
            {isLoadingMetadata ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
                <p className="text-xs text-slate-500">Loading metadata...</p>
              </>
            ) : metadataError ? (
              <>
                <ImageIcon className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-xs text-slate-500 text-center px-2">Metadata unavailable</p>
              </>
            ) : (
              <>
                <ImageIcon className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-xs text-slate-500">No image</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* NFT Info - igual ao MintPage */}
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2 text-white">
          {metadata?.name || `NFT #${nft.tokenId}`}
        </h3>
        
        {metadata?.description && (
          <p className="text-slate-400 text-sm mb-4 line-clamp-2">
            {metadata.description}
          </p>
        )}
        
        {metadataError && !metadata && (
          <p className="text-slate-500 text-xs mb-4 italic">
            Metadata unavailable for token #{nft.tokenId}
          </p>
        )}

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

          <a
            href={`${ARCSCAN_BASE_URL}/token/${contractAddress}?a=${nft.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>View on ArcScan</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  )
})

NFTCard.displayName = 'NFTCard'
