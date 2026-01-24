import { useState } from 'react'
import { Menu, X, Image, Sparkles, ArrowLeftRight, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@/components/Web3/ConnectButton'
import { motion, AnimatePresence } from 'framer-motion'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isConnected } = useAccount()

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold">
            A
          </div>
          <span className="text-xl font-bold">Arc Network</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-3">
          {/* Mint NFTs Button */}
          <Link
            to="/mint"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all text-sm shadow-lg shadow-cyan-500/25"
          >
            <Sparkles className="h-4 w-4" />
            <span>Mint NFTs</span>
          </Link>

          {/* Swap Button */}
          <Link
            to="/swap"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 font-semibold hover:bg-cyan-500/20 transition-all text-sm"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Swap</span>
          </Link>

          {/* Pools Button */}
          <Link
            to="/pools"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 font-semibold hover:bg-cyan-500/20 transition-all text-sm"
          >
            <Waves className="h-4 w-4" />
            <span>Pools</span>
          </Link>


          {/* My NFTs Link (only when connected) */}
          {isConnected && (
            <Link
              to="/my-nfts"
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-300 hover:text-white hover:bg-slate-800/70 hover:border-cyan-500/30 transition-all text-sm font-medium"
            >
              <Image className="h-4 w-4" />
              <span>My NFTs</span>
            </Link>
          )}
        </div>

        {/* Connect Button */}
        <div className="hidden md:block">
          <ConnectButton />
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-lg p-2 hover:bg-slate-800 transition-colors"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-800 bg-slate-950 md:hidden"
          >
            <div className="px-4 py-4 space-y-4">
              {/* Primary Actions */}
              <div className="space-y-2">
                <Link
                  to="/mint"
                  className="block w-full text-center px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-400 hover:to-blue-400 transition-all"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Mint NFTs</span>
                  </div>
                </Link>
                <Link
                  to="/swap"
                  className="block w-full text-center px-4 py-2 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 font-semibold hover:bg-cyan-500/20 transition-all"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center justify-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" />
                    <span>Swap</span>
                  </div>
                </Link>
                <Link
                  to="/pools"
                  className="block w-full text-center px-4 py-2 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 font-semibold hover:bg-cyan-500/20 transition-all"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Waves className="h-4 w-4" />
                    <span>Pools</span>
                  </div>
                </Link>
              </div>


              {/* My NFTs (only when connected) */}
              {isConnected && (
                <Link
                  to="/my-nfts"
                  className="block py-2 text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Image className="h-4 w-4" />
                  <span>My NFTs</span>
                </Link>
              )}

              {/* Connect Button */}
              <div className="pt-4 border-t border-slate-800">
                <ConnectButton />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
