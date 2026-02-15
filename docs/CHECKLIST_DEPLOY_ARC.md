# Checklist deploy ArcDEX (Arc Testnet) — 1 arquivo no Remix

Use **um único arquivo**: `docs/ArcDEX_Remix_AllInOne.sol`.  
Tokens: USDC `0x3600000000000000000000000000000000000000`, EURC `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`.

| # | O que fazer |
|---|-------------|
| 1 | Remix: colar `ArcDEX_Remix_AllInOne.sol`, compilar (Solidity 0.8.20), rede Arc Testnet. |
| 2 | Deploy **ArcDEXFactory**. Anotar endereço da Factory. |
| 3 | Na Factory: **createPair**(USDC, EURC). Anotar endereço do Pair. |
| 4 | Deploy **ArcDEXRouter** com `_factory` = endereço da Factory. Anotar endereço do Router. |
| 5 | Liquidez: aprovar USDC e EURC para o **Pair**; transferir USDC e EURC para o Pair; chamar **mint**(sua_carteira) no Pair. |
| 6 | No projeto: editar `src/config/deployments.arc-testnet.json` e colocar o **novo** `factory` e **novo** `router`. |

Depois: recarregar o DApp e testar swap USDC → EURC (ex.: 1% slippage).
