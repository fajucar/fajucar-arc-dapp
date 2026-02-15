# Próximos passos para o Swap funcionar

Você já fez várias tentativas e até um novo deploy do Router e ainda não funcionou. O problema é que, **on-chain**, o Router não encontra o par (ou algo na cadeia de chamadas falha). Segue um plano objetivo.

---

## Opção 1: Confirmar no ArcScan (5 min)

Antes de mais deploy, confira na rede o que cada contrato devolve.

1. Abra **https://testnet.arcscan.app** (Arc Testnet).

2. **Factory**  
   - Contrato: `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`  
   - Aba “Read” / “Read Contract”  
   - Função **getPair**  
   - Parâmetros:  
     - tokenA: `0x3600000000000000000000000000000000000000`  
     - tokenB: `0x89850855Aa3bE2F677cD6303Cec089B5F319D72a`  
   - Anote o resultado (deve ser `0xf9758A1565E9a1380f599803Aa741718E1dC2A6E` ou outro par).

3. **Router**  
   - Contrato: `0xD9540A723500498df9E682e438571d374e903204`  
   - **factory()** → deve retornar `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`.  
   - **pairFor**  
     - tokenA: `0x3600000000000000000000000000000000000000`  
     - tokenB: `0x89850855Aa3bE2F677cD6303Cec089B5F319D72a`  
   - Anote o resultado (0x0... ou o endereço do par).

**Interpretação:**

- Se **Factory.getPair** retorna par e **Router.pairFor** retorna **0** → o Router não está usando essa Factory (construtor errado ou outro contrato).  
- Se **Router.factory()** for **diferente** de `0x386c7CEc...` → redeploy do Router com a Factory certa.  
- Se **os dois** retornam o **mesmo** par → o problema é outro (ex.: liquidez, slippage, outro path). Aí dá para focar no frontend/parâmetros.

---

## Opção 2: Redeploy “limpo” (Factory + Router + par + liquidez)

Se a Opção 1 mostrar que Router e Factory não batem, ou você quiser recomeçar do zero:

1. **Remix**  
   - Deploy da **Factory** (contrato da sua Factory, ex. `ArcDEXFactory.sol`).  
   - Anote o endereço da Factory (ex.: `0x...`).

2. **Router**  
   - No **mesmo** Remix, deploy do **Router** com **um único** argumento no construtor: o endereço da **Factory** que você acabou de deployar.  
   - Anote o endereço do Router.

3. **Par e liquidez**  
   - Na **mesma** Factory: criar o par USDC/EURC (endereços que você usa na Arc Testnet).  
   - Adicionar liquidez nesse par (ex.: 160 USDC + 160 EURC, ou o que quiser).

4. **App**  
   - Em `deployments.arc-testnet.json`:  
     - `factory`: endereço da **nova** Factory.  
     - `router`: endereço do **novo** Router.  
   - Se usar `.env`, atualize `VITE_DEX_FACTORY_ADDRESS` e `VITE_DEX_ROUTER_ADDRESS` com os mesmos valores.  
   - Reinicie o app e teste o Swap.

Assim Factory, Router, par e liquidez ficam alinhados na mesma “família” de contratos.

---

## Opção 3: Manter Factory/par atuais e só trocar o Router

Se a **Factory** `0x386c7CEc...` e o **par** `0xf9758A...` estão corretos e com liquidez:

1. No Remix, use **exatamente** o **mesmo** bytecode/contrato do Router que você usa no projeto (ex.: `contracts/ArcDEXRouter.sol`).  
2. No construtor, use **só** este endereço:  
   `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`  
   (sem espaço, sem caractere a mais ou a menos).  
3. Redeploy na **Arc Testnet** (mesma rede do app).  
4. No ArcScan, no **novo** Router:  
   - Chame **factory()** → tem que ser `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`.  
   - Chame **pairFor(USDC, EURC_do_par)** com os mesmos endereços que a Factory usa para o par `0xf9758A...` → tem que retornar `0xf9758A...`.  
5. Se isso bater, atualize no app só o endereço do **router** (JSON e/ou `.env`) e teste de novo.

---

## Resumo

| Situação | Ação |
|----------|------|
| Ainda não conferiu on-chain | Fazer **Opção 1** (ArcScan) e anotar Factory.getPair, Router.factory(), Router.pairFor. |
| Router usa outra Factory ou pairFor = 0 | **Opção 2** (redeploy Factory + Router + par + liquidez) ou **Opção 3** (só Router com Factory 0x386c7... e conferir no ArcScan). |
| Tudo bate no ArcScan e ainda reverte | Enviar os resultados da Opção 1 (ou print do ArcScan) e a mensagem de erro exata do swap para analisar o próximo passo (path, slippage, etc.). |

O que fazer agora: executar a **Opção 1** e, com o que aparecer no ArcScan, decidir entre Opção 2 (redeploy completo) ou Opção 3 (só Router novo com a mesma Factory).
