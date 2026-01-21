import { useState, useEffect, useRef } from 'react'
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { Zap, Loader2, CheckCircle2, Share2 } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { arcTestnet } from '@/config/chains'
import { CONSTANTS } from '@/config/constants'

// Emojis de festa para animação - APENAS EMOJIS DE FESTA!
const CELEBRATION_EMOJIS = [
  '🎉', '🎊', '🎉', '🎊', '🎉', '🎊', // Confetes principais
  '✨', '✨', '✨', '✨', '✨', '✨', // Estrelas brilhantes
  '🌟', '⭐', '🌟', '⭐', '🌟', '⭐', // Estrelas
  '💫', '💫', '💫', '💫', '💫', '💫', // Estrelas cadentes
  '🎈', '🎈', '🎈', '🎈', '🎈', '🎈', // Balões
  '🎁', '🎁', '🎁', '🎁', '🎁', '🎁', // Presentes
  '🏆', '🏆', '🏆', '🏆', '🏆', '🏆', // Troféus
  '🎪', '🎪', '🎪', '🎪', '🎪', '🎪', // Circo
  '🎡', '🎠', '🎡', '🎠', '🎡', '🎠', // Brinquedos
  '🎯', '🎯', '🎯', '🎯', '🎯', '🎯', // Alvo
  '💯', '💯', '💯', '💯', '💯', '💯', // 100
  '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', // Fogo
  '💎', '💎', '💎', '💎', '💎', '💎', // Diamantes
  '🚀', '🚀', '🚀', '🚀', '🚀', '🚀', // Foguetes
  '☄️', '☄️', '☄️', '☄️', '☄️', '☄️', // Cometas
  '🌠', '🌠', '🌠', '🌠', '🌠', '🌠', // Estrela cadente
  '💥', '💥', '💥', '💥', '💥', '💥', // Explosão
  '⚡', '⚡', '⚡', '⚡', '⚡', '⚡', // Raio
  '🌈', '🌈', '🌈', '🌈', '🌈', '🌈', // Arco-íris
  '🎨', '🎨', '🎨', '🎨', '🎨', '🎨', // Paleta
  '🎭', '🎭', '🎭', '🎭', '🎭', '🎭', // Máscaras
  '🎟️', '🎟️', '🎟️', '🎟️', '🎟️', '🎟️', // Ingressos
  '🎫', '🎫', '🎫', '🎫', '🎫', '🎫', // Bilhetes
  '🎗️', '🎗️', '🎗️', '🎗️', '🎗️', '🎗️', // Fita
  '👑', '👑', '👑', '👑', '👑', '👑', // Coroas
  '🎀', '🎀', '🎀', '🎀', '🎀', '🎀', // Laço
  '💍', '💍', '💍', '💍', '💍', '💍', // Anel
  '🎃', '🎃', '🎃', '🎃', '🎃', '🎃', // Abóbora
  '🦄', '🦄', '🦄', '🦄', '🦄', '🦄', // Unicórnio
  '🐉', '🐉', '🐉', '🐉', '🐉', '🐉', // Dragão
]

export function GMButton() {
  const { address, isConnected, chain } = useAccount()
  const { switchChain } = useSwitchChain()
  const [showCelebration, setShowCelebration] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [confirmedHash, setConfirmedHash] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const GM_HEX_DATA = '0x474d' as `0x${string}`

  const { sendTransaction, data: hash, error, isPending } = useSendTransaction()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const handleGM = async () => {
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

    if (!address) {
      toast.error('Wallet address not found')
      return
    }

    try {
      sendTransaction({
        to: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        data: GM_HEX_DATA,
        value: BigInt(0),
      })
    } catch (err: any) {
      console.error('GM transaction error:', err)
      toast.error(err.message || 'Failed to send GM')
    }
  }

  // Reset quando nova transação começar
  useEffect(() => {
    if (isPending && hash && hash !== confirmedHash) {
      setShowCelebration(false)
      setShowShareModal(false)
      setConfirmedHash(null)
    }
  }, [isPending, hash, confirmedHash])

  // Quando transação for confirmada
  useEffect(() => {
    if (isSuccess && hash && hash !== confirmedHash) {
      console.log('[GMButton] ✅✅✅ TRANSACTION CONFIRMED! Hash:', hash)
      console.log('[GMButton] Setting confirmedHash to:', hash)
      
      setConfirmedHash(hash)
      setShowShareModal(false)
      setShowCelebration(false)
      
      // Mostrar celebração imediatamente
      setTimeout(() => {
        console.log('[GMButton] 🎉🎉🎉 SETTING showCelebration = TRUE')
        setShowCelebration(true)
        toast.success('GM sent successfully! 🎉')
      }, 100)
      
      // Após 3 segundos, mostrar modal
      setTimeout(() => {
        console.log('[GMButton] 📱📱📱 SETTING showShareModal = TRUE')
        setShowCelebration(false)
        setShowShareModal(true)
      }, 3000)
    }
  }, [isSuccess, hash, confirmedHash])

  const handleShareOnX = () => {
    if (!confirmedHash) return
    
    const explorerUrl = `${CONSTANTS.LINKS.explorer}/tx/${confirmedHash}`
    const text = encodeURIComponent(
      `GM! 🚀 Just sent an on-chain GM on Arc Testnet - the future of deterministic finality!\n\n${explorerUrl}\n\n#ArcNetwork #Web3 #GM`
    )
    const url = `https://x.com/intent/tweet?text=${text}`
    
    window.open(url, '_blank', 'noopener,noreferrer')
    setShowShareModal(false)
  }

  const isProcessing = isPending || isConfirming

  // Obter posição do botão
  const getButtonCenter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
    }
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }
  }

  console.log('[GMButton] RENDER - showCelebration:', showCelebration, 'showShareModal:', showShareModal, 'confirmedHash:', confirmedHash)

  return (
    <>
      <motion.button
        ref={buttonRef}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleGM}
        disabled={isProcessing || !isConnected}
        className="relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 font-bold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-visible"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{isPending ? 'Confirm in wallet...' : 'Confirming...'}</span>
          </>
        ) : isSuccess ? (
          <>
            <CheckCircle2 className="h-5 w-5" />
            <span>GM Sent! 🎉</span>
          </>
        ) : (
          <>
            <Zap className="h-5 w-5" />
            <span>Send GM</span>
          </>
        )}
      </motion.button>

      {/* EMOJIS DE FESTA */}
      {showCelebration && (
        <div 
          className="fixed inset-0 z-[99999] pointer-events-none"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999
          }}
        >
          {(() => {
            const { x, y } = getButtonCenter()
            console.log('[GMButton] Rendering emojis from position:', { x, y })
            return CELEBRATION_EMOJIS.map((emoji, i) => {
              const angle = (i * 360) / CELEBRATION_EMOJIS.length
              const radius = 150 + Math.random() * 100
              const finalX = x + Math.cos((angle * Math.PI) / 180) * radius + (Math.random() - 0.5) * 50
              const finalY = y + Math.sin((angle * Math.PI) / 180) * radius + (Math.random() - 0.5) * 50

              return (
                <motion.div
                  key={`emoji-${confirmedHash}-${i}`}
                  initial={{ opacity: 0, scale: 0, x, y }}
                  animate={{ 
                    opacity: [0, 1, 1, 0.8, 0],
                    scale: [0, 1.2, 1, 0.8, 0],
                    x: finalX,
                    y: finalY,
                    rotate: Math.random() * 720 - 360
                  }}
                  transition={{ duration: 2.5, delay: i * 0.03, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    transform: 'translate(-50%, -50%)',
                    fontSize: '1.5rem',
                    pointerEvents: 'none'
                  }}
                >
                  {emoji}
                </motion.div>
              )
            })
          })()}
        </div>
      )}

      {/* MODAL DE COMPARTILHAR */}
      {showShareModal && confirmedHash && (
        <div 
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
          style={{ zIndex: 100000 }}
        >
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              console.log('[GMButton] Closing modal')
              setShowShareModal(false)
            }}
          />
          <div 
            className="relative z-[100001] w-full max-w-md rounded-2xl border border-cyan-500/25 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 100001 }}
          >
            <div className="text-center">
              <div className="text-6xl mb-4 animate-bounce">🎉</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                GM Sent Successfully! 🚀
              </h3>
              <p className="text-slate-300 mb-2">
                Your on-chain GM transaction was confirmed on Arc Testnet!
              </p>
              <p className="text-cyan-400 font-semibold mb-6 text-lg">
                Share your achievement on X and let the world know! 🎊
              </p>
              
              <div className="mb-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Transaction Hash:</p>
                <a
                  href={`${CONSTANTS.LINKS.explorer}/tx/${confirmedHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-cyan-400 hover:underline break-all"
                >
                  {confirmedHash}
                </a>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleShareOnX}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/25"
                >
                  <Share2 className="h-5 w-5" />
                  Share on X 🐦
                </button>
                <button
                  onClick={() => {
                    console.log('[GMButton] Maybe Later clicked')
                    setShowShareModal(false)
                  }}
                  className="w-full px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-800 hover:text-slate-300 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error message - apenas mostrar se não for cancelamento do usuário */}
      {error && !error.message.includes('User rejected') && !error.message.includes('denied') && (
        <div className="mt-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-400">
          {error.message}
        </div>
      )}
    </>
  )
}
