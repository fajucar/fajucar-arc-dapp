import { Routes, Route, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'
import { Hero } from '@/components/Hero'
import { NetworkStats } from '@/components/Stats'
import { WhyArc } from '@/components/Comparison'
import { MintPage } from '@/components/Mint/MintPage'
import { SwapPage } from '@/pages/SwapPage'
import { PoolsPage } from '@/pages/PoolsPage'
import { MyNFTsPage } from '@/pages/MyNFTsPage'
import { CONTRACT_ADDRESSES } from '@/config/contracts'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getAddress } from 'ethers'

function HomePage() {
  try {
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

        <ErrorBoundary>
          <Hero onNavigateToMint={() => {
            // Use window.location instead of navigate to avoid dependency on router
            try {
              window.location.href = '/mint'
            } catch {
              window.location.reload()
            }
          }} />
        </ErrorBoundary>

        <ErrorBoundary>
          <section className="py-16 px-4 bg-slate-950">
            <div className="max-w-6xl mx-auto mb-6 text-center">
              <h3 className="text-2xl font-bold mb-2">Network Statistics</h3>
              <p className="text-sm text-slate-400">
                Real-time data from Arc Testnet RPC. Click on cards to verify on explorer.
              </p>
            </div>
            <NetworkStats />
          </section>
        </ErrorBoundary>

        <ErrorBoundary>
          <WhyArc />
        </ErrorBoundary>
      </>
    )
  } catch (error) {
    // Fallback if HomePage itself breaks
    console.error('HomePage error:', error)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error loading home page</h1>
          <p className="text-slate-400 mb-6">Please reload the page or try again later.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}

function MintPageWrapper() {
  // Get contract address - try VITE_ARC_COLLECTION_ADDRESS first, then fallback to VITE_GIFT_CARD_NFT_ADDRESS
  // Safe access - never throws
  let arcCollectionEnv: string | undefined = undefined
  try {
    arcCollectionEnv = import.meta.env.VITE_ARC_COLLECTION_ADDRESS
  } catch {
    // Ignore - env var may not exist
  }
  
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
      console.warn('Invalid address format:', error)
      // Continue - don't break render
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
          <Link
            to="/"
            className="text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            ← Back to Home
          </Link>
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
    <ErrorBoundary>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route 
              path="/" 
              element={
                <ErrorBoundary>
                  <HomePage />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/mint" 
              element={
                <ErrorBoundary>
                  <MintPageWrapper />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/swap" 
              element={
                <ErrorBoundary>
                  <SwapPage />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/pools" 
              element={
                <ErrorBoundary>
                  <PoolsPage />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/my-nfts" 
              element={
                <ErrorBoundary>
                  <MyNFTsPage />
                </ErrorBoundary>
              } 
            />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </ErrorBoundary>
  )
}

export default App
