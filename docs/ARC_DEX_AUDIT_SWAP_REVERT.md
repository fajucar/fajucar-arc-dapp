# Auditoria: compatibilidade Factory / Pair / Router e causa do revert no Swap

## 1. Compatibilidade entre contratos

### 1.1 ArcDEXFactory

- **createPair(tokenA, tokenB):** ordena `(token0, token1)`, usa `salt = keccak256(abi.encodePacked(token0, token1))`, faz `new ArcDEXPair{salt: salt}()` e em seguida `IArcDEXPair(pair).initialize(token0, token1)`. Registra em `getPair[token0][token1]` e `getPair[token1][token0]`.
- **Conclusão:** createPair deploya o Pair corretamente e chama `initialize(token0, token1)` na ordem certa. Compatível com o Router.

### 1.2 ArcDEXPair

- **initialize(token0, token1):** executa uma vez, exige `token0 < token1` implícito (quem chama é a Factory já com a ordem certa). OK.
- **Interface usada pelo Router:**
  - `getReserves() returns (uint112, uint112, uint32)` — Pair implementa exatamente isso (linhas 75–83).
  - `swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data)` — Pair implementa (linhas 209–237), assinatura idêntica.
- **Conclusão:** O Pair implementa exatamente a interface UniswapV2Pair que o Router espera. Nenhuma incompatibilidade de assinatura ou tipo.

### 1.3 ArcDEXRouter

- Obtém o par **só** via `IArcDEXFactory(factory).getPair(token0, token1)`. Não há uso de CREATE2 nem de `INIT_CODE_PAIR_HASH` no Router.
- **Conclusão:** Não existe INIT_CODE_PAIR_HASH para manter consistente; o endereço do par é sempre o retorno de `factory.getPair()`. A única dependência é o Router usar a **mesma** Factory onde o par foi criado.

---

## 2. O que está errado

- O problema **não** é bug de linha nos contratos (nem Factory, nem Pair, nem Router).
- O problema é **configuração/deploy:** o Router que está na config (**0x2C1aA15ED76AfB280f14d82cDDA62841949f50dd**) foi construído com um `factory` **diferente** da Factory da config (**0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F**).

Consequência em cadeia:

1. Frontend usa Factory da config (0x386c7...) e vê par e liquidez (getPair + getReserves direto na Factory/Par).
2. Ao fazer swap, a frontend chama o **Router** (0x2C1aA...).
3. O Router chama `pairFor(USDC, EURC)` → `IArcDEXFactory(router.factory()).getPair(token0, token1)`.
4. `router.factory()` é o endereço passado no **construtor** do Router (outra Factory, não 0x386c7...).
5. Nessa outra Factory, pode não existir par USDC/EURC, ou o par tem outro endereço. Então:
   - Ou `getPair` retorna `address(0)` → `getReserves` no Router chama `IArcDEXPair(address(0)).getReserves()` → **revert** (chamada a endereço sem código).
   - Ou `getPair` retorna um par sem liquidez → `getReserves` retorna (0,0) → `getAmountOut` faz `require(reserveIn > 0 && reserveOut > 0, "ArcDEX: INSUFFICIENT_LIQUIDITY")` → **revert** com essa mensagem.

Ou seja: o revert acontece **no Router**, em:

- **getReserves** (linha 137), se `pair` for `address(0)` (chamada a zero), ou  
- **getAmountOut** (linha 96), com `"ArcDEX: INSUFFICIENT_LIQUIDITY"`, se o par retornado pela Factory do Router tiver reservas zero.

Em ambos os casos a causa raiz é a mesma: **Router e “Factory da config” não são o par Factory/Router deployados juntos.**

---

## 3. Onde verificar

- **Contrato:** ArcDEXRouter (comportamento dependente do `factory` imutável).
- **Conceito:** O Router usa apenas `factory.getPair()`. Se esse `factory` não for a Factory onde o par USDC/EURC foi criado, o swap sempre falha (par zero ou par sem liquidez).
- **Não há linha “errada” no código:** a lógica está correta; o que está errado é o **par (Factory, Router)** usado no deploy vs. o par (Factory, Router) na config.

---

## 4. Correção mínima (sem refatorar frontend, sem mudar lógica dos contratos)

Regra: **o Router deve ter sido deployado com a mesma Factory em que o par USDC/EURC existe e tem liquidez.**

Tem dois caminhos (escolha um).

### Opção A – Ajustar a config à chain (recomendado se a liquidez já está numa Factory “antiga”)

1. No Remix (ou outro cliente), no contrato **Router** em 0x2C1aA...:
   - Chame `factory()` e anote o endereço completo (ex.: `0x...`).
2. Em **`src/config/deployments.arc-testnet.json`**:
   - Substitua o campo **`factory`** por esse endereço (o que o Router realmente usa).
3. Garanta que o par USDC/EURC e a liquidez existam **nessa** Factory (a que o Router usa). Se não existir, crie o par nessa Factory e adicione liquidez.
4. Não é necessário alterar o frontend nem os contratos; só a config passa a refletir a chain.

### Opção B – Ajustar a chain à config (usar a Factory da config)

1. No Remix, faça **um novo deploy** de **ArcDEXRouter** com o construtor:
   - `_factory` = **0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F** (Factory da config).
2. Anote o endereço do **novo** Router.
3. Em **`deployments.arc-testnet.json`**:
   - Atualize o campo **`router`** para o endereço do novo Router.
4. O par e a liquidez já estão na Factory 0x386c7..., então o novo Router passará a encontrar o par e o swap funcionará.
5. Nenhuma mudança no frontend além do endereço do Router na config.

---

## 5. Resumo

| Item | Status |
|------|--------|
| createPair deploya o Pair corretamente | OK |
| initialize(token0, token1) está correta | OK |
| Pair implementa a interface esperada pelo Router | OK |
| INIT_CODE_PAIR_HASH / CREATE2 no Router | Não usado; Router usa só factory.getPair() |
| Causa do revert | Router.factory() ≠ Factory da config → par errado ou zero → getReserves/getAmountOut revertem |
| Onde “está errado” | Não é linha de contrato; é o par (Factory, Router) usado no deploy vs. na config |
| Correção mínima | Opção A: config.factory = router.factory() on-chain e par com liquidez nessa Factory; ou Opção B: novo Router com factory = config Factory e config.router = novo Router |

Nenhuma alteração de código nos contratos é necessária; apenas alinhar Factory/Router entre deploy e config (e garantir que o par com liquidez exista na Factory que o Router usa).
