# 🧪 COMO TESTAR SE AS VARIÁVEIS DE AMBIENTE ESTÃO FUNCIONANDO

## 📋 TESTE COMPLETO - SIGA ESTES PASSOS:

### PASSO 1: Preparar o ambiente

```powershell
cd frontend
```

### PASSO 2: Criar/Verificar o arquivo .env

```powershell
# Criar o arquivo
$content = "VITE_MOCK_USDC_ADDRESS=0x3d77FAb8568F9c50C034311AA22088Cd045a30A0`nVITE_GIFT_CARD_NFT_ADDRESS=0x345BE458b089C9747a4251BB39250F180a55D823`nVITE_GIFT_CARD_MINTER_ADDRESS=0x7F6E8905e03D4CC7e93ABa24bCA569E142Bd88dF`n"
[System.IO.File]::WriteAllText("$PWD\.env", $content, [System.Text.Encoding]::UTF8)

# Verificar se foi criado
Test-Path .env
Get-Content .env
```

**✅ Resultado esperado:**
- `True` (arquivo existe)
- 3 linhas com os endereços dos contratos

### PASSO 3: Limpar cache

```powershell
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
```

### PASSO 4: Iniciar o servidor

```bash
npm run dev
```

### PASSO 5: Verificar no TERMINAL

**Procure por estas mensagens no terminal:**

```
🔍 [vite.config.ts] Arquivo .env encontrado e lido
🔍 [vite.config.ts] Variáveis de ambiente carregadas:
  VITE_MOCK_USDC_ADDRESS: 0x3d77FAb8568F9c50C034311AA22088Cd045a30A0
  VITE_GIFT_CARD_NFT_ADDRESS: 0x345BE458b089C9747a4251BB39250F180a55D823
  VITE_GIFT_CARD_MINTER_ADDRESS: 0x7F6E8905e03D4CC7e93ABa24bCA569E142Bd88dF
✅ Todas as variáveis foram carregadas com sucesso!
```

**✅ Se você ver essas mensagens:** As variáveis foram carregadas corretamente!

**❌ Se você ver:**
```
⚠️  [vite.config.ts] Arquivo .env não encontrado ou não pôde ser lido
❌ ERRO: Variáveis de ambiente não foram carregadas!
```
**Então há um problema** - verifique se o arquivo .env existe.

### PASSO 6: Abrir o navegador

1. Acesse: `http://localhost:3000`
2. Pressione **F12** para abrir as Ferramentas de Desenvolvedor
3. Vá para a aba **Console**

### PASSO 7: Verificar no CONSOLE do navegador

**Procure por estas mensagens no console:**

```
🔍 [contracts.ts] Environment Variables:
  VITE_MOCK_USDC_ADDRESS: 0x3d77FAb8568F9c50C034311AA22088Cd045a30A0
  VITE_GIFT_CARD_NFT_ADDRESS: 0x345BE458b089C9747a4251BB39250F180a55D823
  VITE_GIFT_CARD_MINTER_ADDRESS: 0x7F6E8905e03D4CC7e93ABa24bCA569E142Bd88dF
📋 [contracts.ts] Parsed Addresses:
  CONTRACT_ADDRESSES: { MOCK_USDC: "0x3d77...", GIFT_CARD_NFT: "0x345B...", GIFT_CARD_MINTER: "0x7F6E..." }
```

**✅ Se você ver essas mensagens com endereços:** Funcionou!

**❌ Se você ver:**
```
VITE_MOCK_USDC_ADDRESS: UNDEFINED
VITE_GIFT_CARD_NFT_ADDRESS: UNDEFINED
VITE_GIFT_CARD_MINTER_ADDRESS: UNDEFINED
```
**Então as variáveis não foram carregadas** - reinicie o servidor.

### PASSO 8: Verificar na PÁGINA (Interface)

Na página, você deve ver:

1. **Seção "🔍 Debug: Variáveis de Ambiente":**
   - Todas as 3 variáveis devem estar em **VERDE**
   - Não deve aparecer "NÃO DEFINIDA"

2. **Seção "📋 Endereços Parseados":**
   - Todos os 3 endereços devem estar em **VERDE**
   - Não deve aparecer "VAZIO"

3. **Não deve aparecer:**
   - Caixa vermelha "⚠️ Variáveis não carregadas!"
   - Caixa amarela "⚠️ Configuração necessária"

### PASSO 9: Teste funcional (opcional)

Se tudo estiver funcionando, teste a funcionalidade:

1. Clique em **"Connect Wallet"**
2. Conecte sua carteira MetaMask
3. A aplicação deve carregar sem erros
4. Você deve conseguir ver seu saldo de USDC
5. Você deve conseguir ver a lista de gift cards (mesmo que vazia)

## 🔍 RESUMO DOS TESTES

| Local | O que verificar | Resultado esperado |
|-------|----------------|-------------------|
| **Terminal** | Mensagens do vite.config.ts | ✅ "Todas as variáveis foram carregadas" |
| **Console (F12)** | Mensagens do contracts.ts | ✅ Endereços definidos (não UNDEFINED) |
| **Página** | Componente EnvDebug | ✅ Variáveis em VERDE |
| **Página** | Componente ConfigError | ✅ Não deve aparecer |

## ❌ SE ALGO DER ERRADO

### Problema: Terminal mostra "UNDEFINED"
**Solução:**
1. Pare o servidor (Ctrl+C)
2. Verifique se o arquivo .env existe: `Get-Content .env`
3. Limpe o cache: `Remove-Item -Recurse -Force node_modules\.vite`
4. Reinicie: `npm run dev`

### Problema: Console mostra "UNDEFINED"
**Solução:**
1. O servidor não foi reiniciado após criar o .env
2. Pare o servidor (Ctrl+C)
3. Reinicie: `npm run dev`
4. Recarregue a página (F5)

### Problema: Página mostra "NÃO DEFINIDA"
**Solução:**
1. Verifique o console do navegador (F12)
2. Se mostrar UNDEFINED, reinicie o servidor
3. Se mostrar os endereços, pode ser cache do navegador - faça um hard refresh (Ctrl+Shift+R)

## ✅ TESTE RÁPIDO (1 minuto)

Execute este comando e verifique o resultado:

```powershell
cd frontend
npm run verify:env
```

Se mostrar "✅ TODAS AS VERIFICAÇÕES PASSARAM!", o arquivo .env está correto.

Depois execute:
```bash
npm run dev
```

E verifique as mensagens no terminal.
