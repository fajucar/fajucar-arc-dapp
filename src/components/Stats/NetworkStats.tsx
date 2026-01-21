import { Zap, Clock, DollarSign, Activity } from 'lucide-react'
import { StatCard } from './StatCard'
import { useArcStats } from '@/hooks/useArcStats'
import { useBlockNumber } from '@/hooks/useBlockNumber'
import { CONSTANTS } from '@/config/constants'

export function NetworkStats() {
  const { data: stats, isLoading } = useArcStats()
  const { data: blockNumber } = useBlockNumber()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i}
            className="h-32 rounded-2xl bg-slate-800/50 animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
      <StatCard
        label="Transactions/sec"
        value={stats?.tps || 0}
        icon={Zap}
        trend="up"
        link={`${CONSTANTS.LINKS.explorer}`}
        tooltip="Estimated from network activity. Click to verify on explorer"
      />
      
      <StatCard
        label="Finality Time"
        value={stats?.finality || 0}
        suffix="s"
        icon={Clock}
        decimals={2}
        trend="neutral"
        tooltip="Deterministic finality time on Arc Network"
      />
      
      <StatCard
        label="Gas Price (USDC)"
        value={stats?.gasPrice || '0.00'}
        suffix=""
        icon={DollarSign}
        decimals={4}
        trend="neutral"
        link={`${CONSTANTS.LINKS.explorer}`}
        tooltip="Current gas price from RPC. Click to verify on explorer"
      />
      
      <StatCard
        label="Latest Block"
        value={Number(blockNumber || 0)}
        icon={Activity}
        trend="up"
        link={`${CONSTANTS.LINKS.explorer}/block/${blockNumber}`}
        tooltip="Latest block number from RPC. Click to view on explorer"
      />
    </div>
  )
}

