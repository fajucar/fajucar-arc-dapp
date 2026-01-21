import { useMemo, useState, useEffect } from 'react'
import { useConnect, useConnectors } from 'wagmi'
import toast from 'react-hot-toast'
import { WALLETCONNECT_PROJECT_ID } from '@/config/wagmi'

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
}

type InjectedProvider = {
  isMetaMask?: boolean
  isRabby?: boolean
  isCoinbaseWallet?: boolean
  isOkxWallet?: boolean
}

function getInjectedProviders(): InjectedProvider[] {
  const eth: any = (window as any).ethereum
  if (!eth) return []

  // Alguns navegadores expõem vários providers em ethereum.providers
  const providers: any[] = Array.isArray(eth.providers) ? eth.providers : [eth]
  return providers.filter(Boolean)
}

function isInstalled(check: (p: InjectedProvider) => boolean): boolean {
  const providers = getInjectedProviders()
  return providers.some((p) => {
    try {
      return check(p)
    } catch {
      return false
    }
  })
}

// Helper para detectar mobile
function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connectAsync, isPending } = useConnect()
  const connectors = useConnectors()
  const mobile = isMobile()
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [walletConnectDisabled, setWalletConnectDisabled] = useState(false)

  // Function to reset WalletConnect circuit breaker
  const resetWalletConnectBreaker = () => {
    try {
      localStorage.removeItem('WALLETCONNECT_DISABLED')
      localStorage.removeItem('walletconnect_disabled')
      localStorage.removeItem('wc_disabled')
      sessionStorage.removeItem('walletconnect_disabled')
      sessionStorage.removeItem('wc_disabled')
    } catch (err) {
      console.error('Error resetting circuit breaker:', err)
    }
    
    // Clear local state
    setConnectError(null)
    setWalletConnectDisabled(false)
    
    // Force re-render to update connectors
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  // Check circuit breaker flag on mount and when modal opens
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const disabled = localStorage.getItem('WALLETCONNECT_DISABLED') === '1'
      setWalletConnectDisabled(disabled)
    }
  }, [isOpen])

  // Recalcula quando o modal abre (garante detecção atualizada)
  const wallets = useMemo(() => {
    // Encontrar WalletConnect connector
    const wcConnector = connectors.find(c => c.type === 'walletConnect')
    const hasWalletConnect = !!wcConnector

    const list: Array<{
      id: string
      name: string
      recommended: boolean
      installed: boolean
      connector: any
      type: 'injected' | 'walletConnect'
      mobileLabel?: string // Label específico para mobile
    }> = []

    if (mobile) {
      // On mobile: prioritize WalletConnect if available, but always show injected wallets as fallback
      if (hasWalletConnect && wcConnector && WALLETCONNECT_PROJECT_ID && !walletConnectDisabled) {
        // WalletConnect is enabled: show WalletConnect options
        // Main WalletConnect option
        list.push({
          id: 'walletconnect',
          name: 'WalletConnect',
          recommended: true,
          installed: true,
          connector: wcConnector,
          type: 'walletConnect',
          mobileLabel: 'Open your installed wallet',
        })

        // Wallet-specific options via WalletConnect
        // These will open the specific wallet app via deep link
        list.push({
          id: 'metamask-wc',
          name: 'MetaMask',
          recommended: false,
          installed: true,
          connector: wcConnector,
          type: 'walletConnect',
          mobileLabel: 'Open via WalletConnect',
        })

        list.push({
          id: 'coinbase-wc',
          name: 'Coinbase Wallet',
          recommended: false,
          installed: true,
          connector: wcConnector,
          type: 'walletConnect',
          mobileLabel: 'Open via WalletConnect',
        })

        list.push({
          id: 'okx-wc',
          name: 'OKX Wallet',
          recommended: false,
          installed: true,
          connector: wcConnector,
          type: 'walletConnect',
          mobileLabel: 'Open via WalletConnect',
        })

        list.push({
          id: 'rabby-wc',
          name: 'Rabby Wallet',
          recommended: false,
          installed: true,
          connector: wcConnector,
          type: 'walletConnect',
          mobileLabel: 'Open via WalletConnect',
        })
      }
      
      // Always show injected wallets on mobile as fallback (when WalletConnect not configured or disabled)
      const injectedConnector = connectors.find(c => c.type === 'injected')
      if (injectedConnector) {
        // Only add if not already added via WalletConnect
        if (!list.find(w => w.id === 'metamask-injected')) {
          list.push({
            id: 'metamask-injected',
            name: 'MetaMask',
            recommended: !hasWalletConnect || !WALLETCONNECT_PROJECT_ID || walletConnectDisabled, // Recommended if WalletConnect not available
            installed: true,
            connector: injectedConnector,
            type: 'injected',
            mobileLabel: 'Use MetaMask in-app browser',
          })
        }
      }
    } else {
      // Desktop: lógica original (detectar instalação de extensões)
      const hasMetaMask = isInstalled((p) => Boolean(p?.isMetaMask))
      const hasRabby = isInstalled((p) => Boolean(p?.isRabby))
      const hasCoinbase = isInstalled((p) => Boolean(p?.isCoinbaseWallet))
      const hasOkx = isInstalled((p) => Boolean(p?.isOkxWallet))

      // Injected wallets no desktop
      if (hasMetaMask) {
        const mmConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask')
        list.push({
          id: 'metamask',
          name: 'MetaMask',
          recommended: true,
          installed: hasMetaMask,
          connector: mmConnector,
          type: 'injected',
        })
      }

      if (hasRabby) {
        const rbConnector = connectors.find(c => c.id === 'injected' || c.name === 'Rabby')
        list.push({
          id: 'rabby',
          name: 'Rabby Wallet',
          recommended: false,
          installed: hasRabby,
          connector: rbConnector,
          type: 'injected',
        })
      }

      if (hasCoinbase) {
        const cbConnector = connectors.find(c => c.id === 'injected' || c.name === 'Coinbase Wallet')
        list.push({
          id: 'coinbase',
          name: 'Coinbase Wallet',
          recommended: false,
          installed: hasCoinbase,
          connector: cbConnector,
          type: 'injected',
        })
      }

      if (hasOkx) {
        const okxConnector = connectors.find(c => c.id === 'injected' || c.name === 'OKX Wallet')
        list.push({
          id: 'okx',
          name: 'OKX Wallet',
          recommended: false,
          installed: hasOkx,
          connector: okxConnector,
          type: 'injected',
        })
      }

      // WalletConnect no desktop (depois dos injected)
      // Don't show WalletConnect if disabled by circuit breaker
      if (hasWalletConnect && !walletConnectDisabled) {
        list.push({
          id: 'walletconnect',
          name: 'WalletConnect',
          recommended: false,
          installed: true,
          connector: wcConnector,
          type: 'walletConnect',
        })
      }

      // Fallback: se existir window.ethereum mas nenhuma flag foi detectada
      const hasAnyInjected = getInjectedProviders().length > 0
      const noneDetected = list.every((w) => w.type !== 'injected' || !w.installed)

      if (hasAnyInjected && noneDetected) {
        const injectedConnector = connectors.find(c => c.type === 'injected')
        list.push({
          id: 'injected',
          name: 'Injected Wallet (Browser)',
          recommended: false,
          installed: true,
          connector: injectedConnector,
          type: 'injected',
        })
      }
    }

    return list
  }, [isOpen, connectors, mobile, walletConnectDisabled])

  if (!isOpen) return null

  const handleConnect = async (wallet: typeof wallets[0]) => {
    setIsConnecting(true)
    setConnectError(null)
    
    // Use the wallet's connector (injected or WalletConnect)
    let connectorToUse = wallet.connector
    
    // On mobile, prefer WalletConnect if available, but fallback to injected if not configured
    if (mobile && wallet.type === 'walletConnect') {
      const wcConnector = connectors.find(c => c.type === 'walletConnect' && c.id)
      // Only use WalletConnect if connector exists and projectId is configured
      if (wcConnector && wcConnector.id && WALLETCONNECT_PROJECT_ID) {
        connectorToUse = wcConnector
        console.log('[WalletModal] Mobile: Using WalletConnect connector for', wallet.name)
      } else {
        // WalletConnect not available, but user selected WalletConnect option
        // This shouldn't happen if we filter wallets correctly, but handle gracefully
        console.warn('[WalletModal] Mobile: WalletConnect not available, but user selected WalletConnect option')
        const errorMsg = 'WalletConnect is not configured. Please use MetaMask or another injected wallet.'
        setConnectError(errorMsg)
        toast.error('WalletConnect not available')
        setIsConnecting(false)
        return
      }
    }
    
    // If user is trying to use WalletConnect but it's not configured, block only that specific case
    if (wallet.type === 'walletConnect' && !WALLETCONNECT_PROJECT_ID) {
      const errorMsg = 'WalletConnect is not configured. Please use MetaMask or another injected wallet.'
      setConnectError(errorMsg)
      toast.error('WalletConnect not configured')
      setIsConnecting(false)
      return
    }
    
    // Final validation: ensure connector exists and has id before attempting connection
    if (!connectorToUse || !connectorToUse.id) {
      const errorMsg = 'Wallet connector not available or not initialized'
      setConnectError(errorMsg)
      toast.error('Connector not available')
      setIsConnecting(false)
      return
    }
    
    if (!mobile && !wallet.installed) {
      setIsConnecting(false)
      return
    }
    
    try {
      console.log('[WalletModal] Connecting with connector:', connectorToUse.type, connectorToUse.id)
      await connectAsync({ connector: connectorToUse })
      console.log('[WalletModal] Connection successful')
      // Only close modal on successful connection
      onClose()
    } catch (err: any) {
      // Don't close modal on error (better UX)
      const errorMessage = err?.shortMessage || err?.message || err?.toString() || 'Connection failed'
      const errorString = errorMessage.toLowerCase()
      
      // Circuit breaker: detect "init" errors and disable WalletConnect
      if (connectorToUse.type === 'walletConnect' && 
          (errorString.includes("reading 'init'") || 
           errorString.includes("reading \"init\"") ||
           errorString.includes('.init') ||
           errorString.includes('init is not a function'))) {
        console.error('[WalletModal] WalletConnect init error detected, disabling WalletConnect')
        if (typeof window !== 'undefined') {
          localStorage.setItem('WALLETCONNECT_DISABLED', '1')
          setWalletConnectDisabled(true)
        }
        const circuitBreakerMsg = 'WalletConnect failed on this device. Use MetaMask in-app browser or another wallet. You can re-enable by clearing the site cache.'
        setConnectError(circuitBreakerMsg)
        toast.error('WalletConnect disabled due to error')
      } else {
        setConnectError(errorMessage)
        toast.error(errorMessage)
      }
      console.error('[WalletModal] Wallet connect error:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  if (!isOpen) return null

  return (
    // Overlay (clique fora fecha)
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      {/* Painel: full-screen no mobile, centralizado no desktop */}
      <div
        className={`
          ${mobile 
            ? 'fixed inset-0 m-0 rounded-none' 
            : 'absolute right-6 top-16 w-full max-w-md rounded-xl'
          }
          bg-slate-900 text-white shadow-xl border border-slate-700
          flex flex-col
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-300 hover:text-white transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content - scrollable */}
        <div className={`flex-1 overflow-y-auto ${mobile ? 'p-4' : 'p-4'}`}>
          {/* Circuit breaker message when WalletConnect is disabled */}
          {walletConnectDisabled && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm font-medium text-red-300 mb-1">
                WalletConnect disabled
              </p>
              <p className="text-xs text-red-200/80 mb-3">
                WalletConnect failed on this device. Use MetaMask in-app browser or another wallet.
              </p>
              <button
                onClick={resetWalletConnectBreaker}
                className="px-4 py-2 rounded border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-sm font-medium"
              >
                Try again
              </button>
            </div>
          )}
          
          {/* Don't show WalletConnect configuration warning - injected wallets work fine without it */}
          
          {mobile && wallets.length > 0 && WALLETCONNECT_PROJECT_ID && !walletConnectDisabled && (
            <div className="mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-sm text-cyan-300">
                On mobile, use WalletConnect to open your installed wallet
              </p>
            </div>
          )}
          
          {mobile && walletConnectDisabled && wallets.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-300">
                Use the MetaMask in-app browser or another wallet.
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            {wallets.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                {walletConnectDisabled ? (
                  <>
                    <p className="font-semibold text-red-400 mb-2">WalletConnect Disabled</p>
                    <p className="text-sm mb-2">WalletConnect failed on this device.</p>
                    <p className="text-xs text-slate-500 mb-3">
                      Use MetaMask in-app browser or another wallet.
                    </p>
                    <button
                      onClick={resetWalletConnectBreaker}
                      className="px-4 py-2 rounded border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-sm font-medium"
                    >
                      Try again
                    </button>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-slate-300 mb-2">No Wallets Available</p>
                    <p className="text-sm mt-2">Please install a wallet extension like MetaMask or Rabby</p>
                  </>
                )}
              </div>
            ) : (
              wallets.map((w) => {
                // No mobile, sempre habilitar (não filtrar por installed)
                const isDisabled = isConnecting || (mobile ? false : (isPending || !w.installed))
                const isInstalledOrMobile = mobile ? true : w.installed
                
                return (
                <button
                  key={w.id}
                  onClick={() => handleConnect(w)}
                  disabled={isDisabled}
                  className={[
                    'w-full rounded-lg border px-4 py-3 text-left transition',
                    isInstalledOrMobile && !isConnecting
                      ? 'border-slate-700 hover:border-slate-500 hover:bg-slate-800 active:scale-[0.98]'
                      : 'cursor-not-allowed border-slate-800 bg-slate-950/40 opacity-70',
                    w.recommended && isInstalledOrMobile ? 'border-cyan-500/50 bg-cyan-500/5' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{w.name}</span>
                        {w.recommended && (
                          <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                            Recommended
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-slate-400">
                        {isConnecting 
                          ? 'Connecting...'
                          : mobile && w.mobileLabel
                            ? w.mobileLabel
                            : w.installed
                              ? w.type === 'walletConnect' 
                                ? 'Connect via QR code or deep link'
                                : 'Installed'
                              : 'Not installed'}
                      </span>
                    </div>

                    <span className="text-slate-400">↗</span>
                  </div>
                </button>
                )
              })
            )}
          </div>
          
          {/* Error message */}
          {connectError && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{connectError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`border-t border-slate-700 ${mobile ? 'p-4' : 'p-4'}`}>
          <button
            onClick={onClose}
            disabled={isConnecting}
            className="w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Connecting...' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
