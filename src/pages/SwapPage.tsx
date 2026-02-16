import { Helmet } from 'react-helmet-async'
import { ExternalLink, Droplet } from 'lucide-react'
import { CONSTANTS } from '@/config/constants'
import { AppShell } from '@/components/Layout/AppShell'
import { SwapInterface } from '@/components/Swap/SwapInterface'

export function SwapPage() {
  return (
    <>
      <Helmet>
        <title>Swap - FajuARC</title>
        <meta name="description" content="Swap tokens on FajuARC. Trade USDC and EURC on Arc Testnet." />
      </Helmet>
      <AppShell
        title="Swap"
        subtitle="Trade USDC ↔ EURC on Arc Testnet"
        titleClassName="text-xl md:text-2xl font-semibold tracking-tight"
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* Swap Interface */}
          <SwapInterface />

          {/* Faucet — minimal secondary card */}
          <div className="mt-4 flex justify-center">
            <a
              href={CONSTANTS.LINKS.faucet}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700/30 bg-slate-800/10 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600/40 transition-colors"
            >
              <Droplet className="h-3.5 w-3.5" />
              Faucet
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </AppShell>
    </>
  )
}

