# ArcDEX - Guia de Deploy

## Visão Geral

O ArcDEX é um fork simplificado do Uniswap V2 adaptado para Arc Network, usando USDC como gas token.

## Contratos Necessários

1. **ArcDEXFactory** - Factory para criar pools de liquidez
2. **ArcDEXRouter** - Router para executar swaps
3. **ArcDEXPair** - Contrato de pool (deployado automaticamente pela Factory)

## Passos para Deploy

### 1. Compilar Contratos

```bash
# Se você tem Hardhat configurado
npx hardhat compile

# Ou use Remix IDE: https://remix.ethereum.org
```

### 2. Deploy na Arc Testnet

#### a) Deploy Factory

```solidity
// No Remix ou script de deploy
ArcDEXFactory factory = new ArcDEXFactory();
// Anote o endereço do Factory
```

#### b) Deploy Router

```solidity
// Use o endereço do Factory do passo anterior
ArcDEXRouter router = new ArcDEXRouter(address(factory));
// Anote o endereço do Router
```

### 3. Criar Pool de Liquidez

```solidity
// Exemplo: Criar pool USDC/EURC
factory.createPair(USDC_ADDRESS, EURC_ADDRESS);
// Isso cria automaticamente um ArcDEXPair
```

### 4. Adicionar Liquidez Inicial

Para o swap funcionar, você precisa adicionar liquidez ao pool:

```solidity
// 1. Aprovar tokens
IERC20(USDC_ADDRESS).approve(pairAddress, amountUSDC);
IERC20(EURC_ADDRESS).approve(pairAddress, amountEURC);

// 2. Transferir tokens para o pair
IERC20(USDC_ADDRESS).transfer(pairAddress, amountUSDC);
IERC20(EURC_ADDRESS).transfer(pairAddress, amountEURC);

// 3. Chamar mint no pair
ArcDEXPair(pairAddress).mint(yourAddress);
```

## Configuração no Frontend

Após o deploy, adicione no `.env`:

```env
VITE_DEX_ROUTER_ADDRESS=0x... (endereço do Router)
VITE_DEX_FACTORY_ADDRESS=0x... (endereço do Factory - opcional)
```

> 📖 **Guia Detalhado**: Veja `docs/COMO_OBTER_ENDERECO_DEX.md` para instruções passo a passo de como obter o endereço após o deploy.

## Endereços Arc Testnet

- **USDC**: `0x3600000000000000000000000000000000000000`
- **EURC**: (verificar endereço correto no faucet)

## Notas Importantes

1. **Gas Token**: Arc Network usa USDC como gas token (não ETH)
   - Todas as transações custam USDC, não ETH
   - Certifique-se de ter USDC suficiente para gas
   - Obtenha USDC testnet no faucet: https://faucet.circle.com/

2. **Decimals**: USDC e EURC têm 6 decimais (não 18)
   - Use `parseUnits(amount, 6)` ao converter valores
   - Use `formatUnits(amount, 6)` ao exibir valores

3. **Liquidez**: Sem liquidez no pool, swaps não funcionam
   - Você precisa adicionar liquidez inicial antes de fazer swaps
   - Quanto mais liquidez, melhor a taxa de câmbio

4. **Fee**: O contrato cobra 0.3% de fee (padrão Uniswap V2)
   - Fee é deduzido automaticamente durante o swap
   - Liquidity providers recebem os fees

5. **Slippage**: Configure slippage tolerance adequado
   - Padrão recomendado: 0.5% - 1%
   - Para tokens voláteis, use 2-5%

## Testes

Após deploy, teste:

1. Criar pool USDC/EURC
2. Adicionar liquidez inicial (ex: 1000 USDC + 1000 EURC)
3. Testar swap no frontend

## Por que o swap reverte ("swapExactTokensForTokens reverted")

O **Router** chama `getAmountsOut(amountIn, path)` **dentro** de `swapExactTokensForTokens`. Se `getAmountsOut` reverter, o swap inteiro reverte.

Isso acontece quando:

1. **Router foi deployado com outra Factory**  
   O Router usa `factory.getPair(token0, token1)`. Se o Router foi deployado com um endereço de Factory diferente do que está em `deployments.arc-testnet.json`, ele não enxerga o par que você criou.

2. **Path usa token errado**  
   O par pode ter sido criado com um endereço de EURC (ex.: do faucet) e o frontend usar outro. O path deve usar exatamente os `token0`/`token1` do par (o frontend já faz isso).

**Solução definitiva:** redeploy do Router com a **mesma** Factory da config.

1. Abra o contrato `ArcDEXRouter.sol` no Remix (ou use o de `contracts/ArcDEXRouter.sol`).
2. No construtor, use **exatamente** o endereço da Factory da config:  
   `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`
3. Faça o deploy na Arc Testnet.
4. Atualize `deployments.arc-testnet.json` com o novo endereço do Router (se mudar).
5. Recarregue o frontend e tente o swap de novo.

O frontend agora verifica antes de simular: se `router.pairFor(path[0], path[1])` for zero ou diferente do par da Factory, mostra um erro claro em vez de "swap revertido".

## Troubleshooting

- **"INSUFFICIENT_LIQUIDITY"**: Pool não tem liquidez suficiente
- **"EXPIRED"**: Deadline muito curto (use timestamp futuro)
- **"INSUFFICIENT_OUTPUT_AMOUNT"**: Slippage muito baixo, aumentar tolerance
- **"O Router não encontra par" / "Router enxerga outro par"**: Redeploy do Router com a Factory da config (ver seção acima).
