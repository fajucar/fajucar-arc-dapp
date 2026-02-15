# Como corrigir "Router não encontra par (pairFor = 0)"

Esse erro significa: **o contrato Router que o app está usando foi deployado com uma Factory diferente** da que tem o par USDC/EURC (0xf9758A...). Por isso, quando o Router chama `factory.getPair(USDC, EURC)`, recebe 0.

**Caminho para arrumar (só este resolve):**

---

## 1. Deploy de um novo Router no Remix com a Factory correta

1. Abra **Remix**: https://remix.ethereum.org  
2. Crie um arquivo (ou cole o conteúdo) do contrato **ArcDEXRouter**  
   - Código em: `contracts/ArcDEXRouter.sol` deste repositório  
3. Compile (Compiler 0.8.20 ou compatível).  
4. Em **Deploy & Run**:
   - **Environment**: Injected Provider (MetaMask ou carteira da Arc Testnet)
   - **Rede**: Arc Testnet (Chain ID **5042002**)
   - No campo do **construtor** do Router, use **só um argumento**, que é o endereço da Factory:
     ```
     0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F
     ```
   - Clique em **Deploy** e confirme na carteira.  
5. Depois do deploy, **copie o endereço do contrato Router** (não do Pair, não de outro contrato). Deve ser algo como `0x` + 40 caracteres em hex.

---

## 2. Atualizar o app para usar esse Router

Escolha **uma** das opções:

### Opção A – Arquivo JSON (recomendado)

1. Abra `src/config/deployments.arc-testnet.json`.  
2. Troque o valor de `"router"` pelo endereço que você colou do Remix:
   ```json
   "router": "0xSEU_ENDERECO_DO_ROUTER_AQUI"
   ```
3. Salve o arquivo.

### Opção B – Variável de ambiente

1. No `.env`, defina (com o endereço completo, 0x + 40 hex):
   ```env
   VITE_DEX_ROUTER_ADDRESS=0xSEU_ENDERECO_DO_ROUTER_AQUI
   ```
2. Salve o `.env`.

---

## 3. Reiniciar e testar

1. Pare o app (Ctrl+C no terminal do `npm run dev`).  
2. Rode de novo: `npm run dev`.  
3. Abra o Swap, coloque valor (ex.: 5 USDC → EURC) e clique em **Swap**.

Se o Router foi deployado com a Factory `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`, o `pairFor` deixa de retornar 0 e o erro "Router não encontra par" some.

---

## Resumo

| O que está errado | O que fazer |
|-------------------|------------|
| Router deployado com **outra** Factory | Fazer **novo deploy** do Router com a Factory **0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F** |
| App usando Router antigo (env ou JSON) | Atualizar **`deployments.arc-testnet.json`** ou **`.env`** com o endereço do **novo** Router |

Não dá para “consertar” o Router antigo: o endereço da Factory fica fixo no contrato. O único caminho é usar um Router que já tenha sido deployado com a Factory correta.
