# Resolver revert do Swap (USDC → EURC)

O revert **"swapExactTokensForTokens reverted"** com token aprovado e Router compatível acontece porque o **Router deployado on-chain** ainda é o antigo: ele usa `IERC20.transferFrom` direto, e o USDC precompile não retorna `bool`, então o `require` falha.

## Solução em 4 passos

### Opção A: Deploy pela CLI (recomendado)

1. No **.env**, adicione a chave da carteira que vai pagar o gas (não commitar):
   ```env
   DEPLOYER_PRIVATE_KEY=0x...
   ```
2. Rode:
   ```bash
   npm run deploy:router
   ```
3. Copie a linha **VITE_DEX_ROUTER_ADDRESS=...** que aparecer no final e cole no seu **.env** (substituindo o valor antigo).
4. Reinicie o app (`npm run dev`), **aprove** USDC de novo na tela de Swap e teste o swap.

### Opção B: Usar o Router patchado no Remix

### 1. Usar o Router patchado no Remix

O código em **`contracts/ArcDEXRouter.sol`** já está patchado (library `TransferHelper` + `safeTransferFrom`). Você precisa deployar **esse** arquivo:

1. Abra no Remix o conteúdo de **`contracts/ArcDEXRouter.sol`** do repositório (copie e cole ou importe).
2. Compile com Solidity **0.8.20**.
3. Deploy: **ArcDEXRouter**, constructor `_factory` = `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`.
4. **Anote o endereço** do novo contrato (será diferente do atual).

### 2. Atualizar o endereço no app

**Arquivo `.env`** (tem prioridade):

```env
VITE_DEX_ROUTER_ADDRESS=<NOVO_ENDERECO_DO_ROUTER>
```

**Arquivo `src/config/deployments.arc-testnet.json`** (fallback):

```json
"router": "<NOVO_ENDERECO_DO_ROUTER>"
```

Substitua `<NOVO_ENDERECO_DO_ROUTER>` pelo endereço anotado no passo 1.

### 3. Reiniciar o front e aprovar de novo

1. Pare o dev server (Ctrl+C) e rode de novo: `npm run dev`.
2. Na carteira, **revogue o approve** do USDC para o Router antigo (opcional, mas evita confusão).
3. Na tela de Swap, clique em **Aprovar** de novo — assim o USDC fica aprovado para o **novo** Router.

### 4. Testar o swap

Coloque 1 USDC, mínimo recebido (ex. 0) ou um valor baixo, e clique em **Swap**. A transação deve passar.

---

## Conferir se o Router é o patchado

No Remix, no contrato deployado, abra a aba **Code** ou **Read contract**. Se existir a função ou a lógica da **library TransferHelper** (ou se o bytecode for maior que o do contrato antigo), é o Router novo.  
Ou: faça um deploy novo com o `ArcDEXRouter.sol` do repo e use **sempre** esse endereço no app.
