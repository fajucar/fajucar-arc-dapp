# Patch: Swap com Debug Panel e fluxo corrigido

## Arquivos alterados

- **`src/components/Swap/SwapInterface.tsx`**
  - Tipo `SwapDebugData` exportado para dados do Debug Panel.
  - Estado: `debugData`, `lastSimError`, `debugOpen`.
  - `useEffect` que preenche o Debug Panel: router (config + on-chain), factory, pair, reserves, token0/token1, balance e allowance do usuário, block timestamp, deadline (client).
  - Aviso no debug quando `pair === address(0)` ou reservas zero.
  - **Fluxo do botão Swap:** se `allowance < amountIn`, chama `approve(router, MaxUint256)` e aguarda 1 confirmação (`waitForTransactionReceipt`); em seguida executa `swapExactTokensForTokens`. O swap **sempre** chama a carteira (não para na simulação).
  - **Deadline:** `BigInt(Math.floor(Date.now()/1000) + 60*20)` (20 min em segundos Unix).
  - Antes de enviar a tx: `simulateContract`; em caso de falha, decodifica o revert (nome, shortMessage, data) e mostra no toast e no Debug Panel (`lastSimError`), e **não** envia a tx.
  - Path: `[tokenFrom.address, tokenTo.address]`; `amountIn`/`amountOutMin` com decimais corretos via `safeParseUnits`.
  - UI: um único botão **Swap** (approve é feito dentro do handler quando necessário).
  - **Debug Panel** (colapsável) na página Swap, abaixo do último swap tx hash.

## Onde ver o Debug Panel

1. Abra a página **Swap** (rota `/swap`).
2. Conecte a carteira e selecione **From** (ex.: USDC) e **To** (ex.: EURC).
3. Abaixo do botão "Swap" e do bloco "Última transação de swap" (se existir), há a seção **"Debug Panel (Swap)"**.
4. Clique em **"Debug Panel (Swap)"** para expandir e ver:
   - routerAddress (config)
   - factoryAddress (config)
   - router.factory() (on-chain)
   - pair = factory.getPair(tokenFrom, tokenTo)
   - reserves (getReserves)
   - token0 / token1
   - balanceOf(tokenFrom) do usuário
   - allowance(tokenFrom, router) do usuário
   - block timestamp (último bloco)
   - deadline (client, Unix sec)
   - Aviso "Sem liquidez/par inexistente" se pair = 0 ou reserves = 0
   - Último erro da simulação (se a simulação tiver falhado)

## Restrições respeitadas

- Nenhuma alteração em Pools / My Pools.
- Nenhuma alteração em contratos.
- Apenas o componente Swap e helpers de leitura (no próprio componente).
- TypeScript e build sem erros.
