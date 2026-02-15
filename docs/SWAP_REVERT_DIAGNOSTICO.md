# Diagnóstico: swapExactTokensForTokens Revert

## Resumo

O revert em `swapExactTokensForTokens` é causado por **incompatibilidade entre o Router on-chain e o USDC precompile** da Arc. O Router pode ter sido deployado com código que usa `IERC20.transferFrom()` direto; o USDC precompile não retorna `bool` em algumas chamadas → a tx reverte.

## Varredura nos Contratos (Repositório)

### 1. Router (`contracts/ArcDEXRouter.sol`)

| Verificação | Status | Detalhe |
|-------------|--------|---------|
| transferFrom | ✅ | Usa `_safeTransferFrom` com low-level `token.call(0x23b872dd)` |
| Retorno transferFrom | ✅ | `_ok(data)` aceita `data.length==0` ou valor truthy (tokens que retornam vazio) |
| getReserves Pair | ✅ | Interface espera 2 valores; Pair pode retornar 2 ou 3 (compatível) |
| supportsPrecompileTokens | ✅ | Existe e retorna true |
| Path / Factory | ✅ | Usa `factory.getPair()`, path = [tokenIn, tokenOut] |

O **código no repo** está correto. O problema está no **Router deployado** no endereço configurado.

### 2. Pair (`contracts/ArcDEXPair.sol`)

| Verificação | Status | Detalhe |
|-------------|--------|---------|
| transfer (saída do swap) | ✅ | `_safeTransfer` usa `_transferOk(data)` — aceita retorno vazio ou bool |
| balanceOf | ✅ | IERC20.balanceOf; precompile implementa normalmente |
| getReserves | ✅ | Retorna 3 valores; Router lê 2 (compatível) |
| lock reentrancy | ✅ | Modifier `lock` presente |
| K constant | ✅ | Fórmula Uniswap V2 padrão |

### 3. O que causa o revert on-chain

1. **Router antigo**: bytecode do Router usa `require(IERC20(path[0]).transferFrom(...))` em vez de low-level call → USDC precompile não retorna bool → revert.
2. **Approve em Router errado**: allowance foi dado a outro endereço; o Router em uso tem allowance zero.
3. **Pair antigo** (apenas se saída = USDC): Pair que envia USDC para o usuário usa `transfer` com expectativa de bool → revert. Para USDC→EURC o Pair **recebe** USDC (via Router) e **envia** EURC; EURC é ERC20 normal.

## Solução

### Opção A: Deploy do Router (Recomendado)

**Via Hardhat:**
```bash
# 1. Defina DEPLOYER_PRIVATE_KEY no .env
# 2. Execute:
npm run deploy:router
# 3. Copie o VITE_DEX_ROUTER_ADDRESS exibido para arcTestnet.ts, deployments e .env
```

**Via Remix:**
1. Abra [Remix](https://remix.ethereum.org).
2. Cole o conteúdo de `docs/ArcDEXRouter_Remix_Compila.sol`.
3. Compile: 0.8.20, Optimizer 200.
4. Deploy: Injected Provider → Arc Testnet.
5. Constructor: `0x0521040935960c6883B9AaBD9927F7889B0790f2` (Factory oficial).
6. Atualize arcTestnet.ts, deployments.arc-testnet.json e .env com o novo endereço.

**Após deploy:** reinicie o app, aprove USDC para o novo Router e teste.

### Opção B: Verificar o Router Atual

No [ArcScan](https://testnet.arcscan.app), abra o contrato do Router configurado:

- **Read** → `supportsPrecompileTokens()` deve retornar `true`.
- Se a função não existir ou retornar `false`, o Router é incompatível com USDC precompile.

## Contratos Corretos (Repo)

- **Router**: `contracts/ArcDEXRouter.sol` ou `docs/ArcDEXRouter_Remix_Compila.sol`
- **Pair**: `contracts/ArcDEXPair.sol` (com `_safeTransfer` / `_transferOk`)
- **Factory**: `contracts/ArcDEXFactory.sol`

O Pair em produção (`0x1737...`) foi criado pela Factory oficial e pode ser de outra implementação. O **Router** é o componente que deve ser deployado com o código correto do repo.
