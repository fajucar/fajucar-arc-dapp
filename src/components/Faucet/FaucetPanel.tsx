import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Droplet, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  FAUCET_ADDRESS,
  FAUCET_ABI,
  FAUCET_TOKENS,
  ARC_TESTNET_CHAIN_ID,
} from '@/config/faucet.arc-testnet'

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return '00:00:00'
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0'),
  ].join(':')
}

export type FaucetPanelVariant = 'compact' | 'normal'

interface FaucetPanelProps {
  variant?: FaucetPanelVariant
}

export function FaucetPanel({ variant = 'normal' }: FaucetPanelProps) {
  const { address, isConnected, chainId } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync, isPending, data: hash } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [claimingToken, setClaimingToken] = useState<string | null>(null)
  const [remainingByToken, setRemainingByToken] = useState<Record<string, number>>({})
  const [endsAtByToken, setEndsAtByToken] = useState<Record<string, number>>({})
  const [countdownByToken, setCountdownByToken] = useState<Record<string, string>>({})

  const isWrongChain = chainId != null && chainId !== ARC_TESTNET_CHAIN_ID

  const fetchRemaining = useCallback(async () => {
    if (!address || !publicClient) {
      setRemainingByToken({})
      setEndsAtByToken({})
      return
    }
    const now = Date.now()
    const next: Record<string, number> = {}
    const endsAt: Record<string, number> = {}
    for (const t of FAUCET_TOKENS) {
      try {
        const rem = (await publicClient.readContract({
          address: FAUCET_ADDRESS,
          abi: FAUCET_ABI,
          functionName: 'remaining',
          args: [address, t.address],
        })) as bigint
        const sec = Number(rem)
        next[t.symbol] = sec
        endsAt[t.symbol] = sec > 0 ? now + sec * 1000 : 0
      } catch {
        next[t.symbol] = 0
        endsAt[t.symbol] = 0
      }
    }
    setRemainingByToken(next)
    setEndsAtByToken(endsAt)
  }, [address, publicClient])

  useEffect(() => {
    if (!isConnected || isWrongChain) {
      setRemainingByToken({})
      setEndsAtByToken({})
      setCountdownByToken({})
      return
    }
    fetchRemaining()
  }, [isConnected, isWrongChain, address, chainId, fetchRemaining])

  useEffect(() => {
    if (!Object.keys(endsAtByToken).length) return
    const tick = () => {
      const now = Date.now()
      const next: Record<string, string> = {}
      for (const t of FAUCET_TOKENS) {
        const end = endsAtByToken[t.symbol] ?? 0
        if (end <= 0) {
          next[t.symbol] = '00:00:00'
          continue
        }
        const secLeft = Math.max(0, Math.floor((end - now) / 1000))
        next[t.symbol] = formatCountdown(secLeft)
      }
      setCountdownByToken((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAtByToken])

  useEffect(() => {
    if (isSuccess && hash) {
      setClaimingToken(null)
      toast.dismiss('claim-confirm')
      toast.success('Claim confirmado!')
      fetchRemaining()
    }
  }, [isSuccess, hash, fetchRemaining])

  const handleClaim = async (tokenSymbol: string) => {
    if (!address) {
      toast.error('Conecte a wallet')
      return
    }
    if (isWrongChain) {
      toast.error('Conecte à Arc Testnet')
      return
    }
    const token = FAUCET_TOKENS.find((t) => t.symbol === tokenSymbol)
    if (!token) return
    const rem = remainingByToken[tokenSymbol] ?? 0
    if (rem > 0) {
      toast.error('Cooldown ativo. Aguarde o countdown.')
      return
    }
    setClaimingToken(tokenSymbol)
    const toastId = toast.loading('Assinando claim...')
    try {
      await writeContractAsync({
        address: FAUCET_ADDRESS,
        abi: FAUCET_ABI,
        functionName: 'claim',
        args: [token.address],
      })
      toast.dismiss(toastId)
      toast.loading('Aguardando confirmação...', { id: 'claim-confirm' })
    } catch (err: unknown) {
      setClaimingToken(null)
      toast.dismiss(toastId)
      toast.dismiss('claim-confirm')
      const msg =
        (err as { shortMessage?: string; message?: string })?.shortMessage ||
        (err as { message?: string })?.message ||
        'Falha no claim'
      if (/rejected|denied|user denied/i.test(msg)) {
        toast.error('Transação cancelada')
      } else if (/cooldown|wait/i.test(msg)) {
        toast.error('Cooldown ainda ativo')
      } else if (/empty|vazio|insufficient/i.test(msg)) {
        toast.error('Faucet vazio')
      } else {
        toast.error(msg)
      }
    }
  }

  const isAnyClaiming = isPending || isConfirming

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-4 text-center">
        <Droplet className="h-10 w-10 text-slate-500 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Conecte a wallet para usar o faucet</p>
      </div>
    )
  }

  if (isWrongChain) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-200 text-sm">Rede incorreta</p>
          <p className="text-xs text-amber-200/90 mt-0.5">
            Conecte à Arc Testnet para reivindicar FAJU e ARCX.
          </p>
        </div>
      </div>
    )
  }

  const isCompact = variant === 'compact'

  return (
    <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
      {FAUCET_TOKENS.map((token) => {
        const rem = remainingByToken[token.symbol] ?? 0
        const canClaim = rem === 0
        const countdown = countdownByToken[token.symbol] ?? '00:00:00'
        const isThisClaiming = isAnyClaiming && claimingToken === token.symbol

        return (
          <div
            key={token.symbol}
            className={`rounded-lg border border-slate-700/40 bg-slate-800/20 flex flex-col gap-2 ${
              isCompact ? 'p-2.5' : 'p-4'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className={`font-semibold text-white shrink-0 ${isCompact ? 'text-xs' : ''}`}>
                Claim {token.claimAmount} {token.symbol}
              </h3>
              {!canClaim && (
                <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                  Cooldown · <span className="font-mono text-slate-300">{countdown}</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleClaim(token.symbol)}
              disabled={!canClaim || isAnyClaiming}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 text-white transition-colors ${
                isCompact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5'
              }`}
            >
              {isThisClaiming ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : (
                <Droplet className="h-4 w-4 shrink-0" />
              )}
              Claim {token.claimAmount} {token.symbol}
            </button>
          </div>
        )
      })}
    </div>
  )
}
