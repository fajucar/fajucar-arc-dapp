# Guia de Testes - Scripts de Verificação

## 📋 Scripts Disponíveis

### 1. `check-arc.js` - Verificador On-Chain
Verifica contratos NFT e MINTER na blockchain.

### 2. `test-mint-logs.ts` - Validador de Logs de Mint
Valida se uma transação de mint emitiu eventos `Transfer` ERC-721.

---

## 🧪 Como Testar

### **Teste 1: Verificação Básica dos Contratos**

```powershell
# Verificar apenas os contratos (sem wallet)
node scripts/check-arc.js

# Ou via npm
npm run check:arc
```

**O que verifica:**
- ✅ chainId do RPC (deve ser 5042002 para Arc Testnet)
- ✅ Bytecode do contrato NFT (deve existir)
- ✅ Bytecode do contrato MINTER (pode não existir se não deployado)
- ✅ Suporte ERC-721 (`supportsInterface(0x80ac58cd)`)
- ✅ `name()` e `symbol()` do NFT

**Exemplo de saída:**
```
🔍 Verificando contratos Arc Network on-chain...

📋 Configuração:
  RPC: https://rpc.testnet.arc.network
  NFT Address: 0xDf6170342a878A4Bf644639098eb1682c20A9b15
  MINTER Address: 0x7F6E8905E03d4Cc7E93aBA24Bca569E142Bd88Df

1️⃣  Verificando chainId...
  chainId: 5042002
  ✅ Arc Testnet correto (5042002)

2️⃣  Verificando bytecode dos contratos...
  NFT code: ✅ YES
  MINTER code: ❌ NO

3️⃣  Verificando suporte ERC-721...
  supportsInterface(0x80ac58cd): ✅ true

4️⃣  Verificando name() e symbol()...
  name(): FajuARC#3
  symbol(): FAJ

✅ Verificação concluída!
```

---

### **Teste 2: Verificar Balance de uma Wallet**

```powershell
# Substitua 0xSEU_ENDERECO pela sua wallet
node scripts/check-arc.js 0xSEU_ENDERECO

# Exemplo real:
node scripts/check-arc.js 0x1234567890123456789012345678901234567890
```

**O que verifica:**
- ✅ Tudo do Teste 1
- ✅ `balanceOf(wallet)` - quantos NFTs a wallet possui

**Exemplo de saída:**
```
5️⃣  Verificando balanceOf(wallet)...
  balanceOf(0x1234...7890): 2
  ✅ Wallet possui 2 NFT(s)
```

---

### **Teste 3: Verificar com RPC Customizado**

```powershell
# Definir RPC customizado (PowerShell)
$env:RPC_URL="https://rpc.testnet.arc.network"
node scripts/check-arc.js 0xSEU_ENDERECO

# Ou em uma linha (PowerShell)
$env:RPC_URL="https://rpc.testnet.arc.network"; node scripts/check-arc.js 0xSEU_ENDERECO
```

---

### **Teste 4: Validar Logs de uma Transação de Mint**

```powershell
# Substitua 0xTX_HASH pelo hash da transação de mint
npm run test:mint-logs -- 0xTX_HASH

# Exemplo real:
npm run test:mint-logs -- 0xabc123def456...
```

**O que verifica:**
- ✅ Se a transação foi encontrada
- ✅ Quantos logs foram emitidos
- ✅ Se existe evento `Transfer` ERC-721
- ✅ Se o `Transfer` é um mint (`from=0x0` e `to=wallet`)
- ✅ Qual `tokenId` foi mintado

**Exemplo de saída (SUCESSO):**
```
--- Testing Mint Logs for TX: 0xabc123... ---
✅ Transaction found in block: 12345678
Total logs in receipt: 3
  Found Transfer event from contract: 0xDf6170342a878A4Bf644639098eb1682c20A9b15
    Decoded Transfer: from=0x0000...0000, to=0x1234...7890, tokenId=1
    Is Mint (from 0x0): true, Is To User: true
    ✅ Identified as a mint to user. Token ID: 1

🎉 SUCCESS: NFT Minted!
  Token ID: 1
  Emitting Contract: 0xDf6170342a878A4Bf644639098eb1682c20A9b15
```

**Exemplo de saída (FALHA):**
```
❌ FAILURE: No ERC-721 Transfer event found in transaction logs.
  This indicates the contract is not emitting standard ERC-721 Transfer events on mint.
  Please ensure the contract calls _safeMint and emits Transfer events.
```

---

## 🔍 Casos de Teste Comuns

### **Caso 1: Verificar se tudo está configurado corretamente**
```powershell
npm run check:arc
```
**Esperado:** Todos os checks passam (exceto MINTER se não deployado).

---

### **Caso 2: Verificar se sua wallet tem NFTs**
```powershell
# Pegue seu endereço da MetaMask ou do app
npm run check:arc -- 0xSEU_ENDERECO
```
**Esperado:** Mostra `balanceOf` > 0 se você tem NFTs.

---

### **Caso 3: Validar uma transação de mint recente**
```powershell
# 1. Faça um mint no app
# 2. Copie o hash da transação (do toast ou do explorer)
# 3. Execute:
npm run test:mint-logs -- 0xHASH_DA_TX
```
**Esperado:** Mostra `SUCCESS: NFT Minted!` com o `tokenId`.

---

### **Caso 4: Diagnosticar por que mint não funciona**
```powershell
# 1. Verificar contratos primeiro
npm run check:arc

# 2. Se contratos OK, testar uma tx de mint
npm run test:mint-logs -- 0xHASH_DA_TX
```
**Se falhar:** O contrato não está emitindo eventos `Transfer` corretamente.

---

## ⚠️ Troubleshooting

### **Erro: "VITE_GIFT_CARD_NFT_ADDRESS não configurado"**
- Verifique se o arquivo `.env` existe na raiz do projeto
- Verifique se contém: `VITE_GIFT_CARD_NFT_ADDRESS=0x...`

### **Erro: "bad address checksum"**
- O script normaliza automaticamente, mas se persistir:
- Verifique se os endereços no `.env` são válidos (começam com `0x` e têm 42 caracteres)

### **Erro: "MINTER code: NO"**
- Isso é normal se o contrato MINTER não foi deployado ainda
- O NFT ainda pode funcionar se for mintado diretamente

### **Erro: "No ERC-721 Transfer event found"**
- O contrato não está emitindo eventos `Transfer` no mint
- Veja `docs/CONTRACT_REQUIREMENTS.md` para corrigir o contrato Solidity

---

## 📝 Checklist de Testes

Antes de fazer deploy ou reportar bugs, execute:

- [ ] `npm run check:arc` - Contratos configurados corretamente
- [ ] `npm run check:arc -- 0xSUA_WALLET` - Sua wallet tem NFTs (se esperado)
- [ ] `npm run test:mint-logs -- 0xTX_HASH` - Última transação de mint emitiu eventos

---

## 🚀 Próximos Passos

Se os testes falharem:
1. Verifique a configuração do `.env`
2. Verifique se está na rede correta (Arc Testnet, chainId 5042002)
3. Verifique se os contratos foram deployados
4. Se o mint não emite eventos, veja `docs/CONTRACT_REQUIREMENTS.md`
