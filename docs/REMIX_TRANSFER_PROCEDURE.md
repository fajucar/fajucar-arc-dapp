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

### 4. Aprovar o helper no USDC (uma vez)

O helper usa `transferFrom(sua_carteira, to, amount)`. O token precisa autorizar o helper a gastar seus USDC.

1. No Remix, **carregue o contrato USDC** como "At Address":
   - Endereço: `0x3600000000000000000000000000000000000000`
   - Use uma interface que tenha `approve(spender, amount)`.
2. Chame **approve**:
   - **spender**: endereço do **ERC20TransferHelper** que você deployou (ex.: `0xABC...`).
   - **amount**: `10000000` (10 USDC) ou mais (ex.: `115792089237316195423570985008687907853269984665640564039457584007913129639935` para "unlimited").
3. Transact e confirme na Rabby.

### 5. Executar o transfer (10 USDC para o pair)

1. Na aba Deploy & Run, em "Deployed Contracts", clique no **ERC20TransferHelper**.
2. Expanda **doTransfer**.
3. Preencha os 3 campos (todos visíveis):
   - **token** (address): `0x3600000000000000000000000000000000000000`
   - **to** (address): `0xF9758A1565E9A1380F599803Aa741718E1dC2A6e`
   - **amount** (uint256): `10000000`
4. **Value**: deixe **0**.
5. Clique em **transact** e confirme na Rabby.

Pronto: 10 USDC saem da sua carteira para o pair, sem depender do formulário bugado do token.

---

## Resumo dos endereços (Arc Testnet)

| Item            | Valor |
|-----------------|-------|
| USDC            | `0x3600000000000000000000000000000000000000` |
| Pair (destino)  | `0xF9758A1565E9A1380F599803Aa741718E1dC2A6e` |
| 10 USDC (6 dec) | `10000000` |

---

## Alternativa sem helper (CALLDATA manual)

Se não quiser deployar o helper, monte o calldata completo e use "Low level interactions" **com Value = 0**:

- Função: `transfer(address to, uint256 amount)`
- Selector: `0xa9059cbb`
- ABI-encode: `to` (32 bytes, right-padded) + `amount` (32 bytes)

Exemplo para `to = 0xF9758A1565E9A1380F599803Aa741718E1dC2A6e` e `amount = 10000000`:

```
0xa9059cbb
000000000000000000000000F9758A1565E9A1380F599803Aa741718E1dC2A6e
0000000000000000000000000000000000000000000000000000000000989680
```

(10000000 em hex = 0x989680.) Concatene tudo em uma única string sem quebras. Se o Remix cortar o campo, o helper é mais confiável.
