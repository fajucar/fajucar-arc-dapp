# FajuFarm — Deploy via Remix

Passo a passo para deploy do FajuFarm (LP staking rewards) na Arc Testnet.

## Pré-requisitos

- Carteira com ARC para gas (Arc Testnet)
- Endereço do token FAJU: `0x0e8147CdB023474f440636051AA26f7DCaf2aEa7`

## 1. Compilar FajuFarm

1. Abra [Remix](https://remix.ethereum.org/)
2. Crie arquivo `FajuFarm.sol` e cole o conteúdo de `contracts/FajuFarm.sol`
3. Compile: Solidity 0.8.20, otimizer off
4. Verifique que compila sem erros

## 2. Deploy

1. Plugin **Deploy & run transactions**
2. **Environment:** Injected Provider (MetaMask/Rabby)
3. **Network:** Arc Testnet (chainId 5042002)
   - RPC: `https://rpc.testnet.arc.network`
   - Adicione a rede em MetaMask se não existir
4. **Contract:** FajuFarm
5. **Constructor args:**
   - `_rewardToken`: `0x0e8147CdB023474f440636051AA26f7DCaf2aEa7` (FAJU)
   - `_rewardPerSecond`: `1000000000000000000` (1e18 = 1 FAJU/segundo)
   - `_startTime`: timestamp atual (ex: `1730000000`)
   - `_endTime`: `0` (ilimitado) ou timestamp futuro (ex: start + 30 dias)

6. **Deploy** e aguarde confirmação
7. Copie o endereço do contrato

## 3. Configurar rewards

1. **Transferir FAJU** para o FajuFarm:
   - Contrato FAJU: `0x0e8147CdB023474f440636051AA26f7DCaf2aEa7`
   - `transfer(farmAddress, amount)` — ex: 1M FAJU = `1000000000000000000000000`

## 4. Adicionar pools

Chame no FajuFarm: `addPool(lpToken, allocPoint)`

| Par | LP Token (pair address) | allocPoint sugerido |
|-----|------------------------|---------------------|
| USDC/EURC | `0x8a674025863ae28F47dA98d95368586F07Be7142` | 100 |
| ARCX/EURC | `0x33B62Df8cd0B37df83A30eDB12F0e3Ec3a8A7995` | 100 |

Total allocPoint define a proporção: se ambos 100, cada pool recebe 50% dos rewards.

## 5. Configurar frontend

Adicione no `.env`:

```
VITE_FAJU_FARM_ADDRESS=0x... (endereço do FajuFarm deployado)
```

Reinicie o dev server.

## Deploy via Hardhat (alternativa)

```bash
# Configurar DEPLOYER_PRIVATE_KEY no .env
npx hardhat run scripts/deploy-fajufarm-hardhat.cjs --network arcTestnet --config hardhat.config.cjs
```

Saída: `VITE_FAJU_FARM_ADDRESS=0x...`
