import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useReadContract,
} from 'wagmi'
import { decodeEventLog } from 'viem'
import { Sparkles, Loader2, CheckCircle2, ExternalLink, AlertTriangle, Image } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { arcTestnet } from '@/config/chains'
import { CONSTANTS } from '@/config/constants'
import { NFT_ADDRESS, MINTER_ADDRESS } from '@/lib/addresses'

// Import ABI
import FajuARC_ABI from '@/abis/FajuARC.json'

// 3 NFTs da coleção Arc Network
const NFT_OPTIONS = [
  {
    id: 1,
    name: 'Arc Explorer',
    description: 'A brave explorer discovering the Arc Network. The Explorer represents the pioneers who venture into the future of deterministic finality.',
    image: '/assets/nfts/arc_explorer.png',
    nftType: 1, // 1 = Explorer
  },
  {
    id: 2,
    name: 'Arc Builder',
    description: 'A builder creating the future on Arc Network. The Builder represents developers who build innovative dApps on Arc\'s stable infrastructure.',
    image: '/assets/nfts/arc_builder.png',
    nftType: 2, // 2 = Builder
  },
  {
    id: 3,
    name: 'Arc Guardian',
    description: 'A guardian protecting the Arc ecosystem. The Guardian represents the security and stability that Arc Network provides.',
    image: '/assets/nfts/arc_guardian.png',
    nftType: 3, // 3 = Guardian
  },
]

interface MintPageProps {
  contractAddress?: `0x${string}`
}

export function MintPage({ contractAddress }: MintPageProps) {
  const { address, isConnected, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const navigate = useNavigate()
  const [mintingId, setMintingId] = useState<number | null>(null)
  const [mintedTokens, setMintedTokens] = useState<Record<number, string>>({})
  const [hasMinted, setHasMinted] = useState<Record<number, boolean>>({})

  // IMPORTANTE:
  // - use writeContractAsync + await para capturar rejeição/erro de carteira corretamente
  // - useWaitForTransactionReceipt só deve rodar quando existir hash (evita estados/travamentos estranhos)
  const { writeContractAsync, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  })

  // Verificar se já mintou cada NFT
  const { data: hasMinted1 } = useReadContract({
    address: contractAddress,
    abi: FajuARC_ABI,
    functionName: 'hasMintedType',
    args: address ? [address, 1n] : undefined,
    query: { enabled: !!address && !!contractAddress && isConnected },
  })

  const { data: hasMinted2 } = useReadContract({
    address: contractAddress,
    abi: FajuARC_ABI,
    functionName: 'hasMintedType',
    args: address ? [address, 2n] : undefined,
    query: { enabled: !!address && !!contractAddress && isConnected },
  })

  const { data: hasMinted3 } = useReadContract({
    address: contractAddress,
    abi: FajuARC_ABI,
    functionName: 'hasMintedType',
    args: address ? [address, 3n] : undefined,
    query: { enabled: !!address && !!contractAddress && isConnected },
  })

  // Atualizar estado quando os dados mudarem
  useEffect(() => {
    if (hasMinted1 !== undefined && hasMinted1 !== null) setHasMinted(prev => ({ ...prev, 1: !!hasMinted1 }))
    if (hasMinted2 !== undefined && hasMinted2 !== null) setHasMinted(prev => ({ ...prev, 2: !!hasMinted2 }))
    if (hasMinted3 !== undefined && hasMinted3 !== null) setHasMinted(prev => ({ ...prev, 3: !!hasMinted3 }))
  }, [hasMinted1, hasMinted2, hasMinted3])

  const handleMint = async (nftId: number) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    if (chain?.id !== arcTestnet.id) {
      toast.error('Please switch to Arc Testnet')
      try {
        switchChain({ chainId: arcTestnet.id })
      } catch (err) {
        console.error('Failed to switch chain:', err)
      }
      return
    }

    if (!contractAddress) {
      toast.error('NFT contract address not configured')
      return
    }

    const nft = NFT_OPTIONS.find(n => n.id === nftId)
    if (!nft) return

    // Verificar se já mintou
    if (hasMinted[nft.nftType]) {
      toast.error('You have already minted this NFT')
      return
    }

    try {
      setMintingId(nftId)
      // Use MINTER_ADDRESS if available, otherwise fallback to contractAddress (NFT contract)
      const mintAddress = MINTER_ADDRESS || contractAddress
      if (!mintAddress) {
        toast.error('Minter contract address not configured')
        return
      }
      
      await writeContractAsync({
        address: mintAddress,
        abi: FajuARC_ABI,
        functionName: 'mint',
        args: [BigInt(nft.nftType)],
      })
    } catch (err: any) {
      console.error('Mint error:', err)
      // Mensagens mais úteis (MetaMask/Rabby/viem)
      const msg =
        err?.shortMessage ||
        err?.details ||
        err?.message ||
        'Failed to mint NFT'
      toast.error(msg)
      setMintingId(null)
    }
  }

  // Se ocorrer erro em qualquer etapa (write/receipt), não deixe o UI preso em estado de mint.
  useEffect(() => {
    if (error) {
      setMintingId(null)
    }
  }, [error])

  // Quando a transação for confirmada
  useEffect(() => {
    if (isSuccess && hash && receipt && mintingId && address) {
      const nft = NFT_OPTIONS.find(n => n.id === mintingId)
      if (nft) {
        // Extract tokenId from Transfer event (ERC-721 standard)
        // IMPORTANT: Filter logs where address == NFT_ADDRESS (not MINTER_ADDRESS)
        let tokenId: string | undefined = undefined
        
        if (receipt.logs && receipt.logs.length > 0 && NFT_ADDRESS) {
          try {
            // Filter logs from NFT contract (not minter)
            if (!NFT_ADDRESS) {
              console.warn('NFT_ADDRESS not configured, cannot extract tokenId from Transfer event')
            } else {
              const nftLogs = receipt.logs.filter((log: any) => {
                if (!log.address || !NFT_ADDRESS) return false
                try {
                  const logAddress = log.address.toLowerCase()
                  const nftAddress = NFT_ADDRESS.toLowerCase()
                  return logAddress === nftAddress
                } catch {
                  return false
                }
              })

              // Decode Transfer events from NFT contract logs
              for (const log of nftLogs) {
                try {
                  const decoded = decodeEventLog({
                    abi: FajuARC_ABI,
                    data: log.data,
                    topics: log.topics,
                  })

                  if (decoded.eventName === 'Transfer' && decoded.args) {
                    const args = decoded.args as {
                      from?: `0x${string}`
                      to?: `0x${string}`
                      tokenId?: bigint
                    }
                    const from = args.from
                    const to = args.to
                    const decodedTokenId = args.tokenId

                    // Check if this Transfer is a mint (from == 0x0) and to == user address
                    if (from && to && decodedTokenId) {
                      const zeroAddress = '0x0000000000000000000000000000000000000000'
                      const isMint = from.toLowerCase() === zeroAddress.toLowerCase()
                      const isToUser = to.toLowerCase() === address.toLowerCase()

                      if (isMint && isToUser) {
                        tokenId = decodedTokenId.toString()
                        break
                      }
                    }
                  }
                } catch (error) {
                  // Not a Transfer event or decode failed, continue
                  continue
                }
              }
            }
          } catch (error) {
            console.error('Error extracting tokenId from Transfer event:', error)
          }
        }
        
        setMintedTokens(prev => ({ ...prev, [mintingId]: hash }))
        setHasMinted(prev => ({ ...prev, [nft.nftType]: true }))
        
        if (tokenId) {
          console.log('✅ NFT minted successfully! Token ID:', tokenId)
          
          // Save to localStorage
          try {
            localStorage.setItem('lastMintedTokenId', tokenId)
            localStorage.setItem('lastMintedOwner', address)
            localStorage.setItem('lastMintedTimestamp', Date.now().toString())
          } catch (e) {
            console.warn('Failed to save to localStorage:', e)
          }
          
          toast.success(`${nft.name} minted successfully! Token ID: ${tokenId} 🎉`, {
            duration: 5000,
          })
          
          // Navigate to MyNFTs with highlight after a short delay
          setTimeout(() => {
            navigate(`/my-nfts?owner=${address}&highlight=${tokenId}`)
          }, 1500)
        } else {
          console.log('✅ NFT minted successfully! (Token ID not found in logs)')
          toast.success(`${nft.name} minted successfully! 🎉`)
        }
      }
      setMintingId(null)
    }
  }, [isSuccess, hash, receipt, mintingId, contractAddress, address, navigate])

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <Sparkles className="h-16 w-16 mx-auto text-cyan-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
        <p className="text-slate-400">Connect your wallet to start minting NFTs</p>
      </div>
    )
  }

  if (chain?.id !== arcTestnet.id) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="h-16 w-16 mx-auto text-yellow-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Wrong Network</h2>
        <p className="text-slate-400 mb-6">Please switch to Arc Testnet to mint NFTs</p>
        <button
          onClick={() => switchChain({ chainId: arcTestnet.id })}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all"
        >
          Switch to Arc Testnet
        </button>
      </div>
    )
  }

  if (!contractAddress) {
    return (
      <div className="text-center py-20 px-4">
        <AlertTriangle className="h-16 w-16 mx-auto text-yellow-400 mb-4" />
        <h2 className="text-2xl font-bold mb-4 text-white">Contract Not Configured</h2>
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-slate-300 mb-6">
            NFT contract address is not set. Please deploy the contract first and then configure it.
          </p>
          
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6 text-left">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4">📋 Steps to Deploy:</h3>
            <ol className="space-y-3 text-slate-300 text-sm list-decimal list-inside">
              <li className="mb-2">
                <span className="font-semibold text-white">Deploy the contract:</span>
                <code className="block mt-1 p-2 bg-slate-950 rounded border border-slate-800 text-cyan-400 font-mono text-xs">
                  cd "C:\Users\Fabio Souza\ARC"<br />
                  npx hardhat run scripts/deploy-arc-collection.ts --network arcTestnet
                </code>
              </li>
              <li className="mb-2">
                <span className="font-semibold text-white">Copy the contract address</span> from the deploy output
              </li>
              <li className="mb-2">
                <span className="font-semibold text-white">Add to .env file:</span>
                <code className="block mt-1 p-2 bg-slate-950 rounded border border-slate-800 text-cyan-400 font-mono text-xs">
                  VITE_ARC_COLLECTION_ADDRESS=0x... (your contract address)
                </code>
              </li>
              <li>
                <span className="font-semibold text-white">Restart the dev server</span> to load the new environment variable
              </li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Mint Your <span className="text-cyan-400">Arc NFTs</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Each wallet can mint maximum 1 NFT per type. Choose from 3 unique Arc Network NFTs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {NFT_OPTIONS.map((nft) => {
          const isMinting = mintingId === nft.id
          const isProcessing = isMinting && (isPending || isConfirming)
          const txHash = mintedTokens[nft.id]
          const alreadyMinted = hasMinted[nft.nftType] || !!txHash

          return (
            <motion.div
              key={nft.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: nft.id * 0.1 }}
              className="rounded-2xl border border-cyan-500/25 bg-slate-900/50 backdrop-blur-xl overflow-hidden hover:border-cyan-500/50 transition-all"
            >
              {/* NFT Image */}
              <div className="relative aspect-square bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                <img
                  src={nft.image}
                  alt={nft.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback para placeholder se imagem não existir
                    e.currentTarget.src = `https://via.placeholder.com/400x400/06b6d4/ffffff?text=${encodeURIComponent(nft.name)}`
                  }}
                />
                {alreadyMinted && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-green-500 rounded-full p-2">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* NFT Info */}
              <div className="p-6">
                <h3 className="text-xl font-bold mb-2">{nft.name}</h3>
                <p className="text-slate-400 text-sm mb-4">{nft.description}</p>

                {/* Mint Button */}
                <button
                  onClick={() => handleMint(nft.id)}
                  disabled={isProcessing || alreadyMinted}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{isPending ? 'Confirm in wallet...' : 'Minting...'}</span>
                    </>
                  ) : alreadyMinted ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      <span>Minted ✔</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      <span>Mint NFT</span>
                    </>
                  )}
                </button>

                {/* Transaction Hash and Navigation */}
                {txHash && (
                  <div className="mt-3 space-y-2">
                    <a
                      href={`${CONSTANTS.LINKS.explorer}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <span>View on Explorer</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Link
                      to="/my-nfts"
                      className="flex items-center justify-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <Image className="h-3 w-3" />
                      <span>View My NFTs</span>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-6 rounded-lg border border-red-500/25 bg-red-500/10 p-4 text-center">
          <p className="text-red-400">{error.message}</p>
        </div>
      )}
    </div>
  )
}
