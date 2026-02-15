# Corrigir erro: "O Router não conseguiu calcular o swap"

Esse erro aparece quando o **Router** deployado foi criado com uma **Factory diferente** da que está em `deployments.arc-testnet.json`. O Router precisa ter sido deployado passando exatamente a Factory da config no construtor.

## Solução em 3 passos

### 1. Factory da config (use esta)

No arquivo `src/config/deployments.arc-testnet.json` a Factory correta é:

```
0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F
```

**Não** faça deploy de uma Factory nova se essa já existir na testnet. Use sempre esse endereço ao deployar o Router.

### 2. Deploy do Router no Remix com a Factory correta

1. Abra **https://remix.ethereum.org**
2. Conecte na **Arc Testnet** (Chain ID 5042002) no MetaMask.
3. Crie um arquivo e cole o código de `contracts/ArcDEXRouter.sol` (ou use o que já está no Remix).
4. Compile com Solidity **0.8.20** ou superior.
5. Em **Deploy & Run Transactions**:
   - Contrato: **ArcDEXRouter**
   - No campo do construtor **_factory** cole **exatamente**:
     ```
     0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F
     ```
   - Clique em **Deploy**.
6. **Copie o endereço** do Router que aparece após o deploy.

### 3. Atualizar o projeto com o novo Router

**Opção A – Só no JSON (recomendado)**

Edite `src/config/deployments.arc-testnet.json` e troque o valor de `"router"` pelo novo endereço:

```json
{
  "chainId": 5042002,
  "factory": "0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F",
  "router": "0xSEU_NOVO_ENDERECO_DO_ROUTER",
  "tokens": { ... }
}
```

**Opção B – .env**

Se você usa variável de ambiente, no `.env`:

```
VITE_DEX_ROUTER_ADDRESS=0xSEU_NOVO_ENDERECO_DO_ROUTER
```

O frontend usa primeiro o router do JSON; se não houver, usa o do `.env`.

### Verificação

Depois de atualizar e recarregar o app:

- O aviso "O Router não usa a mesma Factory da config" deve sumir.
- Na interface de Swap, o texto de debug (se estiver visível) deve mostrar `router.factory() on-chain: 0x386c7...`.

No Remix você também pode chamar no Router deployado a função **factory()** e conferir se retorna `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`.

## Resumo

| O que está errado | O que fazer |
|-------------------|-------------|
| Router foi deployado com outra Factory | Fazer novo deploy do Router no Remix passando a Factory `0x386c7...` |
| Config aponta para o Router antigo | Atualizar `router` em `deployments.arc-testnet.json` (ou `VITE_DEX_ROUTER_ADDRESS` no .env) com o endereço do novo Router |
