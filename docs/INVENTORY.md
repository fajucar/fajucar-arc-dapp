# Inventário do Repo FajuARC

## Páginas de Pools / My Pools

| Caminho | Arquivo | Descrição |
|---------|---------|-----------|
| `/pools` | `src/pages/PoolsPage.tsx` | Market overview — lista todos os pares via `useAllPools()` |
| `/my-pools` | `src/pages/MyPoolsPage.tsx` | Posições LP do usuário — `useUserPositions()` |
| `/arc-dex` | `src/pages/ArcDexTestPool.tsx` | Pool de teste / add liquidity direto |

## Configuração Arc Testnet

- **`src/config/arcTestnet.ts`** — Fonte única: Factory, Router, LiquidityHelper, tokens (USDC, EURC, FAJU, ARCX)
- **`src/config/arcDex.ts`** — Re-export de `ARCDEX` para Swap/Pools
- **`src/config/tokens.arc-testnet.ts`** — Tokens Arc Testnet
- **`src/config/deployments.arc-testnet.json`** — Endereços (factory, router, pair, liquidityHelper) — usado como fallback

## Como o app lê endereços

1. **Prioridade:** `import.meta.env.VITE_DEX_*` (`.env`)
2. **Fallback:** Valores hardcoded em `arcTestnet.ts`
3. **Opcional:** `deployments.arc-testnet.json` (alguns scripts)

Variáveis env relevantes: `VITE_DEX_FACTORY_ADDRESS`, `VITE_DEX_ROUTER_ADDRESS`, `VITE_ARC_RPC_URL`, `VITE_CHAIN_ID`.

## Hooks e libs de pools

- **`src/hooks/usePools.ts`** — `useAllPools()`, `useUserPositions()`
- **`src/lib/arcDexRead.ts`** — `getUserPools()`, `readPairState()`, `getPairAddress()`

## Rotas (App.tsx)

- `/` — Home
- `/swap` — Swap
- `/pools` — Pools (market)
- `/my-pools` — My Pools (posições)
- `/mint`, `/mint-legacy` — NFTs
- `/faucet` — Faucet
- `/arc-dex` — ArcDEX test pool

## Header / navegação

- **`src/components/Layout/Header.tsx`** — Links para Pools, My Pools, Swap, etc.

## Contratos existentes

- **`contracts/`** — ArcDEXPair, ArcDEXRouter, ArcDEXFactory, etc.
- **`hardhat.config.cjs`** — Solidity 0.8.20, network arcTestnet (5042002)
