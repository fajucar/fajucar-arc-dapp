# 🚨 RESOLVER PROBLEMA DE VARIÁVEIS DE AMBIENTE

## ⚠️ PROBLEMA
As variáveis de ambiente não estão sendo carregadas pelo Vite.

## ✅ SOLUÇÃO DEFINITIVA - SIGA ESTES PASSOS NA ORDEM:

### PASSO 1: Pare TODOS os servidores Vite
- Abra TODOS os terminais onde `npm run dev` está rodando
- Em cada um, pressione **Ctrl+C** para parar
- **CONFIRME** que todos os servidores foram parados

### PASSO 2: Crie/Recrie o arquivo .env
```bash
cd frontend
node scripts/create-env-simple.js
```

Este comando vai:
- ✅ Remover qualquer arquivo `.env` antigo
- ✅ Remover arquivos com nomes incorretos
- ✅ Criar um novo arquivo `.env` correto
- ✅ Verificar se foi criado corretamente

### PASSO 3: Verifique o arquivo .env
```bash
cd frontend
npm run check:env
```

Você deve ver:
- ✅ Arquivo .env encontrado
- ✅ Todas as 3 variáveis presentes e válidas

### PASSO 4: Limpe o cache do Vite (IMPORTANTE!)
```bash
cd frontend
rm -rf node_modules/.vite
# ou no Windows PowerShell:
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
```

### PASSO 5: Reinicie o servidor
```bash
cd frontend
npm run dev
```

**AGUARDE** até ver a mensagem:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
```

### PASSO 6: Abra o navegador
1. Abra: `http://localhost:3000`
2. Abra o Console do navegador (F12 → Console)
3. Procure por mensagens que começam com `🔍 [contracts.ts]`
4. Verifique se as variáveis aparecem como definidas (não como "UNDEFINED")

### PASSO 7: Recarregue a página
- Pressione **F5** ou **Ctrl+R** para recarregar
- O componente de debug deve mostrar as variáveis em VERDE

## 🔍 VERIFICAÇÃO

Se ainda não funcionar, verifique:

1. **Arquivo .env existe?**
   ```bash
   cd frontend
   ls .env  # ou dir .env no Windows
   ```

2. **Conteúdo do arquivo está correto?**
   ```bash
   cd frontend
   cat .env  # ou type .env no Windows
   ```
   
   Deve mostrar:
   ```
   VITE_MOCK_USDC_ADDRESS=0x3d77FAb8568F9c50C034311AA22088Cd045a30A0
   VITE_GIFT_CARD_NFT_ADDRESS=0x345BE458b089C9747a4251BB39250F180a55D823
   VITE_GIFT_CARD_MINTER_ADDRESS=0x7F6E8905e03D4CC7e93ABa24bCA569E142Bd88dF
   ```

3. **Servidor foi realmente reiniciado?**
   - O servidor deve mostrar "ready in xxx ms" DEPOIS de você executar `npm run dev`
   - Se você só recarregou a página, o servidor NÃO foi reiniciado

4. **Cache do Vite foi limpo?**
   - A pasta `node_modules/.vite` deve ser removida antes de reiniciar

## 💡 DICA IMPORTANTE

O Vite **NUNCA** recarrega variáveis de ambiente automaticamente. 
Sempre que você criar ou modificar o `.env`, você DEVE:
1. Parar o servidor (Ctrl+C)
2. Limpar o cache (`rm -rf node_modules/.vite`)
3. Reiniciar o servidor (`npm run dev`)

## 🆘 SE AINDA NÃO FUNCIONAR

Execute este comando completo:
```bash
cd frontend
node scripts/create-env-simple.js
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
npm run dev
```

Depois abra `http://localhost:3000` e verifique o console do navegador (F12).
