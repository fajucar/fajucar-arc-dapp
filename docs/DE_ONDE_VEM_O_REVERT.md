# De onde pode estar vindo o erro (revert do swap)

O código no repositório (Router e Pair) já foi corrigido para USDC precompile. O revert que você ainda vê vem **do que está deployado on-chain** ou da **configuração do app**, não do código atual do repo.

---

## 1. Router on-chain é a versão antiga (causa mais provável)

**O quê:** O endereço no `.env` (`VITE_DEX_ROUTER_ADDRESS`) aponta para um contrato que foi deployado **antes** do patch (sem `TransferHelper`). Esse Router usa `require(IERC20.transferFrom(...))`; o USDC precompile não retorna `bool` → a tx reverte.

**Onde:** Primeira linha do `swapExactTokensForTokens`: ao puxar os tokens do usuário para o pair.

**Como conferir:** O frontend chama `supportsPrecompileTokens()` no Router. Se aparecer o aviso amarelo *"Router é a versão antiga (incompatível com USDC)"*, o endereço em uso é o antigo.

**Correção:** Fazer deploy do **`contracts/ArcDEXRouter.sol`** atual no Remix (Factory = `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`), copiar o **novo** endereço e colocar em `VITE_DEX_ROUTER_ADDRESS` no `.env`. Reiniciar o app e **aprovar de novo** o USDC para esse novo Router.

---

## 2. Approve está no Router errado

**O quê:** Você aprovou o USDC para o Router **antigo**, mas o `.env` foi atualizado para o Router **novo**. O novo Router tenta `transferFrom` e o allowance é zero → falha.

**Onde:** No contrato do token (USDC): `allowance(seuEndereço, router)` precisa ser ≥ valor do swap para o **mesmo** endereço de Router que o app usa.

**Como conferir:** No Debug Panel do Swap, ver "allowance(tokenFrom, router)". Ou no ArcScan: USDC → "Read contract" → `allowance(seuEndereço, endereçoDoRouterQueEstáNoEnv)`.

**Correção:** Na tela de Swap, clicar em **Aprovar** de novo (assim o allowance fica para o Router que está no `.env`).

---

## 3. Pair on-chain é a versão antiga (quando a saída é USDC)

**O quê:** O **par** já deployado (ex.: 0xF9758A...) foi criado com o Pair **antigo**, que usa `IERC20.transfer(to, amount)` direto. Quando o token de **saída** do swap é USDC (ex.: swap EURC→USDC), o Pair envia USDC para você; o precompile não retorna `bool` → revert **dentro do Pair**.

**Onde:** Dentro de `Pair.swap()`, ao fazer `transfer(to, amountOut)` do token de saída.

**Como conferir:** Se o revert só acontece quando você troca **EURC → USDC** (e não USDC → EURC), a causa provável é o Pair antigo.

**Correção:** O Pair já deployado não pode ser alterado. Para EURC→USDC funcionar com USDC precompile seria preciso criar um **novo par** com o `ArcDEXPair.sol` atual (que tem `_safeTransfer`) e migrar liquidez. Para **USDC→EURC**, o Pair antigo basta (quem envia é EURC, que retorna `bool`).

---

## 4. Deadline no passado

**O quê:** O Router faz `require(deadline >= block.timestamp, "ArcDEX: EXPIRED")`. Se o relógio do cliente estiver muito adiantado ou o timestamp for mal calculado, a tx pode reverter com EXPIRED.

**Onde:** Início de `swapExactTokensForTokens`.

**Como conferir:** No Debug Panel, ver "deadline (client, unix sec)" e comparar com o horário do bloco na rede. O frontend usa `Date.now()/1000 + 20*60` (20 min), então em condições normais não expira.

**Correção:** Ajustar relógio do PC ou garantir que o deadline seja sempre futuro (o código já usa 20 min).

---

## 5. amountOutMin maior que o amountOut real

**O quê:** O Router exige `amounts[amounts.length - 1] >= amountOutMin`. Se a cotação cair (slippage, alguém trocou antes) ou o cálculo de `amountOutMin` no front estiver errado, a tx reverte com INSUFFICIENT_OUTPUT_AMOUNT.

**Onde:** Em `swapExactTokensForTokens`, depois de `getAmountsOut`.

**Como conferir:** Abrir o Debug Panel e comparar o "amountOut" usado no cálculo com o "amountOutMin" enviado. Ou reduzir o slippage (ex.: 1% ou 0,5%) e tentar de novo.

**Correção:** Aumentar um pouco a tolerância de slippage na UI ou garantir que `amountOutMin` use um getAmountsOut **fresco** (o código já recalcula antes da simulação).

---

## 6. Path ou par errado

**O quê:** Se o Router devolver um `pairFor(path[0], path[1])` diferente do par que tem liquidez (ex.: Factory/Router de outra rede ou outro deploy), `getReserves` pode dar zero e o Router reverte com INSUFFICIENT_LIQUIDITY dentro de `getAmountsOut`.

**Onde:** Dentro de `getAmountsOut` → `getReserves` → `getAmountOut(..., reserveIn, reserveOut)` com reserves zero.

**Como conferir:** O frontend já verifica "Router compatível com a Factory" e avisa quando `router.pairFor` ≠ par da Factory. Se aparecer esse aviso, o revert pode ser por path/par errado.

**Correção:** Usar o Router deployado com a **mesma** Factory da config (`0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`) e o par que tem liquidez (ex.: USDC/EURC 0xF9758A...).

---

## Ordem sugerida para checar

1. **Router antigo?** → Ver se o aviso amarelo "Router é a versão antiga" aparece. Se sim, deploy do Router novo + atualizar `.env` + novo approve.
2. **Approve** → Conferir allowance para o **mesmo** Router que está no `.env`; se mudou o Router, aprovar de novo.
3. **Direção do swap** → Se for EURC→USDC e já estiver com Router novo, o revert pode ser do **Pair** antigo; para USDC→EURC o Pair antigo não é o problema.
4. **Deadline / amountOutMin / path** → Menos provável se getAmountsOut e reserves estiverem ok; usar Debug Panel e logs para validar.

Resumo: na prática o revert costuma vir de **(1) Router antigo** ou **(2) approve no Router errado**. O código que revisamos e corrigimos no repo já está certo; o que falta é usar o **Router (e, se for o caso, o Pair) deployados com esse código** e a **configuração e approve** alinhados a esse Router.
