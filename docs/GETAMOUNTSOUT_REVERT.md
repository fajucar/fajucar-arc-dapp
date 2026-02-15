# Diagnóstico: getAmountsOut reverted

## 1. Path usado no getAmountsOut

O path é montado em **uma única linha** no `handleSwap`:

```typescript
// Path e slippage: usar decimals do token (6 para USDC/EURC), nunca parseEther
const path: `0x${string}`[] = [tokenFrom.address, tokenTo.address]
```

- **path[0]** = token **From** (ex.: USDC)
- **path[1]** = token **To** (ex.: EURC)

Chamada ao Router:

```typescript
const amounts = (await publicClient.readContract({
  address: DEX_ROUTER_ADDRESS,
  abi: ARCDEX_ROUTER_ABI,
  functionName: 'getAmountsOut',
  args: [amountIn, path],
})) as bigint[]
```

### Valores atuais (Arc Testnet – par com liquidez 0xf9758A...)

| Token | Endereço (42 caracteres) |
|-------|---------------------------|
| USDC  | `0x3600000000000000000000000000000000000000` |
| EURC  | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (token1 do pair) |

**Importante:** O EURC no código deve ser **exatamente** o `token1` do par que tem liquidez (chame `pair.token1()` on-chain). Par atual: `0xf9758A1565E9a1380f599803Aa741718E1dC2A6E`.

Para swap **USDC → EURC**:

- `path = [ "0x3600000000000000000000000000000000000000", "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" ]`
- `amountIn` = `parseUnits(amountFrom, 6)` (ex.: 1 USDC = `1_000_000`)

---

## 2. Por que getAmountsOut pode reverter

1. **Par inexistente**  
   O Router usa `pairFor(path[0], path[1])` com a Factory dele. Se a Factory for outra ou o par não foi criado, o endereço do pair pode ser `address(0)` ou um contrato sem liquidez e o Router pode reverter.

2. **Reservas zero**  
   O par existe mas `getReserves()` retorna (0, 0). Cálculo de saída dá divisão por zero ou o Router reverte por “sem liquidez”.

3. **Router ≠ Factory da config**  
   O Router foi deployado com outra Factory. O `pairFor` dele aponta para um par que não é o mesmo da sua Factory (ou que não existe). Resultado: par inválido ou sem liquidez na visão do Router.

4. **Ordem do path**  
   Em Uniswap V2 o pair é criado com `token0 < token1` (por endereço). O path deve ser `[tokenIn, tokenOut]`. Aqui está correto: `[tokenFrom, tokenTo]`. Se o seu Router usar outra convenção, o path pode estar invertido em relação ao que o contrato espera.

---

## 3. O que verificar na prática

1. **Par na Factory da config**
   - Chamar na Factory da config: `getPair(USDC, EURC)`.
   - Se retornar `0x000...0` → par não criado; criar o par ou adicionar liquidez no fluxo correto.

2. **Reservas do par**
   - No endereço do par: `getReserves()`.
   - Se `reserve0 == 0 && reserve1 == 0` → par sem liquidez; adicionar liquidez (ex.: em Pools).

3. **Router vs Factory**
   - Chamar no Router: `factory()`.
   - Deve ser igual ao endereço da Factory da config (`0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`).
   - Se for outro endereço → Router incompatível; usar Router deployado com a Factory da config.

4. **pairFor do Router**
   - Chamar no Router: `pairFor(USDC, EURC)`.
   - O resultado deve ser **o mesmo** que `Factory.getPair(USDC, EURC)`.
   - Se for diferente → o Router está calculando outro par e getAmountsOut pode reverter ou retornar dados de outro pair.

---

## 4. Ajuste no código (já aplicado)

A checagem de **par existente** e **reservas > 0** foi colocada **antes** da chamada a `getAmountsOut`. Assim:

- Se o par não existir ou não tiver liquidez, o usuário vê “Par não encontrado” ou “Par sem liquidez” e o Router **não** é chamado.
- No console (F12) passamos a logar `path` (endereços e símbolos) e `amountIn` antes de chamar `getAmountsOut`, para você conferir path e reserves no momento do erro.

Use o **Debug Panel (Swap)** na UI para ver `pair`, `reserves`, `router.factory()` e comparar com o que o Router espera.
