import { motion } from 'framer-motion'
import { Check, X, Zap, Shield, DollarSign, Clock } from 'lucide-react'

interface ChainComparison {
  name: string
  logo?: string
  finality: string
  gasToken: string
  tps: string
  security: string
  isHighlighted?: boolean
}

const chains: ChainComparison[] = [
  {
    name: 'Ethereum',
    finality: '12-15 min',
    gasToken: 'ETH (volatile)',
    tps: '~15',
    security: 'Decentralized PoS',
  },
  {
    name: 'Arc Network',
    finality: '< 1 second',
    gasToken: 'USDC (stable)',
    tps: '3,000+',
    security: 'PoA + BFT',
    isHighlighted: true,
  },
  {
    name: 'Polygon',
    finality: '2-5 min',
    gasToken: 'MATIC',
    tps: '~7,000',
    security: 'PoS',
  },
]

const features = [
  { icon: Clock, label: 'Instant Finality', arc: true, eth: false, polygon: false },
  { icon: DollarSign, label: 'Stable Gas (USDC)', arc: true, eth: false, polygon: false },
  { icon: Zap, label: 'High TPS', arc: true, eth: false, polygon: true },
  { icon: Shield, label: 'Institutional Grade', arc: true, eth: true, polygon: false },
]

export function WhyArc() {
  return (
    <section className="py-20 bg-slate-900/30">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Why Choose <span className="text-cyan-400">Arc</span>?
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Purpose-built for stablecoin finance with features that matter
          </p>
        </motion.div>

        {/* Comparison Table */}
        <div className="overflow-x-auto mb-12">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-4 text-slate-400 font-medium">Feature</th>
                {chains.map((chain) => (
                  <th
                    key={chain.name}
                    className={`p-4 text-center ${
                      chain.isHighlighted
                        ? 'bg-cyan-500/10 border-x border-cyan-500/25'
                        : ''
                    }`}
                  >
                    <div className="font-bold">{chain.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Finality */}
              <tr className="border-b border-slate-800">
                <td className="p-4 text-slate-300">Finality Time</td>
                {chains.map((chain) => (
                  <td
                    key={chain.name}
                    className={`p-4 text-center ${
                      chain.isHighlighted
                        ? 'bg-cyan-500/5 border-x border-cyan-500/25 font-semibold text-cyan-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {chain.finality}
                    {chain.isHighlighted && ' ✨'}
                  </td>
                ))}
              </tr>

              {/* Gas Token */}
              <tr className="border-b border-slate-800">
                <td className="p-4 text-slate-300">Gas Token</td>
                {chains.map((chain) => (
                  <td
                    key={chain.name}
                    className={`p-4 text-center ${
                      chain.isHighlighted
                        ? 'bg-cyan-500/5 border-x border-cyan-500/25 font-semibold text-cyan-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {chain.gasToken}
                    {chain.isHighlighted && ' ✨'}
                  </td>
                ))}
              </tr>

              {/* TPS */}
              <tr className="border-b border-slate-800">
                <td className="p-4 text-slate-300">Throughput (TPS)</td>
                {chains.map((chain) => (
                  <td
                    key={chain.name}
                    className={`p-4 text-center ${
                      chain.isHighlighted
                        ? 'bg-cyan-500/5 border-x border-cyan-500/25 font-semibold text-cyan-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {chain.tps}
                    {chain.isHighlighted && ' ✨'}
                  </td>
                ))}
              </tr>

              {/* Security */}
              <tr>
                <td className="p-4 text-slate-300">Security Model</td>
                {chains.map((chain) => (
                  <td
                    key={chain.name}
                    className={`p-4 text-center ${
                      chain.isHighlighted
                        ? 'bg-cyan-500/5 border-x border-cyan-500/25 font-semibold text-cyan-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {chain.security}
                    {chain.isHighlighted && ' ✨'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="rounded-xl border border-cyan-500/25 bg-slate-900/50 p-6 text-center"
            >
              <feature.icon className="h-10 w-10 mx-auto mb-3 text-cyan-400" />
              <h4 className="font-semibold mb-2">{feature.label}</h4>
              <div className="flex justify-center gap-2 text-sm">
                {feature.arc ? (
                  <Check className="h-5 w-5 text-green-400" />
                ) : (
                  <X className="h-5 w-5 text-red-400" />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

