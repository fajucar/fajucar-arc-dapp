import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { ArrowLeft, Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

export function PoolsPage() {
  return (
    <>
      <Helmet>
        <title>Pools - Arc Network DEX</title>
        <meta name="description" content="Liquidity pools on Arc Network. Coming soon - provide liquidity and earn fees with LP tokens." />
      </Helmet>
      <div className="relative min-h-screen overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <div className="h-full w-full bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950" />
          <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute top-[20%] -right-[10%] w-[50vw] h-[50vw] bg-blue-500/10 rounded-full blur-[100px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-20">
          {/* Back Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </Link>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-slate-900/35 px-4 py-2 text-xs text-cyan-200 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              ARC TESTNET · FEATURE IN DEVELOPMENT
            </div>
          </motion.div>

          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl" />
              <div className="relative bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl p-8 border border-cyan-500/25">
                <Construction className="h-16 w-16 text-cyan-400" />
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl md:text-6xl font-black tracking-tight text-center mb-6"
          >
            <span className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
              🚧 Pools
            </span>
            <br />
            <span className="text-2xl md:text-3xl font-semibold text-slate-400 mt-2 block">
              Under Construction
            </span>
          </motion.h1>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-2xl mx-auto text-center space-y-6"
          >
            <p className="text-lg md:text-xl text-slate-300 leading-relaxed">
              We are building a mini DEX (Swap + Liquidity Pools) focused on simple UX and stablecoin-first design on Arc Network.
            </p>
            <p className="text-base text-slate-400">
              Provide liquidity to earn fees and receive LP tokens. Built for builders who want stable, predictable returns on Arc Network.
            </p>
          </motion.div>

          {/* Coming Soon Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 flex justify-center"
          >
            <div className="inline-flex items-center gap-2 rounded-xl border border-purple-500/50 bg-purple-500/10 px-6 py-3 text-sm font-semibold text-purple-300">
              <span>Coming Soon</span>
            </div>
          </motion.div>

          {/* Feature Preview Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">Liquidity Pools</h3>
              <p className="text-sm text-slate-400">
                Add liquidity to trading pairs and earn fees from swaps
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-2">LP Tokens</h3>
              <p className="text-sm text-slate-400">
                Receive LP tokens representing your share of the liquidity pool
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  )
}

