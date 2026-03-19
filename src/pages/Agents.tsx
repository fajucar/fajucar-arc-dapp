import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { formatUnits, parseUnits, type Address } from 'viem'
import {
  Bot,
  Activity,
  ShieldCheck,
  Sparkles,
  ArrowLeftRight,
  Waves,
  Compass,
  Loader2,
  Wallet,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  CircleDashed,
  ExternalLink,
  Zap,
  Star,
  MessageSquareText,
  TriangleAlert,
  ImagePlus,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/Layout/AppShell'
import { buttonTap, fadeInUp } from '@/lib/motion'
import { ARCDEX } from '@/config/arcDex'
import { CONSTANTS } from '@/config/constants'
import { ARC_TESTNET_TOKENS } from '@/config/tokens.arc-testnet'
import { TokenSelectButton, type TokenSelectItem } from '@/components/TokenSelect'
import { quoteSwap, buildSwapPath } from '@/lib/dex/swapUtils'
import { getPairAddress, readPairState } from '@/lib/arcDexRead'
import { useAllPools } from '@/hooks/usePools'
import { useActivityLog, type ActivityEntry } from '@/hooks/useActivityLog'
import { formatNumber, formatPercent } from '@/lib/format'
import { useWalletModal } from '@/contexts/WalletModalContext'
import { ERC8004 } from '@/config/erc8004'
import { identityRegistryAbi } from '@/abis/identityRegistryAbi'
import {
  findLatestIdentityRegistryTokenIdForOwner,
  findOwnedIdentityRegistryTokenIdsForOwner,
  readRegisteredAgentIdentity,
} from '@/lib/erc8004'
import { reputationRegistryAbi } from '@/abis/reputationRegistryAbi'
import {
  createReputationWritePayload,
  formatReputationValue,
  readAgentReputation,
  type AgentReputationSummary,
} from '@/lib/erc8004Reputation'
import {
  ARC_PILOT_NAME,
  ARC_PILOT_TAGLINE,
  createAgentMetadataUri,
  fetchAgentMetadata,
  getAgentMetadataViewUrl,
  loadAgentMetadataOverride,
  normalizeAgentMetadata,
  resolveAgentImageUrl,
  saveAgentMetadataOverride,
  type AgentMetadata,
} from '@/lib/agentMetadata'
import { withTimeout } from '@/lib/async'
import {
  loadAgentsUsage,
  saveAgentsUsage,
  type AgentsUsageFlags,
  loadAgentsUiSnapshot,
  saveAgentsUiSnapshot,
} from '@/lib/agentsLocalState'

type AgentMode = 'swap' | 'pool' | 'guide' | 'register' | 'reputation' | null

type SwapAnalysis = {
  tokenInSymbol: string
  tokenOutSymbol: string
  inputAmount: string
  pairName: string
  pairAddress: Address
  route: string
  estimatedOutput: string
  priceImpact: number | null
  suggestedSlippage: number
}

type GuideStep = {
  label: string
  complete: boolean
}

type OnboardingStepKey = 'identity' | 'customize' | 'use' | 'reputation'

type AgentProfile = {
  agentId: string
  owner: Address
  metadataUri: string
  /** Present when registered in this session; hydrated agents may omit. */
  txHash?: `0x${string}`
  reputation: AgentReputationSummary | null
  metadata: AgentMetadata | null
}

type ReputationFeedbackChoice = 'helpful' | 'neutral' | 'not_helpful'

type ReputationFormState = {
  feedback: ReputationFeedbackChoice | null
  actionType: 'swap_guidance' | 'pool_discovery' | 'onboarding_support' | 'liquidity_help'
  reason: string
}

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const TOKEN_ITEMS: TokenSelectItem[] = ARC_TESTNET_TOKENS.map((token) => ({
  address: token.address,
  symbol: token.symbol,
  name: token.name,
  decimals: token.decimals,
}))

const AGENTS_SWAP_PREFILL_KEY = 'fajuarc:agents:swap-prefill'

function parseStoredAgentMode(value: string | null | undefined): AgentMode {
  if (!value || value === 'null') return null
  if (value === 'swap' || value === 'pool' || value === 'guide' || value === 'register' || value === 'reputation') {
    return value
  }
  return null
}

const REPUTATION_FEEDBACK_OPTIONS: Array<{
  id: ReputationFeedbackChoice
  label: string
  emoji: string
  activeClassName: string
  idleClassName: string
}> = [
  {
    id: 'helpful',
    label: 'Helpful',
    emoji: '👍',
    activeClassName: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100 shadow-lg shadow-emerald-500/10',
    idleClassName: 'border-slate-700/50 bg-slate-900/60 text-slate-200 hover:border-emerald-400/30 hover:bg-emerald-500/10',
  },
  {
    id: 'neutral',
    label: 'Neutral',
    emoji: '😐',
    activeClassName: 'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-lg shadow-amber-500/10',
    idleClassName: 'border-slate-700/50 bg-slate-900/60 text-slate-200 hover:border-amber-400/30 hover:bg-amber-500/10',
  },
  {
    id: 'not_helpful',
    label: 'Not helpful',
    emoji: '👎',
    activeClassName: 'border-rose-400/50 bg-rose-500/15 text-rose-100 shadow-lg shadow-rose-500/10',
    idleClassName: 'border-slate-700/50 bg-slate-900/60 text-slate-200 hover:border-rose-400/30 hover:bg-rose-500/10',
  },
]

function getReputationFeedbackValue(choice: ReputationFeedbackChoice) {
  switch (choice) {
    case 'helpful':
      return '1'
    case 'neutral':
      return '0'
    case 'not_helpful':
      return '-1'
  }
}

function parseTokenAmount(value: string, decimals: number): bigint | null {
  try {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = parseUnits(trimmed, decimals)
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Unable to read the selected image.'))
    reader.readAsDataURL(file)
  })
}

function getPoolStatus(reserve0Formatted: string, reserve1Formatted: string) {
  const totalLiquidity = Number(reserve0Formatted) + Number(reserve1Formatted)

  if (!Number.isFinite(totalLiquidity) || totalLiquidity <= 0) {
    return 'Empty / unavailable'
  }

  if (totalLiquidity < 1000) {
    return 'Low liquidity'
  }

  return 'Active'
}

function getSuggestedSlippage(priceImpact: number | null) {
  if (priceImpact == null) return 0.5
  if (priceImpact < 0.3) return 0.3
  if (priceImpact < 1) return 0.5
  if (priceImpact < 3) return 1
  return 2
}

function shortenAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function sanitizeActivityDetail(detail: string) {
  const normalized = detail.replace(/\s+/g, ' ').trim()
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized
}

function formatDisplayError(message: string | null | undefined) {
  if (!message) return ''

  let formatted = message.trim()

  formatted = formatted.replace(/data:[^\s]+/gi, '[metadata payload omitted]')
  formatted = formatted.replace(/0x[a-fA-F0-9]{40,}/g, (value) => `${value.slice(0, 10)}...${value.slice(-6)}`)

  for (const marker of ['Request Arguments:', 'Contract Call:', 'Docs:', 'Version:']) {
    const index = formatted.indexOf(marker)
    if (index > 0) {
      formatted = formatted.slice(0, index).trim()
      break
    }
  }

  formatted = formatted.replace(/\s+/g, ' ').trim()

  return formatted.length > 220 ? `${formatted.slice(0, 217)}...` : formatted
}

function formatReputationReadErrorMessage(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('eth_getlogs') || normalized.includes('limit') || normalized.includes('query returned more than')) {
    return 'Reputation history is temporarily too large for a full RPC scan. Try refreshing again in a moment.'
  }

  return sanitizeActivityDetail(message)
}

function getActivityAppearance(status: ActivityEntry['status']) {
  if (status === 'success') {
    return {
      icon: CheckCircle2,
      badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      iconClass: 'text-emerald-300',
      label: 'Success',
    }
  }

  if (status === 'error') {
    return {
      icon: XCircle,
      badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
      iconClass: 'text-rose-300',
      label: 'Failed',
    }
  }

  if (status === 'pending') {
    return {
      icon: Loader2,
      badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      iconClass: 'text-amber-200 animate-spin',
      label: 'Pending',
    }
  }

  return {
    icon: CircleDashed,
    badgeClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
    iconClass: 'text-cyan-200',
    label: 'Info',
  }
}

export function Agents() {
  const navigate = useNavigate()
  const { openModal } = useWalletModal()
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { switchChainAsync } = useSwitchChain()
  const isWrongChain = isConnected && chainId !== ARCDEX.chainId

  const [activeMode, setActiveMode] = useState<AgentMode>(null)
  const [tokenIn, setTokenIn] = useState<TokenSelectItem>(TOKEN_ITEMS[2] ?? TOKEN_ITEMS[0])
  const [tokenOut, setTokenOut] = useState<TokenSelectItem>(TOKEN_ITEMS[3] ?? TOKEN_ITEMS[1])
  const [amountIn, setAmountIn] = useState('1')
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapError, setSwapError] = useState<string | null>(null)
  const [swapAnalysis, setSwapAnalysis] = useState<SwapAnalysis | null>(null)
  const [resultNotice, setResultNotice] = useState<string | null>(null)
  const [tokenBalances, setTokenBalances] = useState<Record<string, bigint>>({})
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([])
  const [agentMetadataLoading, setAgentMetadataLoading] = useState(false)
  const [profileImageUploading, setProfileImageUploading] = useState(false)
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [reputationReadLoading, setReputationReadLoading] = useState(false)
  const [reputationReadError, setReputationReadError] = useState<string | null>(null)
  const [reputationWriteLoading, setReputationWriteLoading] = useState(false)
  const [reputationWriteError, setReputationWriteError] = useState<string | null>(null)
  const [reputationLastTxHash, setReputationLastTxHash] = useState<`0x${string}` | null>(null)
  const [reputationForm, setReputationForm] = useState<ReputationFormState>({
    feedback: null,
    actionType: 'swap_guidance',
    reason: '',
  })
  const [agentsUsageFlags, setAgentsUsageFlags] = useState<AgentsUsageFlags>({})
  const hydrationSeqRef = useRef(0)
  const uiRestoredForAddressRef = useRef<string | null>(null)
  const {
    activityLog,
    addActivity,
    updateActivity,
    markSuccess,
    markError,
  } = useActivityLog({
    maxItems: 6,
    formatDetail: sanitizeActivityDetail,
  })
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const { pools, loading: poolsLoading, error: poolsError } = useAllPools(Boolean(isWrongChain))

  const sortedPools = useMemo(() => {
    return [...pools].sort((a, b) => {
      const aLiquidity = Number(a.reserve0Formatted) + Number(a.reserve1Formatted)
      const bLiquidity = Number(b.reserve0Formatted) + Number(b.reserve1Formatted)
      return bLiquidity - aLiquidity
    })
  }, [pools])

  const bestPool = sortedPools[0] ?? null
  const activeAgent = agentProfiles[0] ?? null
  const activeAgentMetadata = normalizeAgentMetadata(activeAgent?.metadata)
  const activeMetadataViewUrl = activeAgent ? getAgentMetadataViewUrl(activeAgent.metadataUri) : null
  const activeAgentAvatarUrl = resolveAgentImageUrl(activeAgentMetadata.image)
  const visibleActivityLog = showAllActivity ? activityLog : activityLog.slice(0, 2)
  const displaySwapError = useMemo(() => formatDisplayError(swapError), [swapError])
  const displayRegisterError = useMemo(() => formatDisplayError(registerError), [registerError])
  const displayReputationError = useMemo(
    () => formatDisplayError(reputationWriteError ?? reputationReadError),
    [reputationReadError, reputationWriteError]
  )
  const reputationOverview = activeAgent?.reputation ?? null
  const hasArcPilotUsage = useMemo(() => {
    let hasSwapPrefill = false

    try {
      hasSwapPrefill = Boolean(window.sessionStorage.getItem(AGENTS_SWAP_PREFILL_KEY))
    } catch {
      hasSwapPrefill = false
    }

    const persisted =
      Boolean(agentsUsageFlags.swapAnalyzed) ||
      Boolean(agentsUsageFlags.poolSuggested) ||
      Boolean(agentsUsageFlags.swapPrefillSent)

    return hasSwapPrefill || swapAnalysis != null || persisted
  }, [agentsUsageFlags, swapAnalysis])
  const hasReputationEntries = (reputationOverview?.activeEntries ?? 0) > 0
  const onboardingSteps = useMemo<
    Array<{
      key: OnboardingStepKey
      label: string
      complete: boolean
      ctaLabel: string
    }>
  >(
    () => [
      {
        key: 'identity',
        label: 'Create Identity',
        complete: Boolean(activeAgent),
        ctaLabel: 'Register Agent',
      },
      {
        key: 'customize',
        label: 'Customize Profile',
        complete: Boolean(activeAgent && activeAgentAvatarUrl),
        ctaLabel: activeAgentAvatarUrl ? 'Edit Profile Image' : 'Upload Image',
      },
      {
        key: 'use',
        label: 'Use ArcPilot',
        complete: hasArcPilotUsage,
        ctaLabel: 'Analyze Swap',
      },
      {
        key: 'reputation',
        label: 'Build Reputation',
        complete: hasReputationEntries,
        ctaLabel: 'Leave Feedback',
      },
    ],
    [activeAgent, activeAgentAvatarUrl, hasArcPilotUsage, hasReputationEntries]
  )
  const currentOnboardingStepKey =
    onboardingSteps.find((step) => !step.complete)?.key ?? null
  const currentOnboardingStepIndex = onboardingSteps.findIndex((step) => step.key === currentOnboardingStepKey)
  const onboardingGuidance = useMemo(() => {
    if (!activeAgent) {
      return {
        title: 'Create your ArcPilot identity',
        detail: 'Start by registering your agent on Arc Testnet.',
      }
    }

    if (!activeAgentAvatarUrl) {
      return {
        title: 'Agent created — now upload a profile image',
        detail: 'Add a visual identity so ArcPilot feels ready to use.',
      }
    }

    if (!hasArcPilotUsage) {
      return {
        title: 'Profile ready — try using ArcPilot',
        detail: 'Analyze a swap or discover a pool to unlock the next step.',
      }
    }

    if (!hasReputationEntries) {
      return {
        title: 'Great — now build your reputation',
        detail: 'Leave feedback after using ArcPilot to start your onchain reputation history.',
      }
    }

    return {
      title: 'ArcPilot onboarding complete',
      detail: 'Your agent is set up, active, and already building reputation on Arc.',
    }
  }, [activeAgent, activeAgentAvatarUrl, hasArcPilotUsage, hasReputationEntries])
  const highlightRegisterCta = currentOnboardingStepKey === 'identity'
  const highlightCustomizeCta = currentOnboardingStepKey === 'customize'
  const highlightUseCta = currentOnboardingStepKey === 'use'
  const highlightReputationCta = currentOnboardingStepKey === 'reputation'
  const [highlightedOnboardingSection, setHighlightedOnboardingSection] = useState<OnboardingStepKey | null>(null)
  const onboardingHighlightTimeoutRef = useRef<number | null>(null)
  const createIdentitySectionRef = useRef<HTMLDivElement | null>(null)
  const customizeProfileSectionRef = useRef<HTMLDivElement | null>(null)
  const useArcPilotSectionRef = useRef<HTMLDivElement | null>(null)
  const buildReputationSectionRef = useRef<HTMLDivElement | null>(null)

  const navigateToOnboardingStep = useCallback((stepKey: OnboardingStepKey) => {
    if (stepKey === 'identity') setActiveMode('register')
    if (stepKey === 'use') setActiveMode('swap')
    if (stepKey === 'reputation') setActiveMode('reputation')

    const target =
      stepKey === 'identity'
        ? createIdentitySectionRef.current
        : stepKey === 'customize'
          ? customizeProfileSectionRef.current
          : stepKey === 'use'
            ? useArcPilotSectionRef.current
            : buildReputationSectionRef.current

    if (!target) return

    if (onboardingHighlightTimeoutRef.current) {
      window.clearTimeout(onboardingHighlightTimeoutRef.current)
    }

    setHighlightedOnboardingSection(stepKey)

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      target.focus({ preventScroll: true })
    })

    onboardingHighlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedOnboardingSection((current) => (current === stepKey ? null : current))
      onboardingHighlightTimeoutRef.current = null
    }, 1600)
  }, [])

  useEffect(() => {
    if (!address || !publicClient || !isConnected || isWrongChain) {
      setTokenBalances({})
      setBalancesLoading(false)
      return
    }

    let cancelled = false
    setBalancesLoading(true)

    const loadBalances = async () => {
      const next: Record<string, bigint> = {}

      for (const token of ARC_TESTNET_TOKENS) {
        try {
          const balance = (await publicClient.readContract({
            address: token.address,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          })) as bigint

          next[token.symbol] = balance
        } catch {
          next[token.symbol] = 0n
        }
      }

      if (!cancelled) {
        setTokenBalances(next)
        setBalancesLoading(false)
      }
    }

    loadBalances()

    return () => {
      cancelled = true
    }
  }, [address, publicClient, isConnected, isWrongChain])

  useEffect(() => {
    return () => {
      if (onboardingHighlightTimeoutRef.current) {
        window.clearTimeout(onboardingHighlightTimeoutRef.current)
      }
    }
  }, [])

  const ownedTokens = useMemo(() => {
    return ARC_TESTNET_TOKENS.filter((token) => (tokenBalances[token.symbol] ?? 0n) > 0n)
  }, [tokenBalances])

  const canSwap = ownedTokens.length > 0 && !isWrongChain && isConnected
  const canAddLiquidity = ownedTokens.length >= 2 && !isWrongChain && isConnected && sortedPools.length > 0

  const guideMessage = useMemo(() => {
    if (!isConnected) return 'Step 1: Connect wallet'
    if (isWrongChain) return 'Step 2: Switch to Arc Testnet'
    if (balancesLoading) return 'Checking wallet balances and Arc Testnet readiness...'
    if (ownedTokens.length === 0) return 'Step 3: Mint/get test tokens'
    if (canAddLiquidity) return 'Step 5: You can now add liquidity'
    return 'Step 4: You are ready to swap'
  }, [canAddLiquidity, isConnected, isWrongChain, balancesLoading, ownedTokens.length])

  const guideSteps = useMemo<GuideStep[]>(() => {
    return [
      { label: 'Wallet connected', complete: isConnected },
      { label: 'Correct network', complete: isConnected && !isWrongChain },
      { label: 'Has test tokens', complete: ownedTokens.length > 0 },
      { label: 'Ready to swap', complete: canSwap },
      { label: 'Ready to add liquidity', complete: canAddLiquidity },
    ]
  }, [canAddLiquidity, canSwap, isConnected, isWrongChain, ownedTokens.length])

  const upsertAgentProfile = useCallback((profile: AgentProfile) => {
    setAgentProfiles((current) => {
      const remaining = current.filter((entry) => entry.agentId !== profile.agentId)
      return [profile, ...remaining]
    })
  }, [])

  const updateAgentProfile = useCallback((agentId: string, patch: Partial<AgentProfile>) => {
    setAgentProfiles((current) =>
      current.map((entry) => (entry.agentId === agentId ? { ...entry, ...patch } : entry))
    )
  }, [])

  const loadAgentMetadata = useCallback(
    async (agentId: string, metadataUri: string) => {
      setAgentMetadataLoading(true)

      try {
        const metadata = await fetchAgentMetadata(metadataUri)
        const metadataOverride = loadAgentMetadataOverride(agentId)
        const nextMetadata = normalizeAgentMetadata({
          ...(metadata ?? {}),
          ...(metadataOverride ?? {}),
        })

        updateAgentProfile(agentId, {
          metadata: nextMetadata,
          metadataUri: metadataOverride ? createAgentMetadataUri(nextMetadata) : metadataUri,
        })
      } finally {
        setAgentMetadataLoading(false)
      }
    },
    [updateAgentProfile]
  )

  useEffect(() => {
    if (!address) {
      setAgentsUsageFlags({})
      return
    }
    setAgentsUsageFlags(loadAgentsUsage(address))
  }, [address])

  useEffect(() => {
    if (!address || isWrongChain) {
      setAgentProfiles([])
      hydrationSeqRef.current += 1
    }
  }, [address, isWrongChain])

  useEffect(() => {
    if (!address || isWrongChain) {
      uiRestoredForAddressRef.current = null
      return
    }
    if (uiRestoredForAddressRef.current === address) return
    const snap = loadAgentsUiSnapshot(address)
    if (snap) {
      if (snap.tokenInAddress) {
        const t = TOKEN_ITEMS.find((i) => i.address.toLowerCase() === snap.tokenInAddress?.toLowerCase())
        if (t) setTokenIn(t)
      }
      if (snap.tokenOutAddress) {
        const t = TOKEN_ITEMS.find((i) => i.address.toLowerCase() === snap.tokenOutAddress?.toLowerCase())
        if (t) setTokenOut(t)
      }
      if (snap.amountIn != null && snap.amountIn !== '') setAmountIn(snap.amountIn)
      if (snap.swapAnalysis != null && typeof snap.swapAnalysis === 'object') {
        setSwapAnalysis(snap.swapAnalysis as SwapAnalysis)
      }
      if (snap.resultNotice !== undefined) setResultNotice(snap.resultNotice)
      if (snap.activeMode !== undefined) {
        setActiveMode(parseStoredAgentMode(snap.activeMode))
      }
    }
    uiRestoredForAddressRef.current = address
  }, [address, isWrongChain])

  useEffect(() => {
    if (!address || isWrongChain) return
    const id = window.setTimeout(() => {
      saveAgentsUiSnapshot(address, {
        activeMode,
        tokenInAddress: tokenIn.address,
        tokenOutAddress: tokenOut.address,
        amountIn,
        swapAnalysis: swapAnalysis ?? undefined,
        resultNotice,
      })
    }, 400)
    return () => window.clearTimeout(id)
  }, [address, isWrongChain, activeMode, tokenIn, tokenOut, amountIn, swapAnalysis, resultNotice])

  useEffect(() => {
    if (!address || !publicClient || isWrongChain) return

    const owner = address
    const mySeq = ++hydrationSeqRef.current
    let cancelled = false

    void (async () => {
      try {
        const ids = await findOwnedIdentityRegistryTokenIdsForOwner(publicClient, owner)
        const ordered = [...ids].reverse()
        const profiles: AgentProfile[] = []

        for (const agentId of ordered) {
          if (cancelled) return
          try {
            const identity = await readRegisteredAgentIdentity(publicClient, agentId)
            if (identity.owner.toLowerCase() !== owner.toLowerCase()) continue

            let reputation: AgentReputationSummary | null = null
            try {
              reputation = await readAgentReputation(publicClient, agentId)
            } catch {
              reputation = null
            }

            profiles.push({
              agentId: identity.agentId,
              owner: identity.owner,
              metadataUri: identity.metadataUri,
              reputation,
              metadata: null,
            })
          } catch {
            // skip invalid token
          }
        }

        if (cancelled || mySeq !== hydrationSeqRef.current || owner !== address) return
        setAgentProfiles(profiles)

        for (const p of profiles) {
          if (cancelled || mySeq !== hydrationSeqRef.current) break
          void loadAgentMetadata(p.agentId, p.metadataUri)
        }
      } catch (e) {
        console.error('Agents hydration failed', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [address, publicClient, isWrongChain, loadAgentMetadata])

  const handleOpenImagePicker = useCallback(() => {
    imageInputRef.current?.click()
  }, [])

  const handleProfileImageChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      if (!activeAgent) {
        addActivity('Upload Image', 'Register Agent before uploading a profile image.', 'error')
        event.target.value = ''
        return
      }

      const activityId = addActivity('Upload Image', `Uploading ${file.name}...`, 'pending')
      setProfileImageUploading(true)
      setResultNotice('Updating ArcPilot profile image...')

      try {
        const image = await withTimeout(readFileAsDataUrl(file), 8000, 'read profile image')
        const nextMetadata = normalizeAgentMetadata({
          ...activeAgentMetadata,
          image,
        })

        saveAgentMetadataOverride(activeAgent.agentId, nextMetadata)
        updateAgentProfile(activeAgent.agentId, {
          metadata: nextMetadata,
          metadataUri: createAgentMetadataUri(nextMetadata),
        })
        setResultNotice('ArcPilot profile image updated.')
        markSuccess(activityId, 'ArcPilot profile image updated successfully.')
      } catch (error) {
        console.error('Upload profile image failed', error)
        setResultNotice('Profile image update failed.')
        markError(
          activityId,
          error instanceof Error && error.message
            ? error.message
            : 'Profile image update failed.'
        )
      } finally {
        setProfileImageUploading(false)
        event.target.value = ''
      }
    },
    [activeAgent, activeAgentMetadata, addActivity, markError, markSuccess, updateAgentProfile]
  )

  const persistSwapPrefillAndNavigate = useCallback(() => {
    try {
      window.sessionStorage.setItem(
        AGENTS_SWAP_PREFILL_KEY,
        JSON.stringify({
          tokenInAddress: tokenIn.address,
          tokenOutAddress: tokenOut.address,
          amountIn,
        }),
      )
    } catch {
      // Ignore storage failures and still navigate.
    }
    if (address) {
      saveAgentsUsage(address, { swapPrefillSent: true })
      setAgentsUsageFlags((prev) => ({ ...prev, swapPrefillSent: true }))
    }
    navigate('/swap')
  }, [address, amountIn, navigate, tokenIn.address, tokenOut.address])

  const handleGuideAction = useCallback(async () => {
    if (!isConnected) {
      openModal()
      return
    }

    if (isWrongChain) {
      try {
        await switchChainAsync({ chainId: ARCDEX.chainId })
      } catch {
        setResultNotice('Network switch was cancelled or failed. You can switch manually in your wallet.')
        addActivity('Guide action', 'Network switch was cancelled or failed.', 'error')
      }
      return
    }

    if (ownedTokens.length === 0) {
      navigate('/faucet')
      return
    }

    if (canAddLiquidity) {
      navigate('/pools')
      return
    }

    navigate('/swap')
  }, [addActivity, canAddLiquidity, isConnected, isWrongChain, navigate, openModal, ownedTokens.length, switchChainAsync])

  const handleAnalyzeSwap = useCallback(async () => {
    const routeUnavailableMessage = 'No route available for this token pair on Arc Testnet.'

    setActiveMode('swap')
    setSwapError(null)
    setSwapAnalysis(null)
    setResultNotice('Live swap analysis updated.')
    const activityId = addActivity(
      'Analyze Swap',
      `Checking ${tokenIn.symbol} -> ${tokenOut.symbol} for ${amountIn || '0'} input.`,
      'pending'
    )

    setSwapLoading(true)

    try {
      if (!publicClient) {
        throw new Error('Wallet RPC not available right now. Please try again.')
      }

      if (isWrongChain) {
        throw new Error('Switch to Arc Testnet to analyze swaps with live data.')
      }

      if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) {
        throw new Error('Choose two different tokens to analyze a route.')
      }

      const parsedAmountIn = parseTokenAmount(amountIn, tokenIn.decimals)
      if (!parsedAmountIn) {
        throw new Error('Enter a valid input amount first.')
      }

      const pairAddress =
        (await withTimeout(
          getPairAddress(tokenIn.address, tokenOut.address, publicClient),
          8000,
          'getPairAddress(tokenIn, tokenOut)'
        )) ??
        (await withTimeout(
          getPairAddress(tokenOut.address, tokenIn.address, publicClient),
          8000,
          'getPairAddress(tokenOut, tokenIn)'
        ))

      if (!pairAddress) {
        throw new Error(routeUnavailableMessage)
      }

      const pairState = await withTimeout(
        readPairState(pairAddress, publicClient),
        8000,
        'readPairState'
      )
      const path = buildSwapPath(tokenIn.address, tokenOut.address)

      const fromIsToken0 = pairState.token0.address.toLowerCase() === tokenIn.address.toLowerCase()
      const reserveIn = BigInt(fromIsToken0 ? pairState.reserve0 : pairState.reserve1)
      const reserveOut = BigInt(fromIsToken0 ? pairState.reserve1 : pairState.reserve0)

      if (reserveIn === 0n || reserveOut === 0n) {
        throw new Error(routeUnavailableMessage)
      }

      const reserveInHuman = Number(formatUnits(reserveIn, tokenIn.decimals))
      const reserveOutHuman = Number(formatUnits(reserveOut, tokenOut.decimals))
      const amountInHuman = Number(formatUnits(parsedAmountIn, tokenIn.decimals))

      const spotOutput = reserveInHuman > 0 ? amountInHuman * (reserveOutHuman / reserveInHuman) : 0
      const initialQuote = await withTimeout(
        quoteSwap(publicClient, ARCDEX.router, parsedAmountIn, path, 0.5),
        8000,
        'quoteSwap(initial)'
      )
      const quotedOutHuman = Number(formatUnits(initialQuote.amountOut, tokenOut.decimals))
      const priceImpact =
        spotOutput > 0 ? Math.max(0, ((spotOutput - quotedOutHuman) / spotOutput) * 100) : null
      const suggestedSlippage = getSuggestedSlippage(priceImpact)
      const finalQuote = await withTimeout(
        quoteSwap(publicClient, ARCDEX.router, parsedAmountIn, path, suggestedSlippage),
        8000,
        'quoteSwap(final)'
      )

      setSwapAnalysis({
        tokenInSymbol: tokenIn.symbol,
        tokenOutSymbol: tokenOut.symbol,
        inputAmount: amountIn,
        pairName: `${pairState.token0.symbol} / ${pairState.token1.symbol}`,
        pairAddress,
        route: `${tokenIn.symbol} → ${tokenOut.symbol}`,
        estimatedOutput: formatNumber(formatUnits(finalQuote.amountOut, tokenOut.decimals), 6),
        priceImpact,
        suggestedSlippage,
      })
      markSuccess(activityId, `Route ready for ${tokenIn.symbol} -> ${tokenOut.symbol}.`)
      if (address) {
        saveAgentsUsage(address, { swapAnalyzed: true })
        setAgentsUsageFlags((prev) => ({ ...prev, swapAnalyzed: true }))
      }
    } catch (error) {
      console.error('Analyze Swap failed', error)

      const message =
        error instanceof Error && error.message
          ? error.message
          : routeUnavailableMessage

      setSwapError(message)
      markError(activityId, message)
    } finally {
      setSwapLoading(false)
    }
  }, [addActivity, address, amountIn, isWrongChain, markError, markSuccess, publicClient, tokenIn, tokenOut])

  const handleSuggestPool = useCallback(() => {
    setActiveMode('pool')
    setResultNotice(bestPool ? 'Best pool suggestion refreshed.' : 'Pool scan completed.')
    addActivity(
      'Suggest Pool',
      bestPool ? `Top suggestion: ${bestPool.pairName}.` : 'No pools detected in current scan.',
      bestPool ? 'success' : 'info'
    )
    if (address) {
      saveAgentsUsage(address, { poolSuggested: true })
      setAgentsUsageFlags((prev) => ({ ...prev, poolSuggested: true }))
    }
  }, [addActivity, address, bestPool])

  const handleStartGuide = useCallback(() => {
    setActiveMode('guide')
    setResultNotice('Guide progress checked against your current dApp state.')
    addActivity('ArcPilot Guide', guideMessage, 'info')
  }, [addActivity, guideMessage])

  const loadReputationForAgent = useCallback(
    async (agentId: string, options?: { silent?: boolean; logActivity?: boolean }) => {
      if (!publicClient || isWrongChain) return

      if (!options?.silent) {
        setReputationReadLoading(true)
      }
      setReputationReadError(null)

      try {
        const reputation = await readAgentReputation(publicClient, agentId)
        updateAgentProfile(agentId, { reputation })

        if (options?.logActivity) {
          const detail =
            reputation.activeEntries > 0
              ? `Loaded ${reputation.activeEntries} active reputation entr${reputation.activeEntries === 1 ? 'y' : 'ies'} for Agent #${agentId}.`
              : `No reputation recorded yet for Agent #${agentId}.`
          addActivity('ArcPilot Reputation', detail, 'success')
        }
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? formatReputationReadErrorMessage(error.message)
            : 'Unable to load reputation data for the current agent.'

        setReputationReadError(message)
        if (options?.logActivity) {
          addActivity('ArcPilot Reputation', message, 'error')
        }
      } finally {
        if (!options?.silent) {
          setReputationReadLoading(false)
        }
      }
    },
    [addActivity, isWrongChain, publicClient, updateAgentProfile]
  )

  useEffect(() => {
    if (!activeAgent?.agentId || !publicClient || isWrongChain) return

    loadReputationForAgent(activeAgent.agentId, { silent: true })
  }, [activeAgent?.agentId, isWrongChain, loadReputationForAgent, publicClient])

  useEffect(() => {
    if (!activeAgent?.agentId || !activeAgent?.metadataUri) return
    if (activeAgent.metadata) return

    loadAgentMetadata(activeAgent.agentId, activeAgent.metadataUri)
  }, [activeAgent?.agentId, activeAgent?.metadata, activeAgent?.metadataUri, loadAgentMetadata])

  const handleRegisterAgent = useCallback(async () => {
    setActiveMode('register')
    setRegisterError(null)
    setResultNotice('Submitting IdentityRegistry registration...')
    const activityId = addActivity(
      'Register Agent',
      'Preparing IdentityRegistry registration on Arc Testnet.',
      'pending'
    )

    if (!isConnected || !address) {
      openModal()
      setRegisterError('Connect your wallet to register an on-chain agent identity.')
      markError(activityId, 'Registration failed.')
      return
    }

    if (isWrongChain) {
      setRegisterError('Switch to Arc Testnet before registering your agent identity.')
      markError(activityId, 'Registration failed.')
      return
    }

    if (!publicClient) {
      setRegisterError('Wallet RPC not available. Please try again in a moment.')
      markError(activityId, 'Registration failed.')
      return
    }

    setRegisterLoading(true)

    try {
      const txHash = await writeContractAsync({
        address: ERC8004.identityRegistry,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [ERC8004.defaultMetadataUri],
      })

      setResultNotice('Registration sent. Waiting for on-chain confirmation...')
      updateActivity(activityId, `Transaction submitted: ${txHash}`, 'pending')

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

      if (receipt.status !== 'success') {
        throw new Error('Registration failed.')
      }

      const recentTokenId =
        (await findLatestIdentityRegistryTokenIdForOwner(publicClient, address, receipt.blockNumber)) ??
        (await findLatestIdentityRegistryTokenIdForOwner(publicClient, address))

      if (!recentTokenId) {
        throw new Error('Registered successfully, but no agent ID was found in recent IdentityRegistry transfers.')
      }

      const identity = await readRegisteredAgentIdentity(publicClient, recentTokenId)

      hydrationSeqRef.current += 1
      upsertAgentProfile({
        ...identity,
        txHash,
        reputation: null,
        metadata: null,
      })
      setResultNotice('ArcPilot identity confirmed on Arc Testnet.')
      markSuccess(activityId, `Agent #${identity.agentId} registered successfully.`)
      await loadAgentMetadata(identity.agentId, identity.metadataUri)
      await loadReputationForAgent(identity.agentId, { silent: true, logActivity: true })
    } catch (error) {
      console.error('Register Agent failed', error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Registration failed. Please try again.'
      setRegisterError(message)
      setResultNotice('ArcPilot initialization failed.')
      markError(activityId, 'Registration failed.')
    } finally {
      setRegisterLoading(false)
    }
  }, [
    address,
    isConnected,
    isWrongChain,
    addActivity,
    loadAgentMetadata,
    loadReputationForAgent,
    markError,
    markSuccess,
    openModal,
    publicClient,
    updateActivity,
    upsertAgentProfile,
    writeContractAsync,
  ])

  const handleOpenReputation = useCallback(() => {
    setActiveMode('reputation')
    setReputationWriteError(null)
    setReputationLastTxHash(null)
    setResultNotice(
      activeAgent
        ? 'Prepare a reputation entry for ArcPilot.'
        : 'Activate ArcPilot before recording reputation.'
    )
  }, [activeAgent])

  const handleRecordReputation = useCallback(async () => {
    setActiveMode('reputation')
    setReputationWriteError(null)
    setReputationLastTxHash(null)

    if (!activeAgent) {
      setReputationWriteError('Activate ArcPilot before recording reputation.')
      return
    }

    if (!isConnected || !address) {
      openModal()
      setReputationWriteError('Connect an evaluator wallet to submit reputation.')
      return
    }

    if (isWrongChain) {
      setReputationWriteError('Switch to Arc Testnet before recording reputation.')
      return
    }

    if (activeAgent.owner.toLowerCase() === address.toLowerCase()) {
      setReputationWriteError('You cannot rate your own agent. Use another wallet.')
      return
    }

    if (!publicClient) {
      setReputationWriteError('Wallet RPC not available. Please try again in a moment.')
      return
    }

    if (!reputationForm.feedback) {
      setReputationWriteError('Choose a feedback option before submitting.')
      return
    }

    let payload: ReturnType<typeof createReputationWritePayload>

    try {
      payload = createReputationWritePayload({
        agentId: activeAgent.agentId,
        value: getReputationFeedbackValue(reputationForm.feedback),
        valueDecimals: 0,
        tag1: reputationForm.actionType,
        reason: reputationForm.reason,
      })
    } catch (error) {
      setReputationWriteError(error instanceof Error ? error.message : 'Feedback could not be prepared.')
      return
    }

    setReputationWriteLoading(true)
    setResultNotice('Requesting wallet confirmation for feedback submission...')
    const activityId = addActivity(
      'Submit Feedback',
      `Waiting for wallet confirmation to record feedback.`,
      'pending'
    )

    try {
      const txHash = await writeContractAsync({
        address: ERC8004.reputationRegistry,
        abi: reputationRegistryAbi,
        functionName: 'giveFeedback',
        args: [
          payload.agentId,
          payload.value,
          payload.valueDecimals,
          payload.tag1,
          payload.tag2,
          payload.endpoint,
          payload.feedbackURI,
          payload.feedbackHash,
        ],
      })

      setReputationLastTxHash(txHash)
      setResultNotice('Feedback transaction sent. Waiting for on-chain confirmation...')
      updateActivity(activityId, `Transaction submitted: ${txHash}`, 'pending')

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

      if (receipt.status !== 'success') {
        throw new Error('Reputation submission failed.')
      }

      await loadReputationForAgent(activeAgent.agentId, { silent: true, logActivity: false })

      setResultNotice('Feedback recorded successfully.')
      markSuccess(activityId, 'Feedback recorded successfully.')
      setReputationForm((current) => ({ ...current, feedback: null, reason: '' }))
    } catch (error) {
      console.error('Record Reputation failed', error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Feedback could not be recorded. Please try again.'
      setReputationWriteError(message)
      setResultNotice('Feedback submission failed.')
      markError(activityId, 'Feedback submission failed.')
    } finally {
      setReputationWriteLoading(false)
    }
  }, [
    activeAgent,
    addActivity,
    address,
    isConnected,
    isWrongChain,
    loadReputationForAgent,
    markError,
    markSuccess,
    openModal,
    publicClient,
    reputationForm,
    updateActivity,
    writeContractAsync,
  ])

  const isSelfRatingWallet = Boolean(
    activeAgent && address && activeAgent.owner.toLowerCase() === address.toLowerCase()
  )

  const guideCtaLabel = useMemo(() => {
    if (!isConnected) return 'Connect Wallet'
    if (isWrongChain) return 'Switch to Arc Testnet'
    if (ownedTokens.length === 0) return 'Get Test Tokens'
    if (canAddLiquidity) return 'Go to Pools'
    return 'Go to Swap'
  }, [canAddLiquidity, isConnected, isWrongChain, ownedTokens.length])

  const ResultStatusIcon = resultNotice
    ? CheckCircle2
    : CircleDashed

  const renderResultBox = () => {
    if (activeMode === 'swap') {
      if (swapLoading) {
        return (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-3 text-cyan-200">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <div>
                <div className="text-sm font-semibold">Analyzing live Arc Testnet route</div>
                <div className="text-xs text-slate-400">Checking pair availability, quote, price impact, and suggested slippage.</div>
              </div>
            </div>
          </div>
        )
      }

      if (swapError) {
        return (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-amber-200">Swap analysis unavailable</div>
                  <p className="mt-1 overflow-hidden break-words text-sm leading-6 text-amber-100/90">
                    {displaySwapError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/swap')}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-slate-900/40 px-4 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-slate-900/60"
                >
                  Open Swap
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      }

      if (swapAnalysis) {
        return (
          <div className="space-y-3">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                    <Zap className="h-3.5 w-3.5" />
                    Swap plan ready
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-white">
                    {swapAnalysis.tokenInSymbol} to {swapAnalysis.tokenOutSymbol}
                  </h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {swapAnalysis.inputAmount} {swapAnalysis.tokenInSymbol} {'->'}{' '}
                    <span className="font-semibold text-white">
                      {swapAnalysis.estimatedOutput} {tokenOut.symbol}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={persistSwapPrefillAndNavigate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-600"
                >
                  Use on Swap
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Input</div>
                <div className="mt-1.5 text-sm font-semibold text-white">
                  {swapAnalysis.inputAmount} {swapAnalysis.tokenInSymbol}
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Estimated output</div>
                <div className="mt-1.5 text-sm font-semibold text-cyan-300">
                  {swapAnalysis.estimatedOutput} {tokenOut.symbol}
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Price impact</div>
                <div className="mt-1.5 text-sm font-semibold text-white">
                  {swapAnalysis.priceImpact == null ? 'N/A' : formatPercent(swapAnalysis.priceImpact, 2)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Suggested slippage</div>
                <div className="mt-1.5 text-sm font-semibold text-white">{swapAnalysis.suggestedSlippage}%</div>
              </div>
            </div>

            <details className="rounded-xl border border-cyan-500/20 bg-slate-800/30 p-3 text-sm text-slate-300">
              <summary className="cursor-pointer list-none font-medium text-cyan-200">Swap details</summary>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <div>
                  <span className="text-slate-500">Route used:</span> {swapAnalysis.route}
                </div>
                <div>
                  <span className="text-slate-500">Pair used:</span> {swapAnalysis.pairName}
                </div>
              </div>
              <div className="mt-2 break-all text-xs text-slate-400">
                <span className="text-slate-500">Pair address:</span> {swapAnalysis.pairAddress}
              </div>
            </details>
          </div>
        )
      }
    }

    if (activeMode === 'pool') {
      if (poolsLoading) {
        return (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-3 text-cyan-200">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <div>
                <div className="text-sm font-semibold">Scanning pools on Arc Testnet</div>
                <div className="text-xs text-slate-400">Reviewing current liquidity and ranking the best candidate pool.</div>
              </div>
            </div>
          </div>
        )
      }

      if (poolsError) {
        return (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div className="space-y-3">
                <div className="text-sm font-semibold text-amber-200">Pool suggestion unavailable</div>
                <p className="text-sm leading-6 text-amber-100/90">{poolsError}</p>
                <button
                  type="button"
                  onClick={() => navigate('/pools')}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-slate-900/40 px-4 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-slate-900/60"
                >
                  Open Pools
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      }

      if (sortedPools.length === 0) {
        return (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
            <div className="flex items-start gap-3">
              <CircleDashed className="mt-0.5 h-5 w-5 text-slate-400" />
              <div className="space-y-3">
                <div className="text-sm font-semibold text-white">No pools detected yet</div>
                <p className="text-sm leading-6 text-slate-300">There are no active pools available from the current Arc Testnet pool scan.</p>
                <button
                  type="button"
                  onClick={() => navigate('/pools')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/40 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900/60"
                >
                  Open Pools
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      }

      return (
        <div className="space-y-3">
          {bestPool && (
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                    <Waves className="h-3.5 w-3.5" />
                    Best pool suggestion
                  </div>
                  <div className="mt-2 text-base font-semibold text-white">{bestPool.pairName}</div>
                  <div className="mt-1 text-sm text-slate-300">
                    Liquidity: {formatNumber(bestPool.reserve0Formatted, 4)} {bestPool.token0.symbol} +{' '}
                    {formatNumber(bestPool.reserve1Formatted, 4)} {bestPool.token1.symbol}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Status: <span className="font-semibold text-white">{getPoolStatus(bestPool.reserve0Formatted, bestPool.reserve1Formatted)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/pools')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-600"
                >
                  Open Pools
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <details className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-white">
              More pool options
            </summary>
            <div className="mt-3 space-y-2">
              {sortedPools.slice(0, 4).map((pool) => {
              const status = getPoolStatus(pool.reserve0Formatted, pool.reserve1Formatted)
              return (
                <div
                  key={pool.pairAddress}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{pool.pairName}</div>
                      <div className="mt-1 break-all text-xs text-slate-500">{pool.pairAddress}</div>
                    </div>
                    <div
                      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                        status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : status === 'Low liquidity'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-700/60 text-slate-300 border border-slate-600/40'
                      }`}
                    >
                      {status}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-slate-300">
                    {formatNumber(pool.reserve0Formatted, 4)} {pool.token0.symbol} +{' '}
                    {formatNumber(pool.reserve1Formatted, 4)} {pool.token1.symbol}
                  </div>
                </div>
              )
            })}
            </div>
          </details>
        </div>
      )
    }

    if (activeMode === 'register') {
      if (registerLoading) {
        return (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-3 text-cyan-200">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              <div>
                <div className="text-sm font-semibold">Initializing ArcPilot on IdentityRegistry</div>
                <div className="text-xs text-slate-400">
                  Sending `register(metadataURI)` and waiting for the Transfer event that returns your new agent ID.
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 text-sm text-slate-300">
              <div className="font-semibold text-white">{ARC_PILOT_NAME}</div>
              <div className="mt-1 text-slate-400">{ARC_PILOT_TAGLINE}</div>
            </div>
          </div>
        )
      }

      if (registerError) {
        return (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-amber-200">ArcPilot initialization unavailable</div>
                  <p className="mt-1 overflow-hidden break-words text-sm leading-6 text-amber-100/90">
                    {displayRegisterError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRegisterAgent}
                  disabled={registerLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-slate-900/40 px-4 py-2 text-sm font-medium text-amber-100 transition-colors hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Retry Registration
                  <Bot className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      }

      if (activeAgent) {
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                    <Bot className="h-3.5 w-3.5" />
                    ArcPilot active
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white">Agent #{activeAgent.agentId}</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Registration status: <span className="font-semibold text-emerald-300">Registered</span>
                  </p>
                </div>
                {activeAgent.txHash ? (
                  <a
                    href={`${CONSTANTS.LINKS.explorer}/tx/${activeAgent.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-600"
                  >
                    View Transaction
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-slate-400">
                    Loaded from chain (no registration tx in session)
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Agent ID</div>
                <div className="mt-2 text-sm font-semibold text-white">{activeAgent.agentId}</div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Owner</div>
                <div className="mt-2 text-sm font-semibold text-white">{shortenAddress(activeAgent.owner)}</div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
                <div className="mt-2 text-sm font-semibold text-emerald-300">Registered</div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Tx hash</div>
                <div className="mt-2 text-sm font-semibold text-cyan-300">
                  {activeAgent.txHash ? shortenAddress(activeAgent.txHash) : '—'}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-slate-800/30 p-4 text-sm text-slate-300">
              <div>
                <span className="text-slate-500">IdentityRegistry:</span> {ERC8004.identityRegistry}
              </div>
              <div className="mt-2">
                <span className="text-slate-500">Owner:</span> {activeAgent.owner}
              </div>
              {activeMetadataViewUrl && (
                <a
                  href={activeMetadataViewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-cyan-200 underline underline-offset-4"
                >
                  View Metadata
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        )
      }

      return (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
          <div className="flex items-start gap-3">
            <CircleDashed className="mt-0.5 h-5 w-5 text-slate-400" />
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-white">{ARC_PILOT_NAME} not initialized</div>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {ARC_PILOT_TAGLINE}
                </p>
                <div className="mt-2 text-xs font-medium uppercase tracking-wide text-cyan-300">Activate ArcPilot</div>
              </div>
              <button
                type="button"
                onClick={handleRegisterAgent}
                disabled={registerLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Register Agent
                <Bot className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (activeMode === 'reputation') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-slate-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
                  <MessageSquareText className="h-3.5 w-3.5" />
                      Feedback
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">
                      {activeAgent ? `Share feedback for ${activeAgentMetadata.name}` : `${ARC_PILOT_NAME} not available yet`}
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  {activeAgent
                        ? "Tell ArcPilot whether this agent was helpful. Your feedback is recorded onchain and refreshes the reputation summary automatically."
                    : 'Activate ArcPilot first so reputation can be attached to a concrete agent ID.'}
                </p>
              </div>
              {activeAgent && (
                <button
                  type="button"
                  onClick={() => loadReputationForAgent(activeAgent.agentId, { logActivity: true })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/70"
                >
                  Refresh Reputation
                  {reputationReadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {!activeAgent ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5 text-sm text-slate-300">
              Activate ArcPilot before opening the reputation form.
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Target agent</div>
                  <div className="mt-2 text-sm font-semibold text-white">#{activeAgent.agentId}</div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Current reputation</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {reputationOverview?.summaryValue != null && reputationOverview.summaryValueDecimals != null
                      ? formatReputationValue(reputationOverview.summaryValue, reputationOverview.summaryValueDecimals)
                      : reputationOverview?.activeEntries
                        ? `${reputationOverview.activeEntries} entries`
                        : 'No reputation yet'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Entries</div>
                  <div className="mt-2 text-sm font-semibold text-white">{reputationOverview?.activeEntries ?? 0}</div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Latest action</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {reputationOverview?.latestActivity?.tag1 || 'No activity yet'}
                  </div>
                </div>
              </div>

              {isSelfRatingWallet && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <div className="flex items-start gap-3">
                    <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-300" />
                    <div>
                      <div className="font-semibold text-amber-200">Self-rating unavailable</div>
                      <div className="mt-1 leading-6">You cannot rate your own agent. Use another wallet.</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4 sm:p-5">
                <div className="text-center">
                  <div className="text-sm font-semibold text-white">Did this agent help you?</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Your feedback helps build the agent&apos;s onchain reputation.
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {REPUTATION_FEEDBACK_OPTIONS.map((option) => {
                    const isSelected = reputationForm.feedback === option.id

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setReputationWriteError(null)
                          setReputationForm((current) => ({ ...current, feedback: option.id }))
                        }}
                        disabled={reputationWriteLoading || isSelfRatingWallet}
                        className={`inline-flex min-w-[132px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          isSelected ? option.activeClassName : option.idleClassName
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        <span aria-hidden="true">{option.emoji}</span>
                        {option.label}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 text-center text-xs text-slate-500">
                  Feedback is currently recorded onchain under the ArcPilot `swap_guidance` context.
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="text-xs uppercase tracking-wide text-slate-500">Optional comment</span>
                  <textarea
                    value={reputationForm.reason}
                    onChange={(event) =>
                      setReputationForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Optional: add a short comment"
                    className="w-full rounded-xl border border-slate-700/50 bg-slate-900/70 px-4 py-3 text-white placeholder:text-slate-500 focus:border-fuchsia-500/50 focus:outline-none"
                  />
                </label>

                {(reputationWriteError || reputationReadError) && (
                  <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                    <span className="block overflow-hidden break-words">
                      {displayReputationError}
                    </span>
                  </div>
                )}

                {reputationLastTxHash && !reputationWriteError && (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    Feedback recorded successfully.{' '}
                    <a
                      href={`${CONSTANTS.LINKS.explorer}/tx/${reputationLastTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-emerald-200 underline underline-offset-4"
                    >
                      View transaction
                    </a>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRecordReputation}
                    disabled={reputationWriteLoading || isSelfRatingWallet || !reputationForm.feedback}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-colors hover:bg-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reputationWriteLoading ? 'Submitting...' : 'Submit Feedback'}
                    {reputationWriteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                  </button>
                  {isSelfRatingWallet && (
                    <span className="text-sm text-amber-200">
                      You cannot rate your own agent. Use another wallet.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )
    }

    if (activeMode === 'guide') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-slate-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  <Compass className="h-3.5 w-3.5" />
                  Smart onboarding
                </div>
                <div className="mt-3 text-lg font-semibold text-white">Recommended next step</div>
                <p className="mt-1 text-sm font-medium text-slate-200">{guideMessage}</p>
              </div>
              <button
                type="button"
                onClick={handleGuideAction}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-600"
              >
                {guideCtaLabel}
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {guideSteps.map((step) => {
              const Icon = step.complete ? CheckCircle2 : CircleDashed
              return (
                <div
                  key={step.label}
                  className={`rounded-xl border p-4 ${
                    step.complete
                      ? 'border-emerald-500/30 bg-emerald-500/10'
                      : 'border-slate-700/50 bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${step.complete ? 'text-emerald-300' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-sm font-semibold text-white">{step.label}</div>
                      <div className="text-xs text-slate-400">{step.complete ? 'Completed' : 'Pending'}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {ownedTokens.length > 0 && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Token balance snapshot</div>
              <div className="flex flex-wrap gap-2">
                {ownedTokens.map((token) => (
                  <div
                    key={token.address}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-600/50 bg-slate-900/60 px-3 py-1 text-xs text-slate-300"
                  >
                    <Wallet className="h-3.5 w-3.5 text-cyan-400" />
                    {token.symbol}: {formatNumber(formatUnits(tokenBalances[token.symbol] ?? 0n, token.decimals), 4)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
        <div className="flex items-start gap-3">
          <CircleDashed className="mt-0.5 h-5 w-5 text-slate-400" />
          <div>
            <div className="text-sm font-semibold text-white">{ARC_PILOT_NAME} ready.</div>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              Choose an action to analyze swaps, discover pools, guide onboarding, or build onchain reputation.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>ArcPilot - FajuARC</title>
        <meta
          name="description"
          content="ArcPilot is your onchain guide for swaps, pools, and reputation on Arc."
        />
      </Helmet>

      <AppShell
        title="ArcPilot"
        subtitle={ARC_PILOT_TAGLINE}
        titleClassName="text-xl md:text-2xl font-semibold tracking-tight"
        maxWidth="8xl"
        compact
      >
        <div className="space-y-3.5 lg:space-y-4">
          <motion.div
            {...fadeInUp}
            className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Experimental Feature
          </motion.div>

          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.95fr)] xl:items-stretch">
            <motion.section
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.04 }}
              className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-3.5 sm:p-4 shadow-lg shadow-black/20"
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfileImageChange}
                className="hidden"
              />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-300 ring-1 ring-cyan-500/30">
                    {activeAgentAvatarUrl ? (
                      <img
                        src={activeAgentAvatarUrl}
                        alt={activeAgentMetadata.name ?? ARC_PILOT_NAME}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Bot className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{ARC_PILOT_NAME}</h2>
                    <div className="mt-1 text-sm font-medium text-cyan-200">Onchain Assistant</div>
                    <p className="mt-1 text-sm text-slate-400">
                      {ARC_PILOT_TAGLINE}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleOpenImagePicker}
                    disabled={!activeAgent || profileImageUploading}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-900/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {profileImageUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {activeAgentAvatarUrl ? 'Edit Profile Image' : 'Upload Image'}
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200">
                    <span className={`h-2 w-2 rounded-full ${activeAgent ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    {activeAgent ? 'ArcPilot Active' : 'ArcPilot Not Initialized'}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 sm:p-3.5">
                <div className="overflow-x-auto pb-1">
                  <div className="grid min-w-[520px] grid-cols-4 gap-1.5">
                    {onboardingSteps.map((step, index) => {
                      const isCurrent = currentOnboardingStepKey === step.key
                      const isLocked =
                        currentOnboardingStepIndex >= 0 &&
                        index > currentOnboardingStepIndex &&
                        !step.complete

                      const containerClassName = step.complete
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                        : isCurrent
                          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100'
                          : 'border-slate-700/50 bg-slate-950/40 text-slate-400'

                      const iconClassName = step.complete
                        ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-200'
                        : isCurrent
                          ? 'border-cyan-400/30 bg-cyan-500/20 text-cyan-200'
                          : isLocked
                            ? 'border-slate-700/50 bg-slate-900/70 text-slate-500'
                            : 'border-slate-700/50 bg-slate-900/70 text-slate-400'

                      return (
                        <button
                          key={step.key}
                          type="button"
                          onClick={() => navigateToOnboardingStep(step.key)}
                          className={`rounded-lg border px-2.5 py-2.5 text-left transition-colors hover:border-cyan-400/30 hover:bg-slate-900/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${containerClassName}`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${iconClassName}`}
                            >
                              {step.complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-wide">
                              {step.complete ? 'Complete' : isCurrent ? 'Current' : isLocked ? 'Locked' : 'Pending'}
                            </span>
                          </div>
                          <div className="mt-1.5 text-sm font-semibold leading-5">{step.label}</div>
                          <div className="mt-0.5 text-[11px] opacity-75">{step.ctaLabel}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-slate-700/50 bg-slate-950/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">{onboardingGuidance.title}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{onboardingGuidance.detail}</div>
                  </div>
                  {currentOnboardingStepKey && (
                    <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Next: {onboardingSteps.find((step) => step.key === currentOnboardingStepKey)?.ctaLabel}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-2.5 min-h-[78px]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <Bot className="h-4 w-4 text-sky-400" />
                    Agent ID
                  </div>
                  <div className="mt-1.5 text-base font-semibold text-white">{activeAgent ? `#${activeAgent.agentId}` : '--'}</div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-2.5 min-h-[78px]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <Wallet className="h-4 w-4 text-cyan-400" />
                    Owner
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-white">
                    {activeAgent ? shortenAddress(activeAgent.owner) : 'No wallet linked'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-2.5 min-h-[78px]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <Bot className="h-4 w-4 text-emerald-400" />
                    Status
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-emerald-300">
                    {activeAgent ? 'Registered' : 'Not registered'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-2.5 min-h-[78px]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Reputation
                  </div>
                  <div className="mt-1.5 text-base font-semibold text-white">
                    {reputationReadLoading
                      ? 'Loading...'
                      : reputationOverview?.summaryValue != null && reputationOverview.summaryValueDecimals != null
                        ? formatReputationValue(reputationOverview.summaryValue, reputationOverview.summaryValueDecimals)
                        : reputationOverview?.activeEntries
                          ? `${reputationOverview.activeEntries} entries`
                          : 'No reputation yet'}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {reputationOverview?.positiveCount ?? 0} positive / {reputationOverview?.negativeCount ?? 0} negative
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-2.5 min-h-[78px]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    Validation
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-amber-300">Not validated</div>
                  <div className="mt-0.5 text-xs leading-5 text-slate-500">
                    Validation will be available in a future ArcPilot update.
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-2.5 min-h-[78px]">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <ExternalLink className="h-4 w-4 text-fuchsia-300" />
                    Tx hash
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-fuchsia-100">
                    {activeAgent?.txHash ? shortenAddress(activeAgent.txHash) : '—'}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 sm:p-3.5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">
                      {agentMetadataLoading ? 'Loading ArcPilot metadata...' : activeAgentMetadata.name}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {activeAgentMetadata.description}
                    </p>
                  </div>
                  {activeMetadataViewUrl && (
                    <a
                      href={activeMetadataViewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-slate-950/40 px-3 py-2 text-sm font-medium text-cyan-200 transition-colors hover:bg-slate-950/60"
                    >
                      View Metadata
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-2.5 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 sm:p-3.5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Latest reputation activity</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {reputationOverview?.latestActivity
                        ? `${reputationOverview.latestActivity.tag1 || 'feedback'} scored ${formatReputationValue(
                            reputationOverview.latestActivity.value,
                            reputationOverview.latestActivity.valueDecimals
                          )} by ${shortenAddress(reputationOverview.latestActivity.clientAddress)}`
                        : 'No reputation recorded yet.'}
                    </div>
                  </div>
                  {activeAgent && (
                    <button
                      type="button"
                      onClick={handleOpenReputation}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-medium text-fuchsia-100 transition-colors hover:bg-fuchsia-500/20"
                    >
                      Leave Feedback
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {reputationReadError && (
                  <div className="mt-3 text-sm text-rose-300">{reputationReadError}</div>
                )}
              </div>

              <details className="mt-2.5 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 sm:p-3.5">
                <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                  Technical Details
                </summary>
                <div className="mt-4 grid gap-3 text-sm text-slate-300 xl:grid-cols-2">
                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
                    <span className="text-slate-500">IdentityRegistry:</span> {ERC8004.identityRegistry}
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
                    <span className="text-slate-500">ReputationRegistry:</span> {ERC8004.reputationRegistry}
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
                    <span className="text-slate-500">Full owner:</span> {activeAgent?.owner ?? '--'}
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3 break-all">
                    <span className="text-slate-500">Metadata URI:</span> {activeAgent?.metadataUri ?? '--'}
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
                    <span className="text-slate-500">Raw tx hash:</span> {activeAgent?.txHash ?? '--'}
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-3">
                    <span className="text-slate-500">Loaded agent profiles:</span> {agentProfiles.length}
                  </div>
                </div>
              </details>

              <div className="mt-3 border-t border-slate-700/50 pt-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Assistant Live Output</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {ARC_PILOT_TAGLINE}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
                    <ResultStatusIcon className="h-3.5 w-3.5 text-cyan-300" />
                    {resultNotice ?? 'Waiting for action'}
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/50 p-3.5 sm:p-4">
                  {renderResultBox()}
                </div>
              </div>
            </motion.section>

            <motion.aside
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.08 }}
              className="flex h-full flex-col rounded-2xl border border-slate-700/50 bg-slate-800/30 p-3.5 sm:p-4 shadow-lg shadow-black/20"
            >
              <div className="mb-4 text-sm font-semibold text-white">Available actions</div>
              <div className="flex flex-1 flex-col gap-3">
                <div
                  ref={createIdentitySectionRef}
                  tabIndex={-1}
                  className={`rounded-xl border bg-gradient-to-r from-fuchsia-500/15 via-purple-500/10 to-cyan-500/15 p-3.5 transition-all duration-300 focus:outline-none ${
                    highlightedOnboardingSection === 'identity'
                      ? 'border-emerald-400/50 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/10'
                      : 'border-fuchsia-500/30'
                  }`}
                >
                  <div className="mb-2 text-xs uppercase tracking-wide text-fuchsia-200">1. Create Identity</div>
                  <motion.button
                    type="button"
                    onClick={handleRegisterAgent}
                    disabled={registerLoading}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      highlightRegisterCta
                        ? 'bg-emerald-500 shadow-emerald-500/30 hover:bg-emerald-600'
                        : 'bg-fuchsia-500 shadow-fuchsia-500/30 hover:bg-fuchsia-600'
                    }`}
                    {...buttonTap}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      Register Agent
                    </span>
                    {registerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </motion.button>
                </div>

                <div
                  ref={customizeProfileSectionRef}
                  tabIndex={-1}
                  className={`rounded-xl border bg-slate-900/50 p-3.5 space-y-3 transition-all duration-300 focus:outline-none ${
                    highlightedOnboardingSection === 'customize'
                      ? 'border-emerald-400/50 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/10'
                      : 'border-slate-700/50'
                  }`}
                >
                  <div className="text-xs uppercase tracking-wide text-slate-500">2. Personalize</div>
                  <motion.button
                    type="button"
                    onClick={handleOpenImagePicker}
                    disabled={!activeAgent || profileImageUploading}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      highlightCustomizeCta
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
                        : 'border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60'
                    }`}
                    {...buttonTap}
                  >
                    <span className="inline-flex items-center gap-2">
                      <ImagePlus className="h-4 w-4" />
                      {activeAgentAvatarUrl ? 'Edit Profile Image' : 'Upload Image'}
                    </span>
                    {profileImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  </motion.button>
                </div>

                <div
                  ref={useArcPilotSectionRef}
                  tabIndex={-1}
                  className={`rounded-xl border bg-slate-900/50 p-3 space-y-2.5 transition-all duration-300 focus:outline-none ${
                    highlightedOnboardingSection === 'use'
                      ? 'border-emerald-400/50 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/10'
                      : 'border-slate-700/50'
                  }`}
                >
                  <div className="text-xs uppercase tracking-wide text-slate-500">3. Use ArcPilot</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Analyze Swap inputs</div>

                  <div className="grid gap-2 xl:grid-cols-2">
                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Token in</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={amountIn}
                          onChange={(e) => setAmountIn(e.target.value)}
                          placeholder="0.0"
                          className="w-full rounded-xl border border-slate-700/50 bg-slate-900/70 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                        />
                        <TokenSelectButton
                          tokens={TOKEN_ITEMS}
                          selected={tokenIn}
                          onSelect={(token) => setTokenIn(token)}
                          excludedAddress={tokenOut.address}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Token out</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          readOnly
                          value={swapAnalysis?.estimatedOutput ?? ''}
                          placeholder="Estimated output"
                          className="w-full rounded-xl border border-slate-700/50 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none"
                        />
                        <TokenSelectButton
                          tokens={TOKEN_ITEMS}
                          selected={tokenOut}
                          onSelect={(token) => setTokenOut(token)}
                          excludedAddress={tokenIn.address}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/50 bg-slate-900/70 text-slate-400">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <motion.button
                      type="button"
                      onClick={handleAnalyzeSwap}
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors sm:col-span-2 ${
                        highlightUseCta
                          ? 'bg-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600'
                          : 'bg-cyan-500 shadow-cyan-500/20 hover:bg-cyan-600'
                      }`}
                      {...buttonTap}
                    >
                      <span className="inline-flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4" />
                        Analyze Swap
                      </span>
                      {swapLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    </motion.button>

                    <motion.button
                      type="button"
                      onClick={handleSuggestPool}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-600 bg-slate-800/60 px-3.5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/60"
                      {...buttonTap}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Waves className="h-4 w-4" />
                        Suggest Pool
                      </span>
                    </motion.button>

                    <motion.button
                      type="button"
                      onClick={handleStartGuide}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-600 bg-slate-800/60 px-3.5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/60"
                      {...buttonTap}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Compass className="h-4 w-4" />
                        Start Guide
                      </span>
                    </motion.button>
                  </div>
                </div>

                <div
                  ref={buildReputationSectionRef}
                  tabIndex={-1}
                  className={`flex flex-1 flex-col rounded-xl border bg-slate-900/50 p-3 transition-all duration-300 focus:outline-none ${
                    highlightedOnboardingSection === 'reputation'
                      ? 'border-emerald-400/50 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/10'
                      : 'border-slate-700/50'
                  }`}
                >
                  <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">4. Build reputation</div>
                  <div className="mb-3 text-sm text-slate-400">
                    Capture one last signal from the user and keep ArcPilot&apos;s onchain reputation growing.
                  </div>
                  <motion.button
                    type="button"
                    onClick={handleOpenReputation}
                    disabled={!activeAgent}
                    className={`mt-auto flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      highlightReputationCta
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
                        : 'border-fuchsia-500/30 bg-slate-900/60 text-slate-100 hover:bg-slate-800/70'
                    }`}
                    {...buttonTap}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Leave Feedback
                    </span>
                    {reputationWriteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                  </motion.button>
                </div>
              </div>
            </motion.aside>
          </div>

          <motion.section
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: 0.12 }}
            className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4 shadow-lg shadow-black/20"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">Recent assistant activity</div>
              {activityLog.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllActivity((current) => !current)}
                  className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-900/80"
                >
                  {showAllActivity ? 'Show less' : 'View more'}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {activityLog.length === 0 ? (
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 text-sm text-slate-400">
                  ArcPilot ready. Choose an action to analyze swaps, discover pools, guide onboarding, or build onchain reputation.
                </div>
              ) : (
                visibleActivityLog.map((entry) => {
                  const appearance = getActivityAppearance(entry.status)
                  const Icon = appearance.icon

                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/50 bg-slate-950/60">
                            <Icon className={`h-4 w-4 ${appearance.iconClass}`} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">{entry.title}</div>
                            <div className="mt-1 text-sm text-slate-400">{entry.detail}</div>
                          </div>
                        </div>
                        <div className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${appearance.badgeClass}`}>
                          {appearance.label}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.section>
        </div>
      </AppShell>
    </>
  )
}
