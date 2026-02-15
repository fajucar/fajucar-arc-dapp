# Como testar (Router + USDC precompile)

Guia em 2 frentes: **Remix** (contratos) e **frontend** (app).

---

## Pré-requisitos

- **Rede:** Arc Testnet (Chain ID 5042002) na Rabby/MetaMask.
- **Router:** Deploy do **ArcDEXRouter** com o código patchado (`contracts/ArcDEXRouter.sol` atual). O app deve usar o endereço desse deploy.
- **Tokens:** USDC (precompile) e EURC no par com liquidez; saldo de USDC na carteira para teste.

Endereços de referência:

| Item   | Endereço |
|--------|----------|
| USDC   | `0x3600000000000000000000000000000000000000` |
| EURC   | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| Factory| `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F` |
| amountIn (1 USDC) | `1000000` (6 decimals) |

---

## 1. Testes no Remix

### 1.1 Router – getAmountsOut (view)

1. No Remix, use o contrato **ArcDEXRouter** deployado (endereço que está no app).
2. Abra **getAmountsOut**.
3. Preencha:
   - `amountIn`: `1000000`
   - `path`: `["0x3600000000000000000000000000000000000000","0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"]`
4. Clique em **call** (não transact).

**Esperado:** retorno tipo `[1000000, 1234567...]` (segundo valor > 0 se o par tiver liquidez). Se der 0, conferir `getReserves` no pair.

---

### 1.2 Router – swapExactTokensForTokens

1. **Approve USDC para o Router:**  
   Carregue USDC “At Address” `0x3600000000000000000000000000000000000000`, chame **approve** com `spender` = endereço do **Router** e `amount` = `1000000` (ou mais). Transact.

2. No **Router** deployado, abra **swapExactTokensForTokens** e preencha:
   - `amountIn`: `1000000`
   - `amountOutMin`: `0` (ou um valor menor que o `getAmountsOut` para evitar slippage)
   - `path`: `["0x3600000000000000000000000000000000000000","0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"]`
   - `to`: seu endereço (quem recebe o EURC)
   - `deadline`: timestamp futuro, ex. `1739123456` ou `block.timestamp + 300` se o Remix permitir

3. **Transact** e confirme na carteira.

**Esperado:** tx confirma sem revert. Saldo de EURC sobe e de USDC desce ~1 USDC.

---

### 1.3 (Opcional) ERC20TransferHelper – doTransfer com USDC

Para validar só o helper com o precompile:

1. Deploy do **ERC20TransferHelper** (`remix/ERC20TransferHelper.sol`).
2. **Approve USDC** para o **helper** (não para o Router): `approve(helper, 1000000)`.
3. No helper: **doTransfer** com `token` = USDC, `to` = endereço do pair (ou qualquer endereço), `amount` = `1000000`. Transact.

**Esperado:** tx confirma. Confirma que o precompile aceita retorno vazio com a regra `success && (data.length == 0 || abi.decode(data, (bool)))`.

---

## 2. Testes no frontend (app)

1. **Config:** `.env` e/ou `src/config/deployments.arc-testnet.json` com o **mesmo** endereço do Router usado no Remix (Router patchado).
2. Reinicie o app (`npm run dev`).
3. Conecte a carteira na Arc Testnet.
4. Na tela de **Swap**:
   - Token “From”: USDC.
   - Token “To”: EURC.
   - Valor: ex. 1 USDC.
5. Clique em **Aprovar** (se ainda não aprovou para esse Router) e confirme a tx.
6. Clique em **Swap** e confirme a tx.

**Esperado:** sem mensagem de “swap revertido”; tx confirmada e saldos atualizados.

---

## 3. Resumo rápido

| Onde      | O quê | Como |
|-----------|--------|------|
| Remix     | Cotação | Router → getAmountsOut(1000000, [USDC, EURC]) → call |
| Remix     | Swap on-chain | approve(router, 1e6) na USDC → Router.swapExactTokensForTokens(1000000, 0, path, suaConta, deadline) → transact |
| Remix     | Helper + precompile | approve(helper, 1e6) → helper.doTransfer(USDC, to, 1000000) → transact |
| Frontend  | Swap no app | Aprovar USDC → Swap 1 USDC → EURC → confirmar tx |

Se o **Router** for o patchado e o **approve** estiver para esse Router, o revert de “TRANSFER_FAILED” com USDC deixa de ocorrer. Se ainda falhar, conferir: endereço do Router no app, rede Arc Testnet e par com liquidez.
