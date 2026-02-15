# Patch TransferHelper – Diff e checklist Remix

## Resumo da auditoria

- **ArcDEXRouter.sol**: Usava `IERC20(path[0]).transferFrom(...)` diretamente; tokens que não retornam valor (ex.: USDC precompile) faziam o `require(bool)` falhar. Corrigido com library `TransferHelper.safeTransferFrom` usando low-level `call` e regra `success && (data.length == 0 || abi.decode(data, (bool)))`.
- **ERC20TransferHelper.sol** (remix): Usava `IERC20Minimal(token).transferFrom(...)` e `require(ok)`; não checava `data.length` antes de interpretar retorno. Corrigido com `token.call(...)` e a mesma regra acima.

---

## 1. Diff exato – `contracts/ArcDEXRouter.sol`

```diff
--- a/contracts/ArcDEXRouter.sol
+++ b/contracts/ArcDEXRouter.sol
@@ -16,6 +16,16 @@ interface IERC20 {
     function transferFrom(address from, address to, uint256 amount) external returns (bool);
 }
 
+/**
+ * @dev Helper seguro para transferFrom: tokens que retornam vazio (ex. USDC precompile)
+ *      são aceitos. Regra: success && (data.length == 0 || abi.decode(data, (bool))).
+ */
+library TransferHelper {
+    function safeTransferFrom(address token, address from, address to, uint256 value) internal {
+        (bool success, bytes memory data) = token.call(
+            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
+        );
+        require(success && (data.length == 0 || abi.decode(data, (bool))), "ArcDEX: TRANSFER_FAILED");
+    }
+}
+
 interface IArcDEXPair {
     function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
     function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
@@ -60,8 +70,8 @@ contract ArcDEXRouter {
         require(amounts[amounts.length - 1] >= amountOutMin, "ArcDEX: INSUFFICIENT_OUTPUT_AMOUNT");
 
-        // Puxa tokens do usuário para o primeiro pair do path
+        // Puxa tokens do usuário para o primeiro pair do path (safe para tokens que retornam vazio, ex. USDC precompile)
         address pair0 = pairFor(path[0], path[1]);
-        require(IERC20(path[0]).transferFrom(msg.sender, pair0, amounts[0]), "ArcDEX: TRANSFER_FAILED");
+        TransferHelper.safeTransferFrom(path[0], msg.sender, pair0, amounts[0]);
 
         _swap(amounts, path, to);
     }
```

---

## 2. Diff exato – `remix/ERC20TransferHelper.sol`

```diff
--- a/remix/ERC20TransferHelper.sol
+++ b/remix/ERC20TransferHelper.sol
@@ -18,10 +18,16 @@ interface IERC20Minimal {
     function approve(address spender, uint256 amount) external returns (bool);
 }
 
+/**
+ * @dev Helper seguro: aceita tokens que retornam vazio (ex. USDC precompile).
+ *      Regra: success && (data.length == 0 || abi.decode(data, (bool))).
+ */
 contract ERC20TransferHelper {
     function doTransfer(address token, address to, uint256 amount) external returns (bool) {
-        bool ok = IERC20Minimal(token).transferFrom(msg.sender, to, amount);
-        require(ok, "transfer failed");
+        (bool success, bytes memory data) = token.call(
+            abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, msg.sender, to, amount)
+        );
+        require(success && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
         return true;
     }
 }
```

---

## 3. Checklist rápido – testes no Remix (Arc Testnet)

Endereços de referência:

| Item        | Endereço |
|------------|----------|
| Factory    | `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F` |
| Router     | `0xD9540A723500498df9E682e438571d374e903204` (redeploy com o Router patchado) |
| USDC       | `0x3600000000000000000000000000000000000000` |
| EURC       | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| amountIn   | `1000000` (1e6, 1 USDC) |

### 3.1 Compilar e fazer deploy do Router (patchado)

1. Abrir `contracts/ArcDEXRouter.sol` no Remix (ou colar o código).
2. Compiler: **0.8.20** (ou compatível).
3. Compilar.
4. Deploy & Run → **ArcDEXRouter**, constructor: `_factory` = `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F` → Deploy.
5. Anotar o novo endereço do Router (substitui o antigo para os testes).

### 3.2 getAmountsOut(1e6, path)

1. No contrato Router deployado, abrir **getAmountsOut**.
2. `amountIn`: `1000000`
3. `path`: `["0x3600000000000000000000000000000000000000","0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"]` (USDC → EURC).
4. Call (view): deve retornar array com 2 elementos, ex.: `[1000000, <amountOut>]` com `amountOut > 0` se o pair tiver liquidez.
5. Se retornar `amountOut = 0`, conferir que o pair existe e tem reservas (getReserves no pair).

### 3.3 swapExactTokensForTokens(1e6, amountOutMin, path, to, deadline)

1. **Approve**: Na USDC (At Address `0x3600...0000`), chamar `approve(spender = endereço do Router patchado, amount = 1000000)` (ou maior). Transact.
2. No Router, chamar **swapExactTokensForTokens**:
   - `amountIn`: `1000000`
   - `amountOutMin`: `0` (ou valor de getAmountsOut com margem, ex. 90% do amountOut)
   - `path`: `["0x3600000000000000000000000000000000000000","0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"]`
   - `to`: seu endereço (ou conta de teste)
   - `deadline`: `block.timestamp + 300` (ex.: timestamp atual + 300 em segundos)
3. Transact: deve passar sem revert. Se rever, mensagem deve ser uma das do Router (EXPIRED, INVALID_PATH, INSUFFICIENT_OUTPUT_AMOUNT, TRANSFER_FAILED) para depuração.

### 3.4 Conferência pós-swap

- Balance de EURC no endereço `to`: deve ter aumentado.
- Balance de USDC do `msg.sender`: deve ter diminuído em 1e6 (mais taxas, se houver).

---

## 4. O que não foi alterado (patch mínimo)

- Factory e Pair: inalterados.
- Frontend: inalterado.
- Apenas: `contracts/ArcDEXRouter.sol` (library + uso de `TransferHelper.safeTransferFrom`) e `remix/ERC20TransferHelper.sol` (low-level call + regra de retorno).
