import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/Layout/AppShell'
import { FaucetPanel } from '@/components/Faucet'

export function FaucetPage() {
  return (
    <>
      <Helmet>
        <title>Faucet - FajuARC</title>
        <meta name="description" content="Claim FAJU and ARCX test tokens on Arc Testnet" />
      </Helmet>
      <AppShell
        title="Faucet"
        subtitle="Claim 10 FAJU e 10 ARCX (cooldown 24h). Apenas Arc Testnet."
        titleClassName="text-xl md:text-2xl font-semibold tracking-tight"
        maxWidth="2xl"
      >
        <div className="mb-4">
          <Link to="/swap" className="text-cyan-400 hover:text-cyan-300 text-sm transition-colors">
            ← Voltar ao Swap
          </Link>
        </div>
        <FaucetPanel variant="normal" />
      </AppShell>
    </>
  )
}
