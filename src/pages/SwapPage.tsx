import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { motion, AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/Layout/AppShell'
import { SwapInterface } from '@/components/Swap/SwapInterface'
import { GetTestTokensCard } from '@/components/Swap/GetTestTokensCard'
import { V3SwapPage } from '@/modules/v3/V3SwapPage'
import { MOTION } from '@/lib/motion'

export function SwapPage() {
  const [mode, setMode] = useState<'v2' | 'v3'>('v2')

  return (
    <>
      <Helmet>
        <title>Swap - FajuARC</title>
        <meta name="description" content="Swap tokens on FajuARC. Trade FAJU, ARCX, USDC, EURC on Arc Testnet." />
      </Helmet>
      <AppShell
        title="Swap"
        subtitle="Trade FAJU, ARCX, USDC, EURC on Arc Testnet"
        titleClassName="text-xl md:text-2xl font-semibold tracking-tight"
        maxWidth="6xl"
        compact
      >
        <div className="mb-4 flex gap-2">
          <motion.button
            onClick={() => setMode('v2')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: MOTION.duration.fast }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${mode === 'v2' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'}`}
          >
            Simple (V2)
          </motion.button>
          <motion.button
            onClick={() => setMode('v3')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: MOTION.duration.fast }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${mode === 'v3' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60'}`}
          >
            Pro (V3)
          </motion.button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_440px] gap-4 md:gap-5 items-start">
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {mode === 'v2' ? (
                <motion.div
                  key="v2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: MOTION.duration.normal }}
                >
                  <SwapInterface />
                </motion.div>
              ) : (
                <motion.div
                  key="v3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: MOTION.duration.normal }}
                >
                  <V3SwapPage />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="md:sticky md:top-20">
            <AnimatePresence mode="wait">
              {mode === 'v2' && (
                <motion.div
                  key="getTokens"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: MOTION.duration.normal }}
                >
                  <GetTestTokensCard />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </AppShell>
    </>
  )
}

