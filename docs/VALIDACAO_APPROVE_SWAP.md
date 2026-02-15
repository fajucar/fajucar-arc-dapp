# Checklist de validação – fluxo Approve + Swap

Referência: `src/components/Swap/SwapInterface.tsx`

---

## 1. Verificação de allowance

**Requisito:** Ler `allowance(owner, router)` de forma reativa e derivar `needsApproval`.

**Implementação (linhas 360–375):**

```typescript
// Allowance do token From para o Router (reactivo; refetch após approve)
const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
  address: tokenFrom.address,
  abi: ERC20_ABI,
  functionName: 'allowance',
  args: address && DEX_ROUTER_ADDRESS ? [address, DEX_ROUTER_ADDRESS] : undefined,
})

// Precisa de approve se amountIn > 0 e allowance < amountIn (6 decimais para USDC/EURC)
const amountInForApproval = safeParseUnits(amountFrom, tokenFrom.decimals)
const needsApproval = Boolean(
  amountInForApproval != null &&
  amountInForApproval > 0n &&
  DEX_ROUTER_ADDRESS &&
  address &&
  (currentAllowance === undefined ? true : currentAllowance < amountInForApproval)
)
```

| Item | Status |
|------|--------|
| `useReadContract` com `allowance(owner, spender)` | OK |
| `args: [address, DEX_ROUTER_ADDRESS]` (owner, router) | OK |
| `args` undefined quando sem `address` ou router (evita chamada inválida) | OK |
| `needsApproval` quando `currentAllowance < amountIn` | OK |
| Uso de `tokenFrom.decimals` (6 para USDC/EURC) em `amountInForApproval` | OK |
| `refetchAllowance` disponível para chamar após approve | OK |

---

## 2. Hook de approve

**Requisito:** `useWriteContract` para approve e `useWaitForTransactionReceipt` para confirmação.

**Implementação (linhas 357–358, 665–685):**

```typescript
const { writeContractAsync: writeContract, data: hash, isPending } = useWriteContract()
const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

// Em handleApprove:
setLastWriteType('approve')
await writeContract({
  address: tokenFrom.address,
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [DEX_ROUTER_ADDRESS, maxUint256],
})
```

| Item | Status |
|------|--------|
| Approve para o Router (`DEX_ROUTER_ADDRESS`) | OK |
| Valor: `maxUint256` (approve único para vários swaps) | OK |
| ABI ERC-20 com `approve(spender, amount)` | OK |
| `useWaitForTransactionReceipt({ hash })` para confirmação | OK |
| `lastWriteType === 'approve'` para distinguir approve de swap | OK |

---

## 3. Função handleApprove

**Requisito:** Validações, troca de rede se necessário, chamada ao approve e feedback.

**Implementação (linhas 636–686):**

| Item | Status |
|------|--------|
| Checagem `isConnected` / `address` | OK |
| Troca para Arc se `isWrongChain` (`switchChain`) | OK |
| Checagem `tokenFrom` e `DEX_ROUTER_ADDRESS` | OK |
| `setLastWriteType('approve')` antes de `writeContract` | OK |
| Toast "Abrindo carteira..." / "Aguardando confirmação..." | OK |
| Em erro: `setLastWriteType(null)` e toast de falha/cancelamento | OK |

---

## 4. Lógica needsApproval

**Requisito:** Swap só habilitado quando `currentAllowance >= amountIn`.

**Implementação (linhas 368–375, 1296–1297, 1453, 1484):**

- `needsApproval` é derivado de `currentAllowance` e `amountInForApproval`.
- `canSwap` inclui `!needsApproval`.
- Botão "2. Swap" com `disabled={!canSwap || needsApproval || isLoading}`.
- Botão "1. Approve" só renderizado quando `needsApproval`.

| Item | Status |
|------|--------|
| `needsApproval` quando `currentAllowance === undefined` (tratado como “precisa approve”) | OK |
| `needsApproval` quando `currentAllowance < amountInForApproval` | OK |
| Swap desabilitado quando `needsApproval` | OK |
| Approve exibido apenas quando `needsApproval` | OK |

---

## 5. handleSwap sem approve interno

**Requisito:** Swap não faz approve por dentro; exige approve prévio.

**Implementação (linhas 706–710):**

```typescript
if (needsApproval) {
  toast.error('Aprove o token primeiro. Clique em "1. Approve ' + (tokenFrom?.symbol ?? 'token') + '".')
  return
}
```

| Item | Status |
|------|--------|
| Early return em `handleSwap` quando `needsApproval` | OK |
| Mensagem orientando clicar em "1. Approve" | OK |
| Nenhum `writeContract(approve)` dentro de `handleSwap` | OK |

---

## 6. Refetch de allowance após approve

**Requisito:** Após confirmação do approve, atualizar allowance para liberar o botão Swap.

**Implementação (linhas 1244–1280):**

```typescript
useEffect(() => {
  if (!isSuccess) return
  const type = lastWriteType
  setLastWriteType(null)
  toast.dismiss('approve-pending')
  if (type === 'approve') {
    refetchAllowance()
    toast.success('✅ Approve confirmado! Agora clique em "2. Swap".')
  }
  // ...
}, [isSuccess, lastWriteType, refetchAllowance, ...])
```

| Item | Status |
|------|--------|
| `refetchAllowance()` quando `lastWriteType === 'approve'` e `isSuccess` | OK |
| Toast específico para approve confirmado | OK |

---

## 7. Decimais (USDC/EURC = 6)

**Requisito:** Nunca `parseEther`; sempre `parseUnits(amount, token.decimals)`.

**Implementação:**

- `safeParseUnits(value, decimals)` (linhas 33–43) usa `parseUnits(t, decimals)`.
- `amountInForApproval = safeParseUnits(amountFrom, tokenFrom.decimals)` (linha 368).
- `tokenFrom.decimals` vem de `TOKENS` / `ARCDEX.decimals` (6 para USDC e EURC).
- No fluxo de swap: `amountIn = safeParseUnits(amountFrom, tokenFrom.decimals)` e uso de `tokenTo.decimals` para saída.

| Item | Status |
|------|--------|
| Nenhum `parseEther` no componente | OK |
| Uso consistente de `tokenFrom.decimals` / `tokenTo.decimals` | OK |
| Config de decimals em `deployments.arc-testnet.json` (USDC/EURC 6) | OK |

---

## 8. UI: botões 1. Approve e 2. Swap

**Implementação (linhas 1451–1504):**

| Item | Status |
|------|--------|
| Botão "1. Approve {tokenFrom.symbol}" quando `needsApproval` | OK |
| Desabilitado sem valor ou durante loading (approve ou swap) | OK |
| Estados de loading: "Aguardando assinatura..." / "Confirmando..." | OK |
| Botão "2. Swap" desabilitado quando `needsApproval` ou `!canSwap` ou `isLoading` | OK |
| Loading do swap: "Aguardando assinatura..." / "Executando swap..." | OK |
| Mensagem "Token aprovado. Pode clicar em 2. Swap." quando já aprovado | OK |

---

## 9. Feedback de sucesso/erro

| Item | Status |
|------|--------|
| Toast de sucesso ao confirmar approve | OK |
| Toast de sucesso ao confirmar swap | OK |
| Limpeza de From/To e atualização de balance após swap | OK |
| Toast de erro em approve (rejeitado na carteira / outro erro) | OK |
| Toast de erro em handleSwap quando `needsApproval` | OK |

---

## 10. Endereços e ABI

| Item | Status |
|------|--------|
| Router em `ARCDEX.router` (deployments.arc-testnet.json) | OK |
| USDC/EURC e decimals em config (tokens + deployments) | OK |
| ABI do Router com `swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)` | OK |
| ERC20_ABI com `allowance`, `approve`, `balanceOf`, `decimals` | OK |

---

## Resumo

- Allowance: `useReadContract` + `needsApproval` derivado.
- Approve: `handleApprove` com `writeContract(approve)` e `lastWriteType = 'approve'`.
- Refetch: `refetchAllowance()` no efeito quando `isSuccess` e `lastWriteType === 'approve'`.
- Swap: só executa sem `needsApproval`; sem approve dentro de `handleSwap`.
- Decimais: sempre `token.decimals` (6 para USDC/EURC).
- UI: dois botões com estados e feedback conforme acima.

Para validar na prática: conectar carteira na Arc Testnet, colocar valor (ex.: 1 USDC), conferir que aparece "1. Approve USDC", aprovar, aguardar confirmação e mensagem "Token aprovado...", então clicar "2. Swap" e executar o swap.
