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

export function FaucetClaim() {
  const { address, isConnected, chainId } = useAccount()
  const publicClient = usePublicClient()
  const { writeContractAsync, isPending, data: hash } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const isWrongChain = chainId != null && chainId !== ARC_TESTNET_CHAIN_ID

  const [remainingByToken, setRemainingByToken] = useState<Record<string, number>>({})
  const [endsAtByToken, setEndsAtByToken] = useState<Record<string, number>>({})
  const [countdownByToken, setCountdownByToken] = useState<Record<string, string>>({})

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

  const isLoading = isPending || isConfirming

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-slate-700/40 bg-slate-800/20 p-6 text-center">
        <Droplet className="h-12 w-12 text-slate-500 mx-auto mb-3" />
        <p className="text-slate-400">Conecte a wallet para usar o faucet</p>
      </div>
    )
  }

  if (isWrongChain) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-200">Rede incorreta</p>
          <p className="text-sm text-amber-200/90 mt-1">
            Conecte à <strong>Arc Testnet</strong> (Chain ID 5042002) para reivindicar FAJU e ARCX.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {FAUCET_TOKENS.map((token) => {
        const rem = remainingByToken[token.symbol] ?? 0
        const canClaim = rem === 0
        const countdown = countdownByToken[token.symbol] ?? '00:00:00'

        return (
          <div
            key={token.symbol}
            className="rounded-2xl border border-slate-700/40 bg-slate-800/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h3 className="font-semibold text-white">Claim {token.claimAmount} {token.symbol}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cooldown de 24h entre claims
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!canClaim && (
                <span className="text-sm text-slate-300 font-mono">
                  Próximo em {countdown}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleClaim(token.symbol)}
                disabled={!canClaim || isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-700 text-white transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Droplet className="h-4 w-4" />
                )}
                Claim {token.claimAmount} {token.symbol}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
