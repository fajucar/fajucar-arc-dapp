import { useState, useEffect } from 'react'
import { useAccount, useDisconnect, useEnsName, useEnsAvatar } from 'wagmi'
import { Wallet, LogOut, Copy, ExternalLink, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWalletModal } from '@/contexts/WalletModalContext'
import { CONSTANTS } from '@/config/constants'
import { formatAddress } from '@/lib/formatters'
import toast from 'react-hot-toast'

export function ConnectButton() {
  const { openModal } = useWalletModal()
  const [showDropdown, setShowDropdown] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address })
  const { data: ensAvatar } = useEnsAvatar({ 
    name: ensName && typeof ensName === 'string' ? ensName : undefined 
  })

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!showDropdown) return
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-wallet-dropdown]')) {
        setShowDropdown(false)
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showDropdown])

  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success('Address copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy address')
    }
  }

  const openExplorer = () => {
    if (!address) return
    window.open(`${CONSTANTS.LINKS.explorer}/address/${address}`, '_blank')
  }

  if (!isConnected) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={openModal}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
      >
        <Wallet className="h-5 w-5" />
        Connect Wallet
      </motion.button>
    )
  }

  return (
    <div className="relative" data-wallet-dropdown>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-slate-900/50 px-4 py-2.5 backdrop-blur-xl hover:bg-slate-900/70 transition-all"
      >
        {ensAvatar ? (
          <img src={ensAvatar} alt="ENS Avatar" className="h-6 w-6 rounded-full" />
        ) : (
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
        )}
        <span className="font-medium">
          {(ensName && typeof ensName === 'string') ? ensName : formatAddress(address!)}
        </span>
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-64 rounded-xl border border-cyan-500/25 bg-slate-900 p-2 shadow-2xl z-50"
          >
            <div className="border-b border-slate-700 p-3 mb-2">
              <p className="text-xs text-slate-400 mb-1">Connected Address</p>
              <p className="font-mono text-sm break-all">{formatAddress(address!)}</p>
            </div>

            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors text-left"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="text-sm">Copy Address</span>
            </button>

            <button
              onClick={openExplorer}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-800 transition-colors text-left"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="text-sm">View on Explorer</span>
            </button>

            <div className="border-t border-slate-700 mt-2 pt-2">
              <button
                onClick={() => {
                  disconnect()
                  setShowDropdown(false)
                  toast.success('Disconnected')
                }}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors text-left"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Disconnect</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

