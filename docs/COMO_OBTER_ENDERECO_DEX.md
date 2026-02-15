# Como Obter o Endereço do DEX Router

O endereço `VITE_DEX_ROUTER_ADDRESS` é obtido **após fazer o deploy** do contrato `ArcDEXRouter` na Arc Testnet.

## Opção 1: Usando Remix IDE (Mais Fácil)

### Passo 1: Acessar Remix
1. Abra https://remix.ethereum.org
2. Crie um novo arquivo chamado `ArcDEXRouter.sol`
3. Cole o código do arquivo `docs/ArcDEX_Simple.sol` (apenas a parte do Router e interfaces)

### Passo 2: Compilar
1. Vá na aba **Solidity Compiler**
2. Selecione versão `0.8.20` ou superior
3. Clique em **Compile ArcDEXRouter.sol**

### Passo 3: Conectar Wallet
1. Vá na aba **Deploy & Run Transactions**
2. Selecione **Injected Provider - MetaMask** (ou sua wallet)
3. Certifique-se de estar conectado à **Arc Testnet** (Chain ID: 5042002)

### Passo 4: Deploy Factory Primeiro
1. Selecione `ArcDEXFactory` no dropdown
2. Clique em **Deploy**
3. **COPIE O ENDEREÇO** que aparece abaixo (ex: `0x1234...5678`)
   - Este é o endereço do Factory
   - Você precisará dele para deploy do Router

### Passo 5: Deploy Router
1. Selecione `ArcDEXRouter` no dropdown
2. No campo **Deploy**, cole o endereço do Factory (do passo anterior)
3. Clique em **Deploy**
4. **COPIE O ENDEREÇO** que aparece abaixo
   - Este é o `VITE_DEX_ROUTER_ADDRESS` que você precisa!

### Passo 6: Adicionar no .env
Abra o arquivo `.env` na raiz do projeto e adicione:

```env
VITE_DEX_ROUTER_ADDRESS=0x... (cole o endereço copiado aqui)
```

## Opção 2: Usando Hardhat (Avançado)

Se você tem Hardhat configurado:

### 1. Criar script de deploy

Crie `scripts/deploy-dex.js`:

```javascript
const hre = require("hardhat");

async function main() {
  // Deploy Factory
  const Factory = await hre.ethers.getContractFactory("ArcDEXFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("Factory deployed to:", factoryAddress);

  // Deploy Router
  const Router = await hre.ethers.getContractFactory("ArcDEXRouter");
  const router = await Router.deploy(factoryAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("Router deployed to:", routerAddress);
  
  console.log("\n✅ Adicione no .env:");
  console.log(`VITE_DEX_ROUTER_ADDRESS=${routerAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### 2. Executar deploy

```bash
npx hardhat run scripts/deploy-dex.js --network arcTestnet
```

### 3. Copiar endereço

O endereço aparecerá no console. Copie e adicione no `.env`.

## Onde Ver o Endereço Após Deploy

### No Remix:
- Após clicar em **Deploy**, o endereço aparece abaixo do botão
- Formato: `ArcDEXRouter at 0x1234567890abcdef...`
- Clique com botão direito → **Copy address**

### No Hardhat/Console:
- Aparece no console após `deployed to:`
- Exemplo: `Router deployed to: 0x1234567890abcdef...`

### No Explorer (ArcScan):
1. Após o deploy, clique no endereço no Remix
2. Ou acesse: https://testnet.arcscan.app
3. Cole o endereço na busca
4. Você verá o contrato e todas as transações

## Verificar se Está Correto

O endereço deve:
- ✅ Começar com `0x`
- ✅ Ter 42 caracteres (0x + 40 hex)
- ✅ Aparecer no ArcScan quando você buscar

## Exemplo Visual

```
Remix IDE → Deploy & Run → ArcDEXRouter → Deploy
                                           ↓
                                    [0x1234...5678] ← ESTE É O NÚMERO!
                                           ↓
                                    Copiar e colar no .env
```

## Próximos Passos

Após adicionar o endereço no `.env`:

1. Reinicie o servidor de desenvolvimento (`npm run dev`)
2. Acesse a página Swap no dApp
3. O componente `SwapInterface` detectará automaticamente o contrato

## Troubleshooting

- **"Contract not configured"**: Verifique se o endereço está correto no `.env`
- **"Invalid address"**: Certifique-se de que começa com `0x` e tem 42 caracteres
- **"Contract not found"**: O contrato pode não ter sido deployado corretamente
