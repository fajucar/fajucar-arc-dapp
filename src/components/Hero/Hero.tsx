import { motion } from 'framer-motion'
import { TransactionDemo } from '@/components/Demo/TransactionDemo'
import { ExternalLink } from 'lucide-react'
import { CONSTANTS } from '@/config/constants'
import { GMButton } from '@/components/Web3/GMButton'

interface HeroProps {
  onNavigateToMint?: () => void
}

export function Hero({}: HeroProps) {

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

        {/* Action Cards Grid with Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 max-w-7xl mx-auto"
        >
          {/* Desktop Layout (>=1024px) */}
          <div className="hidden lg:block space-y-6">
            {/* Send GM CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex justify-center pt-4"
            >
              <div className="[&>button]:rounded-full [&>button]:px-6 [&>button]:py-3 [&>button]:text-base [&>button]:font-semibold">
                <GMButton />
              </div>
            </motion.div>

            {/* Send USDC Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center"
            >
              <div className="w-full max-w-md">
                <TransactionDemo />
              </div>
            </motion.div>

            {/* 4 Cards em uma linha */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="grid grid-cols-4 gap-4"
            >
              <motion.a
                href={CONSTANTS.LINKS.docs}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-5 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[120px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                    <h3 className="text-white font-semibold tracking-wide">Documentation</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200/85">Learn about Arc Network</p>
                  <ExternalLink className="h-4 w-4 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors" />
                </div>
              </motion.a>

              <motion.a
                href={CONSTANTS.LINKS.explorer}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-5 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[120px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                    <h3 className="text-white font-semibold tracking-wide">Explorer</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200/85">Browse transactions</p>
                  <ExternalLink className="h-4 w-4 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors" />
                </div>
              </motion.a>

              <motion.a
                href={CONSTANTS.LINKS.faucet}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-5 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[120px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                    <h3 className="text-white font-semibold tracking-wide">Faucet</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200/85">Get test tokens</p>
                  <ExternalLink className="h-4 w-4 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors" />
                </div>
              </motion.a>

              <motion.a
                href={CONSTANTS.LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-5 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[120px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                    <h3 className="text-white font-semibold tracking-wide">GitHub</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200/85">View source code</p>
                  <ExternalLink className="h-4 w-4 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors" />
                </div>
              </motion.a>
            </motion.div>
          </div>

          {/* Tablet Layout (768px-1023px) */}
          <div className="hidden md:block lg:hidden space-y-6">
            {/* Send GM CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex justify-center pt-4"
            >
              <div className="[&>button]:rounded-full [&>button]:px-6 [&>button]:py-3 [&>button]:text-base [&>button]:font-semibold">
                <GMButton />
              </div>
            </motion.div>

            {/* Send USDC Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center"
            >
              <div className="w-full max-w-md">
                <TransactionDemo />
              </div>
            </motion.div>

            {/* Cards em 2 colunas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="grid grid-cols-2 gap-4"
            >
              <motion.a
              href={CONSTANTS.LINKS.docs}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[100px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                  <h3 className="text-white font-semibold text-sm">Documentation</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-200/85">Learn about Arc Network</p>
                  <ExternalLink className="h-3 w-3 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors mx-auto" />
              </div>
            </motion.a>

            <motion.a
              href={CONSTANTS.LINKS.explorer}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[100px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                  <h3 className="text-white font-semibold text-sm">Explorer</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-200/85">Browse transactions</p>
                  <ExternalLink className="h-3 w-3 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors mx-auto" />
              </div>
            </motion.a>

            <motion.a
              href={CONSTANTS.LINKS.faucet}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[100px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                  <h3 className="text-white font-semibold text-sm">Faucet</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-200/85">Get test tokens</p>
                  <ExternalLink className="h-3 w-3 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors mx-auto" />
              </div>
            </motion.a>

            <motion.a
              href={CONSTANTS.LINKS.github}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[100px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                  <h3 className="text-white font-semibold text-sm">GitHub</h3>
                </div>
                <p className="text-xs leading-relaxed text-slate-200/85">View source code</p>
                  <ExternalLink className="h-3 w-3 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors mx-auto" />
              </div>
            </motion.a>
            </motion.div>
          </div>

          {/* Mobile Layout (<768px) */}
          <div className="md:hidden space-y-4">
            {/* Send GM CTA primeiro */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="flex justify-center pt-4"
            >
              <div className="[&>button]:rounded-full [&>button]:px-5 [&>button]:py-2.5 [&>button]:text-sm [&>button]:font-semibold w-full max-w-xs">
                <GMButton />
              </div>
            </motion.div>

            {/* Send USDC Form */}
                <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <TransactionDemo />
            </motion.div>

            {/* Cards em 2 colunas se couber, senão 1 */}
            <div className="grid grid-cols-2 gap-4">
              <motion.a
                href={CONSTANTS.LINKS.docs}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[100px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                    <h3 className="text-white font-semibold text-sm">Documentation</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-200/85">Learn about Arc Network</p>
                  <ExternalLink className="h-3 w-3 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors mx-auto" />
                </div>
              </motion.a>

              <motion.a
                href={CONSTANTS.LINKS.explorer}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[100px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                    <h3 className="text-white font-semibold text-sm">Explorer</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-200/85">Browse transactions</p>
                  <ExternalLink className="h-3 w-3 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors mx-auto" />
                </div>
              </motion.a>

              <motion.a
                href={CONSTANTS.LINKS.faucet}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.99 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 motion-safe:transition-all motion-safe:duration-[250ms] motion-safe:ease-out shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] motion-safe:hover:border-cyan-500/40 motion-safe:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-center text-center justify-center min-h-[100px]">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                    <h3 className="text-white font-semibold text-sm">Faucet</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-200/85">Get test tokens</p>
                  <ExternalLink className="h-3 w-3 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors mx-auto" />
                </div>
              </motion.a>

              <motion.a
                href={CONSTANTS.LINKS.github}
                target="_blank"
                rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                whileHover={{ y: -2, scale: 1.01 }}
                className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-900/35 backdrop-blur-xl p-4 transition-all duration-300 shadow-[0_0_0_1px_rgba(34,211,238,0.10),0_20px_80px_rgba(0,0,0,0.45)] hover:border-cyan-500/40 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.20),0_20px_80px_rgba(0,0,0,0.45)]"
                >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 motion-safe:group-hover:opacity-100 motion-safe:transition-opacity" />
                <div className="relative flex flex-col gap-2 items-start text-left">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] animate-pulse" />
                    <h3 className="text-white font-semibold text-sm">GitHub</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-200/85">View source code</p>
                  <ExternalLink className="h-3 w-3 text-slate-400 motion-safe:group-hover:text-cyan-400 motion-safe:transition-colors mx-auto" />
                </div>
              </motion.a>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  )
}

