# Guia Remix — ArcDEX na Arc Testnet

Use este guia para resolver as pendências de deploy e liquidez no Remix.

---

## Se você já tem os arquivos no Remix (Factory, Pair, Router, etc.)

- **Use:** `ArcDEXFactory.sol`, `ArcDEXPair.sol`, `ArcDEXRouter.sol` (e `ERC20TransferHelper.sol` só se o Router importar).
- **Não use para liquidez:** `LiquidityHelper.sol` — faça liquidez pelo **Router.addLiquidity**.
- **Não use para enviar tokens:** `IERC20Full.sol` (falta `transfer`/`transferFrom`); use só para ler saldo/allowance se precisar.
- **Factory:** no deploy, o construtor pede **1 argumento:** `_feeToSetter` (coloque seu endereço de carteira).
- **Router:** confira se o seu `ArcDEXRouter.sol` tem a função **addLiquidity**. Se tiver só `swapExactTokensForTokens`, substitua o conteúdo pelo do arquivo **`contracts/ArcDEXRouter.sol`** do projeto.
- **Compilar:** selecione **ArcDEXFactory** para compilar (ele importa o Pair). Depois compile **ArcDEXRouter**. Então siga a partir do **Passo 2** (conectar rede), **Passo 3** (deploy Factory **com** o argumento feeToSetter), e seguintes.

---

## Endereços (Arc Testnet)

| Item  | Endereço |
|-------|----------|
| USDC  | `0x3600000000000000000000000000000000000000` |
| EURC  | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

Guarde também os endereços que você criar: **Factory**, **Pair** e **Router**.

---

## Passo 1 — Abrir e compilar no Remix

1. Abra [remix.ethereum.org](https://remix.ethereum.org).
2. Crie um arquivo (ex.: `ArcDEX_Remix_AllInOne.sol`) e cole **todo** o conteúdo de **`docs/ArcDEX_Remix_AllInOne.sol`** do projeto.
3. Aba **Solidity Compiler**:
   - Compiler: **0.8.20** (ou superior compatível).
   - Clique em **Compile**.
4. Confirme que não há erros de compilação.

---

## Passo 2 — Conectar à Arc Testnet

1. Aba **Deploy & Run Transactions**.
2. Em **Environment** escolha **Injected Provider - MetaMask** (ou outra carteira que use Arc Testnet).
3. Conecte a carteira e selecione a rede **Arc Testnet** (Chain ID 5042002).
4. Confirme que o **Account** exibido é o que você vai usar para deploy e liquidez.

---

## Passo 3 — Deploy da Factory

1. No dropdown **Contract** selecione **ArcDEXFactory**.
2. Clique em **Deploy** (construtor sem parâmetros no AllInOne).
3. Após a confirmação, anote o endereço da Factory na seção **Deployed Contracts** (ícone de cópia).

---

## Passo 4 — Criar o par USDC/EURC

1. Expanda o contrato **ArcDEXFactory** que você acabou de deployar.
2. Chame **createPair** com:
   - **tokenA:** `0x3600000000000000000000000000000000000000` (USDC)
   - **tokenB:** `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (EURC)
3. Clique em **transact** e confirme na carteira.
4. Depois da confirmação:
   - Veja o evento **PairCreated** nos logs, ou
   - Chame **getPair** na Factory com USDC e EURC (na ordem: menor endereço primeiro = token0).
5. Anote o endereço do **Pair** retornado por **getPair(USDC, EURC)**.

---

## Passo 5 — Deploy do Router

1. No dropdown **Contract** selecione **ArcDEXRouter**.
2. No campo **CONSTRUCTOR**:
   - **_factory:** cole o endereço da **Factory** (passo 3).
3. Clique em **Deploy** e confirme.
4. Anote o endereço do **Router** em **Deployed Contracts**.

---

## Passo 6 — Aprovar tokens para o Router

O Router precisa poder movimentar seus USDC e EURC. Você vai aprovar o **Router** em cada token.

### 6.1 — Aprovar USDC

1. No dropdown de contrato, selecione **At Address**.
2. Endereço: `0x3600000000000000000000000000000000000000`.
3. Use a ABI de um ERC20 (approve). Se o Remix não carregar a interface:
   - Você pode usar o painel **Low level interactions**:
     - Endereço: `0x3600000000000000000000000000000000000000`
     - Calldata para `approve(spender, amount)` em ABI-encoded form.  
   Ou, em muitos casos, o Remix mostra **approve** ao carregar o endereço de um token conhecido.
4. Chame **approve** com:
   - **spender:** endereço do **Router** (passo 5).
   - **amount:** ex. `115792089237316195423570985008687907853269984665640564039457584007913129639935` (max uint256) ou o valor que for usar na liquidez.
5. Transact e confirme.

### 6.2 — Aprovar EURC

1. **At Address:** `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`.
2. Chame **approve** com:
   - **spender:** endereço do **Router**.
   - **amount:** mesmo critério do USDC.
3. Transact e confirme.

---

## Passo 7 — Adicionar liquidez via Router

1. Expanda o contrato **ArcDEXRouter** deployado.
2. Chame **addLiquidity** com:
   - **tokenA:** `0x3600000000000000000000000000000000000000` (USDC)
   - **tokenB:** `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (EURC)
   - **amountADesired:** ex. `1000000` (1 USDC com 6 decimals)
   - **amountBDesired:** ex. `1000000` (1 EURC com 6 decimals)
   - **amountAMin:** ex. `990000` (1% slippage)
   - **amountBMin:** ex. `990000` (1% slippage)
   - **to:** seu endereço (recebedor dos LP tokens)
   - **deadline:** um timestamp no futuro, ex. `9999999999`
3. **transact** e confirme na carteira.
4. Você receberá os LP tokens no endereço **to**. O par passa a ter reservas e o swap fica possível.

---

## Passo 8 — Atualizar o config do projeto

1. No seu projeto, abra **`src/config/deployments.arc-testnet.json`** (ou o arquivo de config da Arc Testnet que o DApp usa).
2. Substitua pelos endereços que você anotou:
   - **factory:** endereço da Factory (passo 3).
   - **router:** endereço do Router (passo 5).
3. Mantenha **tokens.USDC** e **tokens.EURC** como estão (endereços acima).
4. Salve o arquivo.

Exemplo:

```json
{
  "chainId": 5042002,
  "factory": "0x_SEU_ENDERECO_DA_FACTORY",
  "router": "0x_SEU_ENDERECO_DO_ROUTER",
  "tokens": {
    "USDC": { "address": "0x3600000000000000000000000000000000000000", "decimals": 6 },
    "EURC": { "address": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", "decimals": 6 }
  }
}
```

---

## Resumo da ordem

| # | O que fazer no Remix |
|---|----------------------|
| 1 | Colar `ArcDEX_Remix_AllInOne.sol`, compilar (0.8.20). |
| 2 | Conectar carteira à Arc Testnet. |
| 3 | Deploy **ArcDEXFactory** → anotar endereço. |
| 4 | **createPair**(USDC, EURC) na Factory → anotar Pair. |
| 5 | Deploy **ArcDEXRouter**(endereço da Factory) → anotar Router. |
| 6 | **approve**(Router, valor) em USDC e em EURC. |
| 7 | **addLiquidity**(USDC, EURC, ...) no Router. |
| 8 | Atualizar `deployments.arc-testnet.json` com factory e router. |

Depois disso, recarregue o DApp e teste o swap USDC ↔ EURC (ex.: slippage 1%).

---

## Dicas

- **Primeira liquidez:** use `amountAMin` e `amountBMin` baixos (ex. 0 ou 1% abaixo dos desired). Para par novo, `quote` pode sugerir proporção 1:1; ajuste os desired conforme o que você quer depositar.
- **Slippage no swap:** no DApp, use pelo menos 1% de slippage para testes.
- **Remover liquidez:** use **Router.removeLiquidity**(tokenA, tokenB, liquidity, amountAMin, amountBMin, to, deadline). Antes, aprove o Router no contrato do **Pair** (o Pair é o token LP) com `pair.approve(router, liquidity)`.
