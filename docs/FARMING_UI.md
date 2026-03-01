# FajuFarm — Como usar a UI

## Fluxo: Stake LP → Earn → Claim

1. **Add Liquidity** em Pools para obter LP tokens
2. Em **My Pools** → **Manage** em uma posição:
   - **Stake:** approve LP → stake
   - **Claim:** harvest rewards (FAJU)
   - **Unstake:** withdraw LP

## Campos na UI

- **LP Balance:** LP tokens na carteira (não staked)
- **Staked LP:** LP tokens no FajuFarm
- **Pending Rewards:** FAJU não coletados
- **APR:** estimativa anual (quando há TVL)

## APR estimado

```
APR = (rewardPerSecond * rewardPrice * secondsPerYear) / TVL * 100
```

- **rewardPrice:** fixo ou oracle; se não houver, "APR approximate"
- **TVL:** reserves do par × preços (USDC/EURC ≈ 1)
