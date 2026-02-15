# Procedimento confiável: transfer USDC no Remix (Arc Testnet)

## Problema

No Remix, ao usar a interface IERC20 no contrato do token (`0x3600...0000`):
- O formulário de `transfer` às vezes não mostra o campo **amount**.
- Em "Low level interactions", o CALLDATA é cortado e aparece **"Fallback function is not defined"**.

## Solução: contrato helper

Use o contrato **ERC20TransferHelper**: você faz deploy **uma vez** e chama `doTransfer(token, to, amount)` com **3 parâmetros visíveis** na aba Deploy & Run.

---

## Passo a passo no Remix

### 1. Criar o arquivo do helper

1. No Remix, crie um arquivo (ex.: `ERC20TransferHelper.sol`).
2. Cole o conteúdo de `docs/ERC20TransferHelper.sol` (do repositório) e salve.

### 2. Compilar

1. Aba **Solidity Compiler**.
2. Compiler: **0.8.20** ou superior.
3. Clique em **Compile ERC20TransferHelper.sol**.

### 3. Deploy do helper

1. Aba **Deploy & Run Transactions**.
2. **Environment**: Injected Provider (Rabby).
3. Confirme que está na **Arc Testnet** (Chain ID 5042002).
4. **Contract**: selecione `ERC20TransferHelper`.
5. **Value**: deixe **0**.
6. Clique em **Deploy** e confirme na Rabby.
7. Anote o endereço do contrato deployado (ex.: `0xABC...`).

### 4. Aprovar USDC para o helper (se for transferir do seu endereço)

O helper chama `transfer` **em nome de quem chama** (`msg.sender`). Ou seja, os tokens saem da **sua carteira**, não do contrato helper.

- Se os 10 USDC estão na **sua carteira**: você não precisa aprovar nada para o helper; o helper só chama `token.transfer(to, amount)` e o token debita da sua conta (o `msg.sender` na chamada ao token é você, pois a Rabby envia a tx com sua conta).
- **Correção**: na verdade, quando você chama `helper.doTransfer(token, to, amount)`, o `msg.sender` no helper é você, mas quando o helper chama `IERC20Minimal(token).transfer(to, amount)`, o **owner** dos tokens que estão sendo transferidos é... o **contrato helper**? Não. O `transfer` no ERC20 é chamado pelo contrato helper, mas o ERC20 debita de quem? O ERC20 debita de **msg.sender** do ponto de vista do contrato do token. Ou seja, do **helper**. Então os tokens precisam estar no helper, ou o token precisa ser chamado por quem tem os tokens.

Ah, entendi o fluxo: no ERC20, `transfer(to, amount)` move tokens **de quem chama** (msg.sender) para `to`. Então quando o **helper** chama `token.transfer(to, amount)`:
- msg.sender (para o token) = endereço do **helper**
- O token debita do **helper** e envia para `to`.

Então os 10 USDC precisam estar **no contrato helper** primeiro. Ou seja:
1. Você faz transfer dos seus 10 USDC para o endereço do **helper** (uma vez).
2. Depois você chama `helper.doTransfer(token, to, amount)`; aí o token debita do helper e envia para `to`.

Isso é chato. Melhor: o helper poderia chamar `token.transferFrom(msg.sender, to, amount)` e aí você aprova o helper uma vez. Assim os tokens saem da sua carteira diretamente. Vou ajustar o helper para usar **transferFrom** e o usuário aprova o helper no token.
</think>
Ajustando o helper para usar `transferFrom`, assim os tokens saem da sua carteira e você só precisa aprovar o helper uma vez.
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace