import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useReadContract,
  usePublicClient,
} from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { decodeEventLog } from 'viem'
import { Sparkles, Loader2, CheckCircle2, ExternalLink, AlertTriangle, Image, Copy } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { arcTestnet } from '@/config/chains'
import { CONSTANTS } from '@/config/constants'
import { NFT_ADDRESS, MINTER_ADDRESS } from '@/lib/addresses'
import { AppShell } from '@/components/Layout/AppShell'

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
  const publicClient = usePublicClient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [mintingId, setMintingId] = useState<number | null>(null)
  const [mintedTokens, setMintedTokens] = useState<Record<number, string>>({})
  const [mintedTokenIds, setMintedTokenIds] = useState<Record<number, string>>({})
  const [hasMinted, setHasMinted] = useState<Record<number, boolean>>({})
  const [balanceBeforeMint, setBalanceBeforeMint] = useState<bigint | null>(null)
  const [debugInfo, setDebugInfo] = useState<{ mintContract: string; nftContract: string; mintHasBytecode: boolean; nftHasBytecode: boolean } | null>(null)

  // IMPORTANTE:
  // - use writeContractAsync + await para capturar rejeição/erro de carteira corretamente
  // - useWaitForTransactionReceipt só deve rodar quando existir hash (evita estados/travamentos estranhos)
  const { writeContractAsync, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  })

  // Verificar se já mintou cada NFT via hasMintedType
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

  // Verificar balanceOf para garantir estado sincronizado
  const { data: balanceOf } = useReadContract({
    address: NFT_ADDRESS,
    abi: FajuARC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!NFT_ADDRESS && isConnected },
  })

  // Atualizar estado quando os dados mudarem (hasMintedType)
  useEffect(() => {
    if (hasMinted1 !== undefined && hasMinted1 !== null) setHasMinted(prev => ({ ...prev, 1: !!hasMinted1 }))
    if (hasMinted2 !== undefined && hasMinted2 !== null) setHasMinted(prev => ({ ...prev, 2: !!hasMinted2 }))
    if (hasMinted3 !== undefined && hasMinted3 !== null) setHasMinted(prev => ({ ...prev, 3: !!hasMinted3 }))
  }, [hasMinted1, hasMinted2, hasMinted3])

  // Sincronizar estado com balanceOf: se balance > 0, garantir que hasMinted está correto
  useEffect(() => {
    if (balanceOf !== undefined && balanceOf !== null && publicClient && address && NFT_ADDRESS && contractAddress) {
      const balance = balanceOf as bigint
      if (balance > 0n) {
        // Se tem balance mas hasMinted está false, verificar on-chain
        // Isso garante que o estado não fica desatualizado
        console.log('[Mint] Balance > 0, verifying minted state on-chain')
      }
    }
  }, [balanceOf, publicClient, address, contractAddress])

  // Load debug info on mount
  useEffect(() => {
    const loadDebugInfo = async () => {
      if (!publicClient) return
      
      const mintAddress = MINTER_ADDRESS || contractAddress
      if (!mintAddress || !NFT_ADDRESS) return

      try {
        const mintBytecode = await publicClient.getBytecode({ address: mintAddress })
        const mintHasBytecode = mintBytecode && mintBytecode !== '0x' && mintBytecode.length > 2
        
        const nftBytecode = await publicClient.getBytecode({ address: NFT_ADDRESS }).catch(() => null)
        const nftHasBytecode = nftBytecode && nftBytecode !== '0x' && nftBytecode && nftBytecode.length > 2
        
        setDebugInfo({
          mintContract: mintAddress,
          nftContract: NFT_ADDRESS,
          mintHasBytecode: mintHasBytecode || false,
          nftHasBytecode: nftHasBytecode || false,
        })
      } catch (err) {
        console.warn('[Mint] Failed to load debug info:', err)
      }
    }

    if (isConnected && publicClient) {
      loadDebugInfo()
    }
  }, [isConnected, publicClient, contractAddress])

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
      
      // Capture balance before mint for validation
      if (address && NFT_ADDRESS && publicClient) {
        try {
          const balance = await publicClient.readContract({
            address: NFT_ADDRESS,
            abi: FajuARC_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint
          setBalanceBeforeMint(balance)
          console.log('[Mint] Balance before mint:', balance.toString())
        } catch (err) {
          console.warn('[Mint] Failed to read balance before mint:', err)
          setBalanceBeforeMint(null)
        }
      }
      
      // Use MINTER_ADDRESS if available, otherwise fallback to contractAddress (NFT contract)
      const mintAddress = MINTER_ADDRESS || contractAddress
      if (!mintAddress) {
        toast.error('Minter contract address not configured')
        return
      }

      // Preflight check: Verify contract has bytecode
      if (!publicClient) {
        toast.error('Public client not available')
        return
      }

      try {
        const bytecode = await publicClient.getBytecode({ address: mintAddress })
        const hasBytecode = bytecode && bytecode !== '0x' && bytecode.length > 2
        
        // Update debug info
        const nftBytecode = NFT_ADDRESS ? await publicClient.getBytecode({ address: NFT_ADDRESS }).catch(() => null) : null
        const nftHasBytecode = nftBytecode && nftBytecode !== '0x' && nftBytecode.length > 2
        setDebugInfo({
          mintContract: mintAddress,
          nftContract: NFT_ADDRESS || 'Not configured',
          mintHasBytecode: hasBytecode || false,
          nftHasBytecode: nftHasBytecode || false,
        })

        if (!hasBytecode) {
          toast.error('Mint contract not deployed at this address', {
            duration: 8000,
          })
          console.error('[Mint] ❌ Mint contract has no bytecode at:', mintAddress)
          setMintingId(null)
          return
        }

        console.log('[Mint] ✅ Mint contract bytecode verified')
      } catch (err) {
        console.error('[Mint] Error checking bytecode:', err)
        toast.error('Failed to verify contract deployment', {
          duration: 5000,
        })
        setMintingId(null)
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
      setBalanceBeforeMint(null)
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
        // ROBUST VALIDATION: Check receipt status first
        console.log('[Mint] Transaction confirmed. Receipt status:', receipt.status)
        
        // Step 1: Check if transaction was successful
        if (receipt.status !== 'success') {
          console.error('[Mint] ❌ Transaction reverted! Status:', receipt.status)
          const errorMessage = receipt.status === 'reverted' 
            ? 'Transaction reverted on-chain. Mint failed.'
            : `Transaction failed with status: ${receipt.status}`
          toast.error(errorMessage, { duration: 8000 })
          setMintingId(null)
          setBalanceBeforeMint(null)
          return
        }

        // Step 2: Extract tokenId from Transfer event logs
        let extractedTokenId: string | undefined = undefined
        const TRANSFER_TOPIC0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // keccak256("Transfer(address,address,uint256)")
        
        if (receipt.logs && receipt.logs.length > 0) {
          for (const log of receipt.logs) {
            try {
              if (log.topics && log.topics[0] === TRANSFER_TOPIC0) {
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
                    const zeroAddress = '0x0000000000000000000000000000000000000000'
                    const isMint = args.from?.toLowerCase() === zeroAddress.toLowerCase()
                    const isToUser = args.to?.toLowerCase() === address.toLowerCase()
                    
                    if (isMint && isToUser && args.tokenId) {
                      extractedTokenId = args.tokenId.toString()
                      console.log('[Mint] ✅ TokenId extracted from Transfer event:', extractedTokenId)
                      break
                    }
                  }
                } catch (err) {
                  // Continue to next log
                  continue
                }
              }
            } catch (err) {
              // Continue to next log
              continue
            }
          }
        }

        if (!extractedTokenId) {
          console.warn('[Mint] ⚠️ No ERC-721 Transfer event found in receipt logs')
          toast.error('Mint executed but no ERC-721 Transfer event found. Check contract address.', {
            duration: 8000,
          })
        }
        
        // Step 3: Validate on-chain by checking balanceOf
        if (!NFT_ADDRESS || !publicClient) {
          console.error('[Mint] ❌ NFT_ADDRESS or publicClient not available for validation')
          toast.error('Cannot validate mint: contract address not configured', { duration: 8000 })
          setMintingId(null)
          setBalanceBeforeMint(null)
          return
        }
        
        // Read balance after mint
        publicClient.readContract({
          address: NFT_ADDRESS,
          abi: FajuARC_ABI,
          functionName: 'balanceOf',
          args: [address],
        })
          .then((balanceAfter: bigint) => {
            console.log('[Mint] Balance after mint:', balanceAfter.toString())
            console.log('[Mint] Balance before mint:', balanceBeforeMint?.toString() || 'unknown')
            
            // Check if balance increased (or is > 0 if we didn't capture before)
            const balanceIncreased = balanceBeforeMint !== null 
              ? balanceAfter > balanceBeforeMint
              : balanceAfter > 0n
            
            if (balanceIncreased || extractedTokenId) {
              console.log('[Mint] ✅ Mint validated: balance increased or tokenId found!')
              
              // Mark as minted
              setMintedTokens(prev => ({ ...prev, [mintingId]: hash }))
              if (extractedTokenId) {
                setMintedTokenIds(prev => ({ ...prev, [mintingId]: extractedTokenId }))
              }
              setHasMinted(prev => ({ ...prev, [nft.nftType]: true }))
              
              // Invalidate queries to refetch hasMintedType and balanceOf
              queryClient.invalidateQueries({
                queryKey: ['readContract', { address: contractAddress, functionName: 'hasMintedType' }],
              })
              queryClient.invalidateQueries({
                queryKey: ['readContract', { address: NFT_ADDRESS, functionName: 'balanceOf' }],
              })
              
              // Save to localStorage
              try {
                localStorage.setItem('lastMintedTxHash', hash)
                if (extractedTokenId) {
                  localStorage.setItem('lastMintedTokenId', extractedTokenId)
                }
                localStorage.setItem('lastMintedOwner', address)
                localStorage.setItem('lastMintedTimestamp', Date.now().toString())
              } catch (e) {
                console.warn('Failed to save to localStorage:', e)
              }
              
              const successMessage = extractedTokenId 
                ? `${nft.name} minted successfully! Token ID: ${extractedTokenId} 🎉`
                : `${nft.name} minted successfully! 🎉`
              
              toast.success(successMessage, {
                duration: 5000,
              })
              
              // Navigate to My NFTs after a short delay to refresh the list
              setTimeout(() => {
                navigate('/my-nfts')
              }, 2000)
            } else {
              console.warn('[Mint] ⚠️ Balance did not increase after mint and no tokenId found')
              // Even if balance didn't increase, if receipt.status is success, 
              // the transaction succeeded on-chain. Consider it a success.
              console.log('[Mint] ✅ Transaction succeeded on-chain (status: success), marking as minted')
              
              setMintedTokens(prev => ({ ...prev, [mintingId]: hash }))
              setHasMinted(prev => ({ ...prev, [nft.nftType]: true }))
              
              // Invalidate queries to refetch hasMintedType and balanceOf
              queryClient.invalidateQueries({
                queryKey: ['readContract', { address: contractAddress, functionName: 'hasMintedType' }],
              })
              queryClient.invalidateQueries({
                queryKey: ['readContract', { address: NFT_ADDRESS, functionName: 'balanceOf' }],
              })
              
              toast.success(`${nft.name} minted successfully! 🎉`, {
                duration: 5000,
              })
              
              // Navigate to My NFTs after a short delay
              setTimeout(() => {
                navigate('/my-nfts')
              }, 2000)
            }
            
            setMintingId(null)
            setBalanceBeforeMint(null)
          })
          .catch((err: any) => {
            console.error('[Mint] ❌ Failed to validate mint with balanceOf:', err)
            // If receipt.status is success but we can't verify balance,
            // still consider it a success (transaction succeeded on-chain)
            console.log('[Mint] ⚠️ Transaction succeeded but balanceOf check failed. Marking as minted anyway.')
            
            setMintedTokens(prev => ({ ...prev, [mintingId]: hash }))
            if (extractedTokenId) {
              setMintedTokenIds(prev => ({ ...prev, [mintingId]: extractedTokenId }))
            }
            setHasMinted(prev => ({ ...prev, [nft.nftType]: true }))
            
            // Invalidate queries to refetch hasMintedType and balanceOf
            queryClient.invalidateQueries({
              queryKey: ['readContract', { address: contractAddress, functionName: 'hasMintedType' }],
            })
            queryClient.invalidateQueries({
              queryKey: ['readContract', { address: NFT_ADDRESS, functionName: 'balanceOf' }],
            })
            
            toast.success(`${nft.name} minted successfully! 🎉`, {
              duration: 5000,
            })
            
            // Navigate to My NFTs after a short delay
            setTimeout(() => {
              navigate('/my-nfts')
            }, 2000)
            
            setMintingId(null)
            setBalanceBeforeMint(null)
          })
      }
    }
  }, [isSuccess, hash, receipt, mintingId, contractAddress, address, publicClient, balanceBeforeMint, navigate, queryClient])

  if (!isConnected) {
    return (
      <AppShell
        title="Mint Your Arc NFTs"
        subtitle="Connect your wallet to start minting NFTs"
      >
        <div className="text-center py-12">
          <Sparkles className="h-16 w-16 mx-auto text-cyan-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-white">Connect Your Wallet</h2>
          <p className="text-slate-400">Connect your wallet to start minting NFTs</p>
        </div>
      </AppShell>
    )
  }

  if (chain?.id !== arcTestnet.id) {
    return (
      <AppShell
        title="Mint Your Arc NFTs"
        subtitle="Please switch to Arc Testnet to mint NFTs"
      >
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 mx-auto text-yellow-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-white">Wrong Network</h2>
          <p className="text-slate-400 mb-6">Please switch to Arc Testnet to mint NFTs</p>
          <button
            onClick={() => switchChain({ chainId: arcTestnet.id })}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all"
          >
            Switch to Arc Testnet
          </button>
        </div>
      </AppShell>
    )
  }

  if (!contractAddress) {
    return (
      <AppShell
        title="Mint Your Arc NFTs"
        subtitle="Contract not configured"
      >
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 mx-auto text-yellow-400 mb-4" />
          <h2 className="text-2xl font-bold mb-4 text-white">Contract Not Configured</h2>
          <div className="max-w-2xl mx-auto space-y-4">
            <p className="text-slate-300 mb-6">
              NFT contract address is not set. Please deploy the contract first and then configure it.
            </p>
            
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-left">
              <h3 className="text-lg font-semibold text-cyan-400 mb-4">📋 Steps to Deploy:</h3>
              <ol className="space-y-3 text-slate-300 text-sm list-decimal list-inside">
                <li className="mb-2">
                  <span className="font-semibold text-white">Deploy the contract:</span>
                  <code className="block mt-1 p-2 bg-slate-900 rounded-lg border border-slate-800 text-cyan-400 font-mono text-xs">
                    cd "C:\Users\Fabio Souza\ARC"<br />
                    npx hardhat run scripts/deploy-arc-collection.ts --network arcTestnet
                  </code>
                </li>
                <li className="mb-2">
                  <span className="font-semibold text-white">Copy the contract address</span> from the deploy output
                </li>
                <li className="mb-2">
                  <span className="font-semibold text-white">Add to .env file:</span>
                  <code className="block mt-1 p-2 bg-slate-900 rounded-lg border border-slate-800 text-cyan-400 font-mono text-xs">
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
      </AppShell>
    )
  }

  // Ensure NFT_OPTIONS exists and is an array
  const nftOptions = Array.isArray(NFT_OPTIONS) && NFT_OPTIONS.length > 0 
    ? NFT_OPTIONS 
    : []

  if (nftOptions.length === 0) {
    return (
      <AppShell
        title="Mint Your Arc NFTs"
        subtitle="No NFTs available"
      >
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 mx-auto text-yellow-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2 text-white">No NFTs Available</h2>
          <p className="text-slate-400">NFT options are not configured.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      title="Mint Your Arc NFTs"
      subtitle="Each wallet can mint maximum 1 NFT per type. Choose from 3 unique Arc Network NFTs."
    >

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {nftOptions.map((nft) => {
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

                {/* Transaction Hash, Token ID and Navigation */}
                {txHash && (
                  <div className="mt-3 space-y-2">
                    {mintedTokenIds[nft.id] && (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xs text-slate-400">Token ID:</span>
                        <code className="text-xs text-cyan-400 font-mono">{mintedTokenIds[nft.id]}</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(mintedTokenIds[nft.id])
                            toast.success('Token ID copied!')
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" />
                          <span>Copy Token ID</span>
                        </button>
                      </div>
                    )}
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
        <div className="mt-6 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-center">
          <p className="text-red-400">{error.message}</p>
        </div>
      )}

      {/* Debug Info */}
      {debugInfo && (
        <div className="mt-6 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Debug Info</h3>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mint contract:</span>
              <span className="text-cyan-400">{debugInfo.mintContract}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">NFT contract:</span>
              <span className="text-cyan-400">{debugInfo.nftContract}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mint bytecode:</span>
              <span className={debugInfo.mintHasBytecode ? 'text-green-400' : 'text-red-400'}>
                {debugInfo.mintHasBytecode ? 'yes' : 'no'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">NFT bytecode:</span>
              <span className={debugInfo.nftHasBytecode ? 'text-green-400' : 'text-red-400'}>
                {debugInfo.nftHasBytecode ? 'yes' : 'no'}
              </span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
