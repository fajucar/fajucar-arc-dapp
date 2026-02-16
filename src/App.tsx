import { Routes, Route, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'
import { Hero } from '@/components/Hero'
import { NetworkStats } from '@/components/Stats'
import { WhyArc } from '@/components/Comparison'
import { MintPage } from '@/components/Mint/MintPage'
import { ArcCollectionGallery } from '@/components/ArcCollectionGallery'
import { SwapPage } from '@/pages/SwapPage'
import { PoolsPage } from '@/pages/PoolsPage'
import { MyNFTsPage } from '@/pages/MyNFTsPage'
import { MyPoolsPage } from '@/pages/MyPoolsPage'
import { ArcDexTestPool } from '@/pages/ArcDexTestPool'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ConfigErrorBanner } from '@/components/ConfigErrorBanner'

function HomePage() {
  try {
    return (
      <>
        <Helmet>
          <title>FajuARC - DeFi on Arc Testnet</title>
          <meta 
            name="description" 
            content="FajuARC: Swap, mint NFTs, and manage liquidity on Arc Testnet. Premium DeFi experience with USDC and EURC." 
          />
          <meta property="og:title" content="FajuARC" />
          <meta property="og:description" content="Premium DeFi on Arc Testnet" />
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
          <section className="py-8 px-4">
            <div className="max-w-6xl mx-auto mb-3 text-center">
              <h3 className="text-lg font-semibold tracking-tight mb-1">Network Statistics</h3>
              <p className="text-[10px] text-slate-400">
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
  try {
    return (
      <>
        <div className="py-8 px-4 border-b border-slate-800">
          <div className="max-w-6xl mx-auto">
            <Link to="/" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
        <MintPage />
      </>
    )
  } catch (error) {
    console.error('MintPageWrapper error:', error)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error loading mint page</h1>
          <p className="text-slate-400 mb-6">{String(error)}</p>
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

function MintGalleryWrapper() {
  try {
    return (
      <>
        <div className="py-8 px-4 border-b border-slate-800">
          <div className="max-w-6xl mx-auto">
            <Link to="/" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              ← Back to Home
            </Link>
          </div>
        </div>
        <div className="max-w-6xl mx-auto py-8 px-4">
          <ArcCollectionGallery />
        </div>
      </>
    )
  } catch (error) {
    console.error('MintGalleryWrapper error:', error)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error loading mint page</h1>
          <p className="text-slate-400 mb-6">{String(error)}</p>
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

function App() {
  return (
    <ErrorBoundary>
      <ConfigErrorBanner />
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
                  <MintGalleryWrapper />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/mint-legacy" 
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
            <Route 
              path="/my-pools" 
              element={
                <ErrorBoundary>
                  <MyPoolsPage />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/arc-dex" 
              element={
                <ErrorBoundary>
                  <ArcDexTestPool />
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
