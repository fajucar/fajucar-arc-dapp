# Deploy completo ArcDEX compatível com precompile (Arc Testnet)

Este fluxo resolve o revert no swap USDC → EURC quando **o Pair** (e não só o Router) usa `IERC20.transfer()` — tokens precompile na Arc não retornam `bool`, e o revert acontece **dentro do Pair** em `swap()` e `burn()`.

## Por que trocar só o Router não resolve

- **Router** (`ArcDEXRouter_Remix.sol`): já usa `TransferHelper.safeTransferFrom` no passo usuário → Pair. Está correto para precompile.
- **Pair** (ex.: `ArcDEX_Simple.sol`): em `swap()` e `burn()` chama `IERC20(token).transfer(to, amount)`, que espera `bool`. Se o token for precompile, **reverte no Pair**. Trocar só o endereço do Router não altera o código do Pair já deployado.

Por isso é necessário **nova Factory + novo Pair** (código que usa `TransferHelper.safeTransfer` no `transfer`) e **novo Router** apontando para essa Factory.

---

## Arquivos

| Arquivo | Uso |
|--------|-----|
| `docs/ArcDEX_Pair_PrecompileSafe.sol` | Factory + Pair que usam `TransferHelper` em `transfer` (swap e burn). **Deploy primeiro.** |
| `docs/ArcDEXRouter_Remix.sol` | Router. Deploy com `_factory` = endereço da **nova** Factory. |

---

## Passo a passo no Remix (Arc Testnet)

### 1. Compilar e deployar a Factory (Pair precompile-safe)

1. Abra o Remix, rede **Arc Testnet** (Chain ID 5042002).
2. Crie um arquivo e cole todo o conteúdo de **`ArcDEX_Pair_PrecompileSafe.sol`**.
3. Compile (Solidity 0.8.20).
4. Em “Deploy”:
   - Contrato: **ArcDEXFactory**
   - Deploy.
5. Anote o endereço da **Factory** (ex.: `0x...`).

### 2. Criar o par USDC/EURC

Endereços na Arc Testnet (confira em `src/config/deployments.arc-testnet.json` ou no app):

- **USDC**: `0x3600000000000000000000000000000000000000`
- **EURC**: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`

No Remix, no contrato **ArcDEXFactory** já deployado:

- Chame **createPair**(`<USDC>`, `<EURC>`).
- Anote o endereço do **Pair** (evento `PairCreated` ou retorno da transação).

### 3. Deployar o Router

1. Cole em outro arquivo do Remix todo o conteúdo de **`ArcDEXRouter_Remix.sol`**.
2. Compile **ArcDEXRouter**.
3. Deploy:
   - **Constructor:** `_factory` = endereço da **nova Factory** (passo 1).
4. Anote o endereço do **Router**.

### 4. Adicionar liquidez ao novo Pair

O Router deste repositório só tem swap; não tem `addLiquidity` no contrato. Para o novo par:

**Opção A – Direto no Pair (Remix ou script):**

1. Aprovar USDC e EURC para o **endereço do Pair** (não do Router).
2. Enviar USDC e EURC para o Pair (`transfer(pairAddress, amount)`).
3. Chamar no Pair: **mint**(`sua_carteira`).
4. Os LP tokens ficam na sua carteira.

**Opção B – Se no futuro houver “Add liquidity” no DApp:**  
Configurar o DApp para usar o novo **factory** e o novo **router**; o fluxo de add liquidity (se existir) usará o novo par.

### 5. Atualizar o config do front

Edite **`src/config/deployments.arc-testnet.json`** e substitua pelos **novos** endereços:

```json
{
  "chainId": 5042002,
  "factory": "<NOVA_FACTORY_DO_PASSO_1>",
  "router": "<NOVO_ROUTER_DO_PASSO_3>",
  "tokens": {
    "USDC": { "address": "0x3600000000000000000000000000000000000000", "decimals": 6 },
    "EURC": { "address": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", "decimals": 6 }
  }
}
```

Salve, recarregue o DApp e faça um swap USDC → EURC (ex.: 1% slippage). O swap deve passar pelo **novo Pair**, que usa `TransferHelper.safeTransfer` e é compatível com precompile.

---

## Resumo da ordem

1. Deploy **ArcDEXFactory** (de `ArcDEX_Pair_PrecompileSafe.sol`).
2. **createPair**(USDC, EURC) nessa Factory → novo Pair.
3. Deploy **ArcDEXRouter** com `_factory` = nova Factory.
4. Adicionar liquidez no novo Pair (mint direto no Pair ou via DApp se existir).
5. Atualizar **deployments.arc-testnet.json** com `factory` e `router` novos.

Assim o caminho fica todo precompile-safe: Router (transferFrom) + Pair (transfer em swap e burn).
