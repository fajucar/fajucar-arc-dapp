import { useState } from 'react'
import { Menu, X, ExternalLink, Image } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@/components/Web3/ConnectButton'
import { CONSTANTS } from '@/config/constants'
import { motion, AnimatePresence } from 'framer-motion'

const navLinks = [
  { label: 'Documentation', href: CONSTANTS.LINKS.docs },
  { label: 'Explorer', href: CONSTANTS.LINKS.explorer },
  { label: 'Faucet', href: CONSTANTS.LINKS.faucet },
  { label: 'GitHub', href: CONSTANTS.LINKS.github },
]

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
        <div className="hidden md:flex items-center gap-8">
          {isConnected && (
            <Link
              to="/my-nfts"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1"
            >
              <Image className="h-4 w-4" />
              My NFTs
            </Link>
          )}
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
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
              {isConnected && (
                <Link
                  to="/my-nfts"
                  className="block py-2 text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Image className="h-4 w-4" />
                  My NFTs
                </Link>
              )}
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-2 text-slate-300 hover:text-white transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4">
                <ConnectButton />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

