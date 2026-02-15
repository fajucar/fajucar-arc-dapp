# Como testar Swap e Pool na Arc Testnet

Este guia descreve como testar **swap** e **add liquidity** no dApp usando a Arc Testnet (Chain ID **5042002**).

## Pré-requisitos

- Carteira (MetaMask ou compatível) conectada à **Arc Testnet**
- RPC: `https://rpc.testnet.arc.network`
- Chain ID: **5042002**
- Tokens de teste: USDC e EURC (faucet ou transferência conforme disponível)

## Configuração da rede

| Item        | Valor |
|------------|--------|
| Chain ID   | 5042002 |
| RPC        | https://rpc.testnet.arc.network |
| Explorer   | https://testnet.arcscan.app |

**Contratos (fonte única em `src/config/arcTestnet.ts`):**

| Contrato         | Endereço |
|------------------|----------|
| Factory          | `0x4b6F738717c46A8998990EBCb17FEf032DC5958B` |
| Router           | `0x3bE7d2Ed202D5B65b9c78BBf59f6f70880F6C0a6E` |
| Pair USDC/EURC   | `0x327f52e7cDfF1567F1708c2D045c7e2963e4889A` |
| LiquidityHelper  | `0x8bbC202A110771cc5c05ec53F29eCA23622452F6` |
| USDC             | `0x3600000000000000000000000000000000000000` (6 decimals) |
| EURC             | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 decimals) |

---

## 1. Verificar rede

- O dApp exige **Arc Testnet (5042002)**. Se a carteira estiver em outra rede, aparece aviso:
  - **Swap:** “Conecte na Arc Testnet (5042002) para fazer swap.”
  - **Pools:** “Conecte na Arc Testnet (Chain ID 5042002) para ver e adicionar liquidez.”
- Troque a rede na carteira para Arc Testnet antes de continuar.

---

## 2. Testar leitura do Pool (getReserves)

1. Acesse a página **Pools** (ou “Liquidity Pools”).
2. Com a rede correta, a UI carrega o **par oficial** USDC/EURC.
3. Verifique:
   - **Par oficial USDC/EURC** com endereço do Pair.
   - Badge **“Pool ativa”** quando `reserve0` e `reserve1` > 0.
   - Reservas em unidades humanas (ex.: USDC e EURC).
4. Link “Ver no ArcScan” abre o contrato do Pair no explorer.

---

## 3. Testar cotação (getAmountsOut)

- Na página **Swap**:
  1. Selecione **USDC → EURC** (ou EURC → USDC).
  2. Informe valor, por exemplo **1 USDC** (1,000000).
  3. O app usa o Router para `getAmountsOut` com o par oficial; o campo “Você recebe” mostra a cotação estimada.

**Valores em raw (6 decimals):**

- 1 USDC = `1_000_000`
- 10 USDC = `10_000_000`
- 10 EURC = `10_000_000`

---

## 4. Testar Swap

1. **Swap:** escolha USDC → EURC (ou o contrário), valor (ex.: 1 USDC), aceite o valor mínimo estimado ou use `amountOutMin` baixo só para teste.
2. **Aprovação:** na primeira vez, o botão pede **“Aprovar USDC para Router”** (ou EURC, conforme o token de entrada). Aprove; aguarde a confirmação.
3. **Executar:** clique em **Swap**; confirme na carteira.
4. **Resultado:** toast de sucesso com **“Ver no ArcScan”** (link para `https://testnet.arcscan.app/tx/{hash}`).
5. Em caso de revert, a mensagem de erro tenta exibir o `reason` e também oferece link para a tx no explorer.

**Fluxo de approve:**  
O spender do token no **swap** é sempre o **Router** (`0x3a6a...`). O dApp usa `ensureAllowance(token, owner, router, amount)` antes de chamar `swapExactTokensForTokens`.

---

## 5. Testar Add Liquidity (LiquidityHelper)

1. Acesse a página **Pools**.
2. Preencha os valores desejados para USDC e EURC (ex.: **10 USDC** e **10 EURC** = `10_000_000` de cada, 6 decimals).
3. **Aprovações:** na primeira vez, serão exibidos toasts do tipo:
   - “Aprovar USDC para Helper”
   - “Aprovar EURC para Helper”  
   O spender aqui é o **LiquidityHelper** (`0x8bbC...`).
4. Após as duas aprovações confirmadas, clique em **Add Liquidity**.
5. Confirme a tx no LiquidityHelper (`addLiquidity(pair, token0, token1, amount0, amount1)`).
6. Toast de sucesso: **“Liquidez adicionada”** com link para a tx no ArcScan.

**Valores exemplo (6 decimals):**

- 10 USDC + 10 EURC → `amount0 = 10_000_000`, `amount1 = 10_000_000` (ordem conforme token0/token1 do Pair: USDC = token0, EURC = token1).

---

## 6. Resumo de Approves

| Ação           | Spender        | Mensagem na UI (exemplo)        |
|----------------|----------------|---------------------------------|
| Swap           | Router         | “Aprovar USDC para Router”     |
| Add Liquidity  | LiquidityHelper| “Aprovar USDC para Helper” / “Aprovar EURC para Helper” |

A função `ensureAllowance` em `src/lib/allowance.ts` verifica o allowance e, se insuficiente, chama `approve(spender, type(uint256).max)` e aguarda o receipt. Ela é usada tanto no fluxo de swap quanto no de add liquidity.

---

## 7. Links úteis

- Explorer: https://testnet.arcscan.app  
- Contrato do Pair: https://testnet.arcscan.app/address/0x327f52e7cDfF1567F1708c2D045c7e2963e4889A  
- Router: https://testnet.arcscan.app/address/0x3bE7d2Ed202D5B65b9c78BBf59f6f70880F6C0a6E  
- LiquidityHelper: https://testnet.arcscan.app/address/0x8bbC202A110771cc5c05ec53F29eCA23622452F6  

Config central: `src/config/arcTestnet.ts` (e re-export em `src/config/arcDex.ts`).
