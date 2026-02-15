# ArcDEX deployment order and architecture

## Deployment order (Arc Testnet)

1. **Deploy Factory**  
   - Contract: `ArcDEXFactory`  
   - Constructor: `_feeToSetter` (e.g. your EOA).  
   - Anote o endereço da Factory.

2. **Deploy Router**  
   - Contract: `ArcDEXRouter`  
   - Constructor: `_factory` = endereço da Factory do passo 1.  
   - Anote o endereço do Router.

3. **Create pair**  
   - Na Factory: `createPair(USDC, EURC)`.  
   - USDC = `0x3600000000000000000000000000000000000000`  
   - EURC = `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`  
   - Anote o endereço do Pair (evento `PairCreated` ou retorno).

4. **Approve tokens**  
   - User approves **Router** (não o Pair) para gastar USDC e EURC:  
     `token.approve(routerAddress, type(uint256).max)` (ou valor desejado).

5. **Add liquidity**  
   - User chama **Router**:  
     `addLiquidity(USDC, EURC, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline)`.  
   - O Router faz `transferFrom` dos dois tokens do user para o Pair e depois `pair.mint(to)`.

6. **Config**  
   - Atualize `src/config/deployments.arc-testnet.json` (ou equivalente) com os endereços da **Factory** e do **Router** usados no deploy.

---

## Why the previous setup failed

1. **IERC20Full**  
   - Expunha só `approve`, `balanceOf`, `allowance`.  
   - Não tinha `transfer` nem `transferFrom`.  
   - Qualquer fluxo que dependesse da ABI “ERC20 completa” (incluindo envio de tokens) falhava ou exigia truques de UI, porque a interface não batia com o que o token realmente expõe.

2. **Router incompleto**  
   - Só tinha `swapExactTokensForTokens`.  
   - Não tinha `addLiquidity` nem `removeLiquidity`.  
   - Liquidez tinha que ser feita “na mão” (enviar tokens ao Pair e chamar `mint()`), o que aumentava risco de erro e não passava por um único contrato padrão.

3. **LiquidityHelper**  
   - Usava `IERC20Minimal.transferFrom(..., ).returns(bool)`.  
   - Em redes onde o token é precompile (ex.: USDC na Arc), `transferFrom` pode não retornar `bool`.  
   - A chamada revertia ou falhava em fallback, e ainda duplicava lógica que deveria estar no Router.

4. **Múltiplas factories/pairs**  
   - Vários endereços de Factory e Pair sem um Router único e claro que definisse “esta Factory + estes Pairs” gerou confusão sobre qual par e qual factory o frontend deveria usar.

---

## Why this fix works

1. **IERC20Standard**  
   - Interface única com as 5 funções necessárias: `transfer`, `transferFrom`, `approve`, `balanceOf`, `allowance`.  
   - Frontend e scripts usam a mesma ABI para leitura e envio de tokens; sem ambiguidade.

2. **Router completo (estilo UniswapV2Router02)**  
   - **addLiquidity**: Router usa `TransferHelper.safeTransferFrom` (chamada low-level que aceita tokens que não retornam `bool`) para enviar os dois tokens do user ao Pair e depois chama `pair.mint(to)`. Um único fluxo padrão.  
   - **removeLiquidity**: Router puxa LP do user para o Pair com `TransferHelper.safeTransferFrom(pair, msg.sender, pair, liquidity)` e chama `pair.burn(to)`.  
   - **swapExactTokensForTokens**: Continua usando `TransferHelper.safeTransferFrom` para o token de entrada, compatível com precompile.

3. **TransferHelper em todo fluxo de token**  
   - Todas as movimentações de tokens (incluindo LP no removeLiquidity) passam por `TransferHelper`, que não exige retorno `bool`.  
   - Funciona com ERC20 “normal” e com precompile (ex.: USDC/EURC na Arc).

4. **Um Router, uma Factory**  
   - Deploy explícito: 1 Factory → 1 Router (apontando para essa Factory) → createPair na mesma Factory.  
   - O frontend usa só o endereço desse Router; o Router usa sempre a mesma Factory e os Pairs criados por ela.  
   - Arquitetura limpa e previsível.
