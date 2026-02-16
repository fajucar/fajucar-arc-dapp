import { useState } from 'react'
import { Menu, X, Image, Sparkles, ArrowLeftRight, Waves, Home, Wallet } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@/components/Web3/ConnectButton'
import { motion, AnimatePresence } from 'framer-motion'

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/mint', icon: Sparkles, label: 'Mint NFTs' },
  { to: '/my-nfts', icon: Image, label: 'My NFTs' },
  { to: '/swap', icon: ArrowLeftRight, label: 'Swap' },
  { to: '/pools', icon: Waves, label: 'Pools' },
  { to: '/my-pools', icon: Wallet, label: 'My Pools' },
] as const

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ease-in-out
        ${isActive
          ? 'text-cyan-400 border-b-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
        }`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  )
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isConnected } = useAccount()

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-[#0b1220]/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        {/* Logo / Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_20px_rgba(34,211,238,0.2)] group-hover:shadow-[0_0_24px_rgba(34,211,238,0.35)] transition-all duration-300">
            A
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">FajuARC</span>
            <span className="ml-2 text-xs text-cyan-400/90 font-medium px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
              Running on Arc Testnet
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavItem key={item.to} to={item.to} icon={item.icon} label={item.label} />
          ))}
        </div>

        {/* Right: Network Badge + Wallet */}
        <div className="hidden md:flex items-center gap-3">
          <div className="rounded-full border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-500/5 shadow-[0_0_12px_rgba(34,211,238,0.15)]">
            Arc Testnet
          </div>
          <div className={`relative ${isConnected ? 'animate-pulse' : ''}`} style={{ animationDuration: '2s' }}>
            <ConnectButton />
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-lg p-2 hover:bg-slate-800/60 transition-colors"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-t border-slate-800/60 bg-[#0b1220]/98 backdrop-blur-xl md:hidden"
          >
            <div className="px-4 py-4 space-y-2">
              <div className="rounded-full border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-500/5 w-fit mb-4">
                Arc Testnet
              </div>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all
                    ${isActive ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-slate-300 hover:bg-slate-800/50'}
                    `
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
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
