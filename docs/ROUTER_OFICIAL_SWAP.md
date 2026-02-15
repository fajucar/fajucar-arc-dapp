# Router Oficial ArcDEX — Swap USDC/EURC

## Endereços (Arc Testnet)

| Contrato | Endereço |
|----------|----------|
| **Router** | `0x3bE7d2Ed202D5B65b9c78BBf59f6f70880F6C0a6E` |
| Factory | `0x4b6F738717c46A8998990EBCb17FEf032DC5958B` |
| Pair USDC/EURC | `0x327f52e7cDfF1567F1708c2D045c7e2963e4889A` |
| USDC (precompile) | `0x3600000000000000000000000000000000000000` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

## Configuração

O frontend usa o Router definido em `src/config/arcTestnet.ts` (fonte única).

## Checagem do Router

O frontend verifica se o Router suporta tokens precompile (ex.: USDC na Arc):

1. **Primeiro**: chama `supportsPrecompileTokens()` no contrato.
   - Se existir e retornar `true` → Router OK.
   - Se retornar `false` → mostra banner "Router na versão antiga".

2. **Fallback** (quando a função não existe, ex.: Router oficial SingleHop):
   - Chama `getAmountsOut(1, [USDC, EURC])` para testar se o Router é operacional.
   - Se funcionar → permite swap.
   - Se falhar → não bloqueia; o usuário pode tentar e verá o erro real.

## Swap

1. Conecte na **Arc Testnet** (Chain ID 5042002).
2. Selecione USDC → EURC (ou vice-versa).
3. Informe o valor (ex.: 1 USDC).
4. Se precisar, clique em **Aprovar e Swap** (aprova USDC para o Router).
5. Clique em **Swap** para executar.

## Erros comuns

- **"Approve insuficiente"**: clique em "Aprovar e Swap" antes do swap.
- **"Pool sem liquidez"**: adicione liquidez em Pools primeiro.
- **Revert no swap**: verifique o erro na tela ou no console; pode ser allowance, liquidez ou path inválido.
