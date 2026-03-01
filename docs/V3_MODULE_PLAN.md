# V3 Module Plan — Concentrated Liquidity

## Status: Scaffold only (placeholders, no deploy yet)

## Estrutura

```
src/
  modules/
    v2/
      SwapInterface.tsx   (existing — move/reference)
      PoolsPage.tsx
    v3/
      types.ts           (Position, Pool, feeTier, ticks)
      V3SwapPage.tsx     (placeholder)
      V3PositionsPage.tsx (placeholder)
      ManageV3Position.tsx (placeholder, Icarus-like layout)
```

## Configuração (futura)

Variáveis de ambiente para V3:

- `VITE_V3_FACTORY`
- `VITE_V3_SWAP_ROUTER`
- `VITE_V3_POSITION_MANAGER`
- `VITE_V3_QUOTER`

## UI Toggle

- **Swap:** "Simple (V2)" | "Pro (V3)" — toggle no topo
- **Pools:** "V2 Pools" | "V3 Positions" — tabs

## Checklist V3 real

- [ ] Deploy contratos V3 (Factory, Router, Position Manager, Quoter)
- [ ] Integrar SwapRouter para swap concentrated
- [ ] Integrar NonfungiblePositionManager para posições NFT
- [ ] Calcular ticks e range para add/remove liquidity
- [ ] Implementar ManageV3Position (increase/decrease/collect)
- [ ] Preço e TVL por posição
