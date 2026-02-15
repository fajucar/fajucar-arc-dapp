# Redeploy Router para corrigir swap com Pair Arc Testnet

## Router oficial em uso

O frontend usa o Router: `0xCD1dbb9a6E4f9FE4e6ab76F5fC917829CF740128`.

Se você usa o Router oficial, o frontend aceita automaticamente mesmo sem `supportsPrecompileTokens()` (testa `getAmountsOut` como fallback). Veja `docs/ROUTER_OFICIAL_SWAP.md`.

## Quando fazer redeploy

O Router deployado pode:
1. Esperar `getReserves()` com 3 valores — o Pair Arc retorna 2 → revert
2. Não ter `supportsPrecompileTokens()` — o frontend faz fallback com `getAmountsOut`; se funcionar, permite swap

## Solução (Redeploy manual)

Fazer redeploy do Router com o contrato completo: `getReserves` com 2 retornos + TransferHelper + `supportsPrecompileTokens()`.

## Passos no Remix

1. **Compilar**
   - Abra `docs/ArcDEXRouter_Remix_Compila.sol` ou `contracts/ArcDEXRouter.sol`
   - Compiler: **0.8.20** | Optimizer: **200**
   - Compile

2. **Deploy**
   - Environment: **Injected Provider** (MetaMask)
   - Conecte na **Arc Testnet** (chainId 5042002)
   - Contract: `ArcDEXRouter`
   - `_constructor`: `0x0521040935960c6883B9AaBD9927F7889B0790f2` (Factory oficial)

3. **Atualizar config do frontend**
   - Copie o endereço do Router deployado
   - Edite `src/config/arcTestnet.ts`:
     ```ts
     router: '0xNOVO_ENDERECO' as `0x${string}`,
     ```
   - Edite `src/config/deployments.arc-testnet.json`:
     ```json
     "router": "0xNOVO_ENDERECO"
     ```

4. **Approve + Swap**
   - No USDC, chame `approve(router, amount)`
   - Execute o swap normalmente
