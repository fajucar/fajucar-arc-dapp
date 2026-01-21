import { Routes, Route, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'
import { Hero } from '@/components/Hero'
import { NetworkStats } from '@/components/Stats'
import { TransactionDemo } from '@/components/Demo'
import { WhyArc } from '@/components/Comparison'
import { MintPage } from '@/components/Mint/MintPage'
import { SwapPage } from '@/pages/SwapPage'
import { PoolsPage } from '@/pages/PoolsPage'
import { MyNFTsPage } from '@/pages/MyNFTsPage'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { getAddress } from 'ethers'

function HomePage() {
  const navigate = useNavigate()
  
  return (
    <>
      <Helmet>
        <title>Arc Network - Blockchain for Stablecoin Finance</title>
        <meta 
          name="description" 
          content="Purpose-built Layer-1 blockchain with deterministic finality, USDC native gas, and stable fees. Built for institutional-grade stablecoin finance." 
        />
        <meta property="og:title" content="Arc Network" />
        <meta property="og:description" content="The future of stablecoin finance" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Arc Network" />
        <meta name="twitter:description" content="Purpose-built blockchain for stablecoin finance" />
      </Helmet>

      <Hero onNavigateToMint={() => navigate('/mint')} />
      
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Try it <span className="text-cyan-400">Yourself</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Experience instant transactions with predictable USDC fees
          </p>
        </div>
        <TransactionDemo />
      </section>

      <section className="py-16 px-4 bg-slate-950">
        <div className="max-w-6xl mx-auto mb-6 text-center">
          <h3 className="text-2xl font-bold mb-2">Network Statistics</h3>
          <p className="text-sm text-slate-400">
            Real-time data from Arc Testnet RPC. Click on cards to verify on explorer.
          </p>
        </div>
        <NetworkStats />
      </section>

      <WhyArc />
    </>
  )
}

function MintPageWrapper() {
  const navigate = useNavigate()
  
  // Get contract address - try VITE_ARC_COLLECTION_ADDRESS first, then fallback to VITE_GIFT_CARD_NFT_ADDRESS
  const arcCollectionEnv = import.meta.env.VITE_ARC_COLLECTION_ADDRESS
  const giftCardNFT = CONTRACT_ADDRESSES.GIFT_CARD_NFT
  
  let contractAddress: `0x${string}` | undefined = undefined
  
  // Check if VITE_ARC_COLLECTION_ADDRESS is valid (not placeholder)
  if (arcCollectionEnv && 
      typeof arcCollectionEnv === 'string' &&
      arcCollectionEnv.trim() !== '' &&
      !arcCollectionEnv.includes('SEU_CONTRATO') &&
      !arcCollectionEnv.includes('YOUR_CONTRACT') &&
      /^0x[a-fA-F0-9]{40}$/i.test(arcCollectionEnv.trim())) {
    try {
      // Convert to lowercase first, then apply checksum (EIP-55)
      const normalized = arcCollectionEnv.trim().toLowerCase()
      contractAddress = getAddress(normalized) as `0x${string}`
    } catch (error) {
      console.error('Invalid address format:', error)
    }
  } 
  // Use VITE_GIFT_CARD_NFT_ADDRESS if available and valid (already in checksum from CONTRACT_ADDRESSES)
  else if (giftCardNFT && 
           giftCardNFT !== '' && 
           giftCardNFT !== '0x0000000000000000000000000000000000000000' &&
           /^0x[a-fA-F0-9]{40}$/i.test(giftCardNFT)) {
    contractAddress = giftCardNFT as `0x${string}`
  }
  
  return (
    <>
      <div className="py-8 px-4 border-b border-slate-800">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
      <MintPage 
        contractAddress={contractAddress}
      />
    </>
  )
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/mint" element={<MintPageWrapper />} />
        <Route path="/swap" element={<SwapPage />} />
        <Route path="/pools" element={<PoolsPage />} />
        <Route path="/my-nfts" element={<MyNFTsPage />} />
      </Routes>
    </Layout>
  )
}

export default App
