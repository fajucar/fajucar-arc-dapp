import { motion } from 'framer-motion'
import { LucideIcon, ExternalLink } from 'lucide-react'
import CountUp from 'react-countup'

interface StatCardProps {
  label: string
  value: number | string
  suffix?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  decimals?: number
  link?: string
  tooltip?: string
}

export function StatCard({ 
  label, 
  value, 
  suffix = '', 
  icon: Icon,
  trend = 'neutral',
  decimals = 0,
  link,
  tooltip
}: StatCardProps) {
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-cyan-400',
  }

  const numericValue = typeof value === 'string' ? parseFloat(value) : value
  const isValidNumber = !isNaN(numericValue) && isFinite(numericValue)

  const CardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 p-6 backdrop-blur-xl transition-all"
    >
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-400">{label}</span>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${trendColors[trend]}`} />
            {link && (
              <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">
            {isValidNumber ? (
              <CountUp 
                end={numericValue} 
                decimals={decimals}
                separator=","
                duration={1.5}
              />
            ) : (
              value
            )}
          </span>
          {suffix && (
            <span className="text-lg text-slate-400">{suffix}</span>
          )}
        </div>

        {tooltip && (
          <p className="mt-2 text-xs text-slate-500">{tooltip}</p>
        )}
      </div>
    </motion.div>
  )

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        title={tooltip || `View ${label} on explorer`}
      >
        {CardContent}
      </a>
    )
  }

  return CardContent
}

