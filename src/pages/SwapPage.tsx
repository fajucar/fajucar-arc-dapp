import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { ExternalLink, Droplet } from 'lucide-react'
import { CONSTANTS } from '@/config/constants'
import { AppShell } from '@/components/Layout/AppShell'
import { SwapInterface } from '@/components/Swap/SwapInterface'

export function SwapPage() {
  return (
    <>
      <Helmet>
        <title>Swap - Arc Network DEX</title>
        <meta name="description" content="Swap tokens on Arc Network. Simple UX and stablecoin-first design." />
      </Helmet>
      <AppShell
        title="Swap"
        subtitle="Trade tokens seamlessly on Arc Network"
        titleClassName="text-xl md:text-2xl font-semibold tracking-tight"
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* Swap Interface */}
          <SwapInterface />

          {/* Faucet Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <a
              href={CONSTANTS.LINKS.faucet}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-lg border border-cyan-500/20 bg-slate-900/30 backdrop-blur-xl p-3 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-cyan-500/10 p-2 border border-cyan-500/20">
                  <Droplet className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xs font-semibold text-white mb-0.5">Precisa de tokens testnet?</h3>
                  <p className="text-[10px] text-slate-400">Obtenha USDC e EURC testnet gratuitamente no faucet oficial</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>
            </a>
          </motion.div>
        </div>
      </AppShell>
    </>
  )
}

