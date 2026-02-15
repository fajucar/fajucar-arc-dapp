# Por que o swap ainda reverte mesmo com "Router novo"?

## O que está acontecendo

O **endereço** do Router no config (`deployments.arc-testnet.json`) pode estar correto e “novo”, mas o **contrato deployado nesse endereço** pode ser a **versão antiga** do bytecode (sem `TransferHelper`).

- O frontend usa sempre o endereço do JSON.
- Quem executa o swap é o **código on-chain** nesse endereço.
- Se nesse endereço foi deployado o Router **antigo** (que usa `IERC20.transferFrom` direto), o swap com USDC precompile **vai reverter** (normalmente com `ArcDEX: TRANSFER_FAILED` ou revert genérico).

Ou seja: **“router novo” = endereço novo no config. O que importa é o bytecode no endereço.**

## Como corrigir

1. **Fazer um novo deploy do Router com o código certo**
   - Use **sempre** o arquivo do repositório: `contracts/ArcDEXRouter.sol`.
   - Esse contrato usa a library `TransferHelper` e é compatível com USDC precompile.
   - No Remix: copie o conteúdo de `contracts/ArcDEXRouter.sol` (incluindo a library `TransferHelper` no mesmo arquivo) e faça o deploy com a **mesma** Factory: `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`.

2. **Atualizar o config com o endereço desse novo deploy**
   - Em `src/config/deployments.arc-testnet.json`, atualize o campo `"router"` com o endereço do contrato que você acabou de deployar.

3. **Aprovar de novo**
   - Depois de trocar o router no config, o usuário precisa aprovar o token (ex.: USDC) **para o novo endereço de Router** (botão Approve na tela de Swap).

## Como conferir se o Router on-chain é o novo

- Se a simulação do swap retornar erro decodificado **`ArcDEX: TRANSFER_FAILED`**, o contrato nesse endereço muito provavelmente **não** usa `TransferHelper` (bytecode antigo).
- O frontend pode chamar `supportsPrecompileTokens()` no Router: se a função existir e retornar `true`, o Router é a versão nova. (Se não existir ou der erro, o bytecode pode ser antigo.)

## Resumo

| Situação | O que fazer |
|----------|-------------|
| Endereço no config é “novo” mas swap reverte (e/ou erro `TRANSFER_FAILED`) | Redeploy do Router a partir de `contracts/ArcDEXRouter.sol` e atualizar `router` no JSON. |
| Troquei o `router` no JSON para um deploy novo | Garantir que esse deploy foi feito com `ArcDEXRouter.sol` (com TransferHelper) e que o usuário aprovou o token para esse novo endereço. |

Veja também: `docs/DEX_DEPLOYMENT.md`, `docs/COMO_OBTER_ENDERECO_DEX.md`.
