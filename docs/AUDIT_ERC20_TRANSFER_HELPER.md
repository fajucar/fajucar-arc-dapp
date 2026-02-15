# Auditoria ERC20TransferHelper.sol – compatibilidade USDC precompile

## Escopo

- **Arquivo:** `remix/ERC20TransferHelper.sol`
- **Contexto:** Arc Testnet; USDC precompile `0x3600...0000` pode não retornar valor em `transfer`/`transferFrom`.
- **Regra alvo:** `success && (data.length == 0 || abi.decode(data, (bool)))`. Não usar `IERC20.transferFrom` direto; não exigir `bool` sem aceitar `data` vazio.

---

## 1. Resultado da auditoria

| Verificação | Status |
|-------------|--------|
| Usa `IERC20.transferFrom` direto? | **Não** – usa `token.call(abi.encodeWithSelector(...))` |
| Exige retorno `bool` sem aceitar `data.length == 0`? | **Não** – condição é `data.length == 0 \|\| abi.decode(data, (bool))` |
| Faz `abi.decode(data, (bool))` sem checar `data.length`? | **Não** – decode só quando `data.length != 0` |
| Padrão precompile | **Atendido** – `success && (data.length == 0 \|\| abi.decode(data, (bool)))` |

**Conclusão:** O arquivo `remix/ERC20TransferHelper.sol` **já está corrigido** e compatível com o USDC precompile.

---

## 2. Diff exato do helper (versão errada → versão atual)

Versão **errada** (chamada direta à interface, sem aceitar retorno vazio):

```solidity
contract ERC20TransferHelper {
    function doTransfer(address token, address to, uint256 amount) external returns (bool) {
        bool ok = IERC20Minimal(token).transferFrom(msg.sender, to, amount);
        require(ok, "transfer failed");
        return true;
    }
}
```

Diff para a versão **correta** em `remix/ERC20TransferHelper.sol`:

```diff
--- versão errada (IERC20 direto, exige bool)
+++ remix/ERC20TransferHelper.sol (low-level call, aceita data vazio)
@@ -20,10 +20,16 @@ interface IERC20Minimal {
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

## 3. Confirmação de compatibilidade com USDC precompile

- **Comportamento do precompile:** `transferFrom` pode executar com sucesso e retornar **0 bytes** (sem `bool`).
- **Chamada direta `IERC20Minimal(token).transferFrom(...)`:** o ABI espera um `bool`; retorno vazio pode ser decodado como `false` ou causar falha → **revert**.
- **Implementação atual do helper:**
  - Usa `token.call(...)`, não interface direta.
  - Considera sucesso quando: `success == true` **e** (`data.length == 0` **ou** `abi.decode(data, (bool)) == true`).
  - Com retorno vazio do precompile: `success == true`, `data.length == 0` → condição satisfeita, sem `abi.decode` em buffer vazio.

**Confirmação:** O `remix/ERC20TransferHelper.sol` atual é **compatível com o USDC precompile** da Arc Testnet (`0x3600000000000000000000000000000000000000`).

---

## 4. O que não foi alterado

- Factory, Pair e frontend: **inalterados**.
- Apenas o helper em `remix/ERC20TransferHelper.sol` foi auditado e já está na versão correta.
