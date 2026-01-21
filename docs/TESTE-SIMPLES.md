# ✅ TESTE SIMPLES - 2 COMANDOS

## 🚀 TESTE RÁPIDO

### 1️⃣ Testar arquivo .env
```bash
cd frontend
node scripts/teste-completo.js
```

Ou do diretório raiz:
```bash
npm run test:env
```

### 2️⃣ Iniciar servidor e verificar
```bash
npm run dev
```

**Procure no terminal por:**
```
✅ Todas as variáveis foram carregadas com sucesso!
```

---

## 📋 O QUE VERIFICAR

### ✅ Se funcionou:
- Terminal mostra: "✅ Todas as variáveis foram carregadas"
- Console do navegador (F12) mostra endereços (não UNDEFINED)
- Página mostra variáveis em VERDE

### ❌ Se não funcionou:
- Terminal mostra: "UNDEFINED"
- Console mostra: "UNDEFINED"
- Página mostra: "NÃO DEFINIDA" em vermelho

**Solução:**
1. Pare o servidor (Ctrl+C)
2. Execute: `npm run fix:env`
3. Execute: `npm run dev`
4. Recarregue a página (F5)
