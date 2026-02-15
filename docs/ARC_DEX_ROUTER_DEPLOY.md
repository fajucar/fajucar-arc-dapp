# ArcDEX Router – Checklist de Deploy (Remix + Arc Testnet)

Router mínimo estilo Uniswap V2 para ArcDEX. Factory e Pair já deployados; este guia é só para o **Router**.

---

## 1. Contrato

- **Arquivo:** `contracts/ArcDEXRouter.sol`
- **Constructor:** `ArcDEXRouter(address _factory)` — recebe o endereço da Factory.
- **Função principal:** `swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)`.

---

## 2. Deploy no Remix

### 2.1 Abrir o contrato

1. Acesse [Remix](https://remix.ethereum.org).
2. Crie um arquivo `ArcDEXRouter.sol` (ou use o da pasta `contracts/` do projeto).
3. Cole o conteúdo de `contracts/ArcDEXRouter.sol`.

### 2.2 Compilar

1. Aba **Solidity Compiler**.
2. Compiler: **0.8.20** ou superior.
3. Clique em **Compile ArcDEXRouter.sol**.

### 2.3 Conectar e rede

1. Aba **Deploy & Run Transactions**.
2. **Environment:** Injected Provider (MetaMask / Rabby).
3. Confirme que está na **Arc Testnet** (Chain ID **5042002**).

### 2.4 Deploy do Router

1. **Contract:** selecione `ArcDEXRouter`.
2. No campo **Deploy** (constructor), cole o endereço da **Factory**:
   ```text
   0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F
   ```
3. **Value:** 0.
4. Clique em **Deploy** e confirme na carteira.
5. **Copie o endereço do contrato deployado** (ex.: `0x1234...5678`). Esse é o **Router**.

---

## 3. Configurar o front

Escolha **uma** das opções abaixo.

### Opção A – Variável de ambiente (.env)

1. Na raiz do projeto, crie ou edite o arquivo `.env`.
2. Adicione (substitua pelo endereço real do Router):

```env
VITE_DEX_ROUTER_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
```

3. Reinicie o dev server: `npm run dev`.

### Opção B – Arquivo de deployments (sem .env)

1. Abra `src/config/deployments.arc-testnet.json`.
2. No campo `"router"`, coloque o endereço do Router (atualmente está `""`):

```json
{
  "network": "arc-testnet",
  "chainId": 5042002,
  "factory": "0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F",
  "router": "0x1234567890abcdef1234567890abcdef12345678",
  "pair_usdc_eurc": "0xf9758A1565E9a1380f599803Aa741718E1dC2A6E",
  ...
}
```

3. Salve e recarregue a página Swap.

---

## 4. Conferir

1. Acesse a página **Swap** no dApp.
2. Se o Router estiver configurado corretamente, a mensagem *"ArcDEX Router não configurado"* some e o formulário de swap (From / To / amount / Approve / Swap) aparece.
3. Para testar o swap: conecte a carteira, aprove o token de entrada para o Router e execute `swapExactTokensForTokens`.

---

## 5. Endereços de referência (Arc Testnet)

| Contrato   | Endereço |
|-----------|----------|
| Factory   | `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F` |
| Pair USDC/EURC | `0xf9758A1565E9a1380f599803Aa741718E1dC2A6E` |
| USDC      | `0x3600000000000000000000000000000000000000` |
| EURC      | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| Router    | *(o que você obteve no deploy no Remix)* |

---

## 6. Exemplo de .env

Após o deploy do Router, adicione no `.env` (ou use `router` em `src/config/deployments.arc-testnet.json`):

```env
# ArcDEX Router (endereço obtido no Remix após Deploy)
VITE_DEX_ROUTER_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
```

Consulte `.env.example` na raiz do projeto para outras variáveis opcionais.

---

## 7. Troubleshooting

- **"ArcDEX Router não configurado"**  
  Router não está definido: preencha `router` em `deployments.arc-testnet.json` **ou** `VITE_DEX_ROUTER_ADDRESS` no `.env` e reinicie o dev server se usar .env.

- **"INSUFFICIENT_LIQUIDITY"**  
  O pair não tem liquidez suficiente. Adicione liquidez (ex.: via LiquidityHelper no Remix) antes de fazer swap.

- **"EXPIRED"**  
  O `deadline` que o front envia já passou. Aumente o tempo (ex.: 20 minutos a partir de agora).

- **"INSUFFICIENT_OUTPUT_AMOUNT"**  
  Slippage: o valor mínimo de saída não foi atingido. Aumente a tolerância de slippage no front.
