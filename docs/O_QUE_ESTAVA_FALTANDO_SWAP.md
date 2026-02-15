# O que estava faltando para o swap funcionar

## Causa do revert

O **contrato Router** no endereço que está no config (`deployments.arc-testnet.json`) foi deployado com **código antigo**:

- Usava `IERC20(path[0]).transferFrom(...)` direto.
- O USDC na Arc Testnet é um **precompile** que não retorna `bool` nessa chamada.
- O Router antigo espera retorno `true` → a transação **reverte**.

O frontend está certo (router address, approve, path, slippage). O que falha é o **bytecode on-chain** do Router.

## O que faltava

1. **Arquivo do Remix estava errado**  
   O arquivo `docs/ArcDEXRouter_Remix.sol` era a **versão antiga** (sem `TransferHelper`). Quem fez deploy pelo Remix usando esse arquivo colocou um Router incompatível com USDC no endereço.

2. **Correção feita**  
   O `docs/ArcDEXRouter_Remix.sol` foi **substituído** pela versão correta (igual a `contracts/ArcDEXRouter.sol`), que inclui:
   - a **library TransferHelper** com `safeTransferFrom` (aceita token que retorna vazio);
   - uso de `TransferHelper.safeTransferFrom` no `swapExactTokensForTokens`;
   - a função `supportsPrecompileTokens()` retornando `true`.

## O que você precisa fazer (uma vez)

1. **Fazer um novo deploy do Router no Remix**
   - Abra [Remix](https://remix.ethereum.org).
   - Crie um arquivo e **cole todo o conteúdo** de **`docs/ArcDEXRouter_Remix.sol`** (o arquivo atualizado).
   - Compile (Compiler 0.8.20).
   - Em “Deploy”, use como argumento do construtor a **Factory**:
     - `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`
   - Faça o deploy na **Arc Testnet** (injetar provider / MetaMask).
   - Copie o **novo endereço** do contrato deployado.

2. **Atualizar o config**
   - Abra `src/config/deployments.arc-testnet.json`.
   - No campo `"router"`, substitua pelo **novo endereço** (o que você acabou de deployar).
   - Salve.

3. **Na interface do app**
   - Abra o Swap.
   - Clique em **“Approve USDC”** (ou “Aprovar e Swap”) para aprovar o **novo** Router.
   - Depois faça o **Swap** normalmente.

Depois disso, o swap deve funcionar: o Router on-chain passa a ser o que usa `TransferHelper` e é compatível com o USDC precompile.

## Resumo

| Antes | Depois |
|-------|--------|
| `docs/ArcDEXRouter_Remix.sol` = versão antiga (transferFrom direto) | `docs/ArcDEXRouter_Remix.sol` = versão com TransferHelper (igual ao `contracts/ArcDEXRouter.sol`) |
| Deploy no Remix usava código que reverte com USDC | Deploy no Remix usa código correto; basta redeploy + atualizar JSON + novo approve |

Nada mais está faltando no frontend; o ajuste necessário é **só** redeploy do Router com o arquivo correto e atualizar o endereço no config.
