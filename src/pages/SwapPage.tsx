import { Helmet } from 'react-helmet-async'
import { AppShell } from '@/components/Layout/AppShell'
import { SwapInterface } from '@/components/Swap/SwapInterface'
import { GetTestTokensCard } from '@/components/Swap/GetTestTokensCard'

export function SwapPage() {
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_440px] gap-4 md:gap-5 items-start">
          {/* Coluna esquerda: Swap principal */}
          <div className="min-w-0">
            <SwapInterface />
          </div>

          {/* Coluna direita (desktop): Get test tokens */}
          <div className="md:sticky md:top-20">
            <GetTestTokensCard />
          </div>
        </div>
      </AppShell>
    </>
  )
}

