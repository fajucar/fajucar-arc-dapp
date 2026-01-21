import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GlassCard } from './GlassCard'
import { GMButton } from '@/components/Web3/GMButton'
import { Sparkles, ArrowLeftRight, Waves } from 'lucide-react'

type StepCard = {
  title: string
  body: string
  align: "left" | "right"
  top: string
  left?: string
  right?: string
}

interface HeroProps {
  onNavigateToMint?: () => void
}

export function Hero({ onNavigateToMint }: HeroProps) {
  const cards = useMemo<StepCard[]>(
    () => [
      {
        title: "Deterministic Finality",
        body: "Transações com confirmação previsível e rápida, ideal para dApps que exigem UX fluido.",
        align: "left",
        top: "top-[14%]",
        left: "left-[4%]",
      },
      {
        title: "USDC como Gas",
        body: "Pague taxas com USDC (sem precisar de token extra), simplificando a entrada de novos usuários.",
        align: "right",
        top: "top-[34%]",
        right: "right-[4%]",
      },
      {
        title: "Stable Fees + Builder Focus",
        body: "Custos estáveis e ambiente perfeito para builders: mint, pagamentos, NFTs e automação on-chain.",
        align: "left",
        top: "top-[60%]",
        left: "left-[8%]",
      },
    ],
    []
  )

  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="h-full w-full bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950" />
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute top-[20%] -right-[10%] w-[50vw] h-[50vw] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 md:py-20">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-slate-900/35 px-4 py-2 text-xs text-cyan-200 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            ARC TESTNET ENVIRONMENT
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 text-4xl md:text-6xl font-black tracking-tight text-center"
        >
          <span className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
            ARC NETWORK
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-4 text-base md:text-lg text-slate-200/80 text-center max-w-2xl mx-auto"
        >
          Experience the future of deterministic finality. Native USDC gas, stable fees, and instant settlement.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <GMButton />
          
          {onNavigateToMint && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onNavigateToMint}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 font-bold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
            >
              <Sparkles className="h-5 w-5" />
              <span>Mint NFTs</span>
            </motion.button>
          )}

          <Link to="/swap">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/50 bg-purple-500/10 px-6 py-3 font-semibold hover:bg-purple-500/20 transition-all"
            >
              <ArrowLeftRight className="h-5 w-5" />
              <span>Swap</span>
            </motion.button>
          </Link>

          <Link to="/pools">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/50 bg-purple-500/10 px-6 py-3 font-semibold hover:bg-purple-500/20 transition-all"
            >
              <Waves className="h-5 w-5" />
              <span>Pools</span>
            </motion.button>
          </Link>
        </motion.div>

        {/* Hero Visual Area */}
        <div className="relative mt-10 md:mt-14 h-[520px] md:h-[560px]">
          {/* Glass Cards */}
          <div className="hidden md:block">
            {cards.map((card, idx) => (
              <GlassCard key={idx} {...card} delay={0.5 + idx * 0.1} />
            ))}
          </div>

          {/* Mobile Cards */}
          <div className="absolute left-0 right-0 bottom-0 z-20 md:hidden px-2">
            <div className="grid gap-3">
              {cards.map((c, idx) => (
                <motion.div
                  key={`m-${idx}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + idx * 0.1 }}
                  className="rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                    <h3 className="font-semibold">{c.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-200/85">{c.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

