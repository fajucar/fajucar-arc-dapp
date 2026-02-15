# Deploy do ArcDEXRouter no Remix e atualização do frontend

Factory e Pair já estão corretos. Só é necessário deployar um **novo** Router apontando para a Factory correta e atualizar a config do frontend.

---

## Parte 1: Deploy do novo Router no Remix

### 1. Abrir o Remix
- Acesse: https://remix.ethereum.org

### 2. Colar o contrato
- Crie um arquivo (ex.: `ArcDEXRouter.sol`) ou use um existente.
- Cole o conteúdo do arquivo **contracts/ArcDEXRouter.sol** do seu projeto.

### 3. Compilar
- Aba **Solidity Compiler** (ícone de compilador).
- Compiler: **0.8.20** ou superior.
- Clique em **Compile ArcDEXRouter.sol** (ou o nome do seu arquivo).

### 4. Conectar à Arc Testnet
- Aba **Deploy & Run Transactions**.
- Environment: **Injected Provider - MetaMask** (ou sua wallet).
- Confirme que a rede é **Arc Testnet** (Chain ID 5042002).

### 5. Selecionar o contrato
- No dropdown **Contract**, selecione **ArcDEXRouter**.
- **Não** use "At Address". Deixe o formulário de deploy normal (com campo do construtor).

### 6. Preencher o construtor
- Aparece um campo ao lado do botão **Deploy** (ou **Deploy** em laranja).
- Esse campo é o parâmetro **\_factory** do construtor.
- Cole **exatamente** (sem espaços no início ou fim):
  ```
  0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F
  ```
- Não preencha "At Address". Ignore se houver outros campos além do _factory.

### 7. Fazer o deploy
- Clique em **Deploy**.
- Confirme a transação na MetaMask (Arc Testnet).
- Aguarde a confirmação.

### 8. Copiar o endereço do novo Router
- Abaixo do botão Deploy, na seção **Deployed Contracts**, aparece uma linha com o contrato deployado.
- Ao lado do nome **ArcDEXRouter** há um ícone de copiar ou o endereço em formato `0x...`.
- **Copie esse endereço.** Esse é o **novo** endereço do Router (use como NOVO_ROUTER_ADDRESS nos passos abaixo).

---

## Parte 2: Verificar no Remix que o Router aponta para a Factory correta

### 9. Chamar `factory()` no Router
- Em **Deployed Contracts**, expanda o contrato **ArcDEXRouter** que você acabou de deployar.
- Encontre a função **factory** (view, sem parâmetros).
- Clique em **factory** (ou **call** ao lado).
- Veja o valor retornado.

### 10. Confirmar o retorno
- O retorno deve ser **exatamente**: `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F`
- Se for outro endereço, o deploy foi feito com o _factory errado; refaça do passo 6 com o valor correto.

---

## Parte 3: Atualizar a config do frontend

### 11. Arquivo a editar
- Edite o arquivo: **src/config/deployments.arc-testnet.json**

### 12. Campo a trocar
- Abra o arquivo **src/config/deployments.arc-testnet.json** no projeto.
- Encontre a chave **"router"** (hoje pode estar como `0x2C1aA15ED76AfB280f14d82cDDA62841949f50dd` — esse é o Router antigo).
- **Apague** esse valor e substitua pelo **novo** endereço do Router (o que você copiou no passo 8).
- Exemplo (substitua pelo endereço real que o Remix mostrou após o deploy):
  ```json
  "router": "0xSeuNovoEnderecoAqui"
  ```
- Mantenha **"factory"** e o restante do JSON inalterados.
- **Salve o arquivo** e recarregue o frontend (ou reinicie `npm run dev`).

**Se o erro continuar:** o frontend usa o router desse JSON. Confira se você editou exatamente **src/config/deployments.arc-testnet.json** e a chave **"router"**. Atualizar só o .env não basta se o JSON tiver o router antigo.

### 13. Opcional: variável de ambiente
- Se o projeto usar **.env**, você pode também definir:
  - `VITE_DEX_ROUTER_ADDRESS=NOVO_ROUTER_ADDRESS`
- O frontend usa primeiro o valor de **deployments.arc-testnet.json**; o .env é alternativa ou override. Atualizar só o JSON já é suficiente.

### 14. Testar no frontend
- Reinicie o servidor de desenvolvimento (`npm run dev`) se estiver rodando.
- Recarregue a página do Swap.
- O aviso de "Router não usa a mesma Factory" deve sumir.
- Faça um swap de teste (USDC/EURC com liquidez); deve concluir usando a liquidez existente.

---

## Resumo

| Item | Valor / Ação |
|------|------------------|
| Construtor _factory no Remix | `0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F` |
| Verificação no Remix | `factory()` no Router deve retornar o endereço acima |
| Arquivo do frontend | **src/config/deployments.arc-testnet.json** |
| Campo a atualizar | **"router"** → novo endereço do Router |
| Factory / Pair | Não alterar |

Resultado: Router ligado à Factory correta e swap funcionando com a liquidez existente no par USDC/EURC.
