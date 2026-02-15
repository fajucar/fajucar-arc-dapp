import { Helmet } from 'react-helmet-async'
import { ArcDexTestPool } from './ArcDexTestPool'

export function PoolsPage() {
  return (
    <>
      <Helmet>
        <title>Pools - Arc Network DEX</title>
        <meta name="description" content="Liquidity pools on Arc Network. View pool reserves and provide liquidity." />
      </Helmet>
      <ArcDexTestPool />
    </>
  )
}

