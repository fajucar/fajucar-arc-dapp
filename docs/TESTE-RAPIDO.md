# ⚡ TESTE RÁPIDO - 3 PASSOS

## 🚀 TESTE EM 30 SEGUNDOS

### 1️⃣ Verificar arquivo .env
```bash
cd frontend
npm run test:complete
```

**✅ Se mostrar:** "✅ TODOS OS TESTES PASSARAM!"  
**❌ Se mostrar:** "❌ ALGUNS TESTES FALHARAM!" → Execute: `node scripts/create-env-simple.js`

### 2️⃣ Iniciar servidor e verificar terminal
```bash
npm run dev
```

**Procure no terminal por:**
```
🔍 [vite.config.ts] Variáveis de ambiente carregadas:
  VITE_MOCK_USDC_ADDRESS: 0x3d77...
  VITE_GIFT_CARD_NFT_ADDRESS: 0x345B...
  VITE_GIFT_CARD_MINTER_ADDRESS: 0x7F6E...
✅ Todas as variáveis foram carregadas com sucesso!
```

**✅ Se aparecer:** Funcionou!  
**❌ Se aparecer:** "UNDEFINED" → Pare o servidor (Ctrl+C), limpe cache e reinicie

### 3️⃣ Verificar no navegador
1. Abra: `http://localhost:3000`
2. Pressione **F12** → Console
3. Procure por: `🔍 [contracts.ts] Environment Variables:`

**✅ Se mostrar endereços:** Funcionou!  
**❌ Se mostrar "UNDEFINED":** Reinicie o servidor

---

## 📋 CHECKLIST COMPLETO

- [ ] Arquivo `.env` existe e tem 3 variáveis
- [ ] Terminal mostra "✅ Todas as variáveis foram carregadas"
- [ ] Console do navegador mostra endereços (não UNDEFINED)
- [ ] Página mostra variáveis em VERDE (não "NÃO DEFINIDA")
- [ ] Não aparece caixa vermelha de erro

---

## 🔧 COMANDOS ÚTEIS

```bash
# Testar tudo
npm run test:complete

# Verificar .env
npm run verify:env

# Criar .env
node scripts/create-env-simple.js

# Limpar cache e preparar
npm run prepare:dev
```
