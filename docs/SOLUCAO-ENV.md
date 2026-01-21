# 🔧 Solução para Variáveis de Ambiente Não Carregadas

## Problema
As variáveis de ambiente (`VITE_MOCK_USDC_ADDRESS`, etc.) aparecem como "NÃO DEFINIDA" no componente de debug.

## Causa
O Vite **só carrega variáveis de ambiente quando o servidor é INICIADO**. Se você criar ou modificar o arquivo `.env` enquanto o servidor já está rodando, as variáveis não serão carregadas.

## Solução Passo a Passo

### 1. Pare o servidor Vite
No terminal onde o `npm run dev` está rodando:
- Pressione **Ctrl+C** para parar o servidor

### 2. Corrija o arquivo .env
Execute:
```bash
cd frontend
npm run fix:env
```

Este comando vai:
- Criar/recriar o arquivo `.env` com os endereços corretos
- Verificar se o arquivo está correto

### 3. Reinicie o servidor
```bash
npm run dev
```

### 4. Recarregue a página
No navegador, pressione **F5** para recarregar a página.

## Verificação

Após reiniciar, o componente de debug deve mostrar:
- ✅ Variáveis em verde (definidas)
- ✅ Endereços parseados em verde (não vazios)

Se ainda aparecer "NÃO DEFINIDA" ou "VAZIO", verifique:
1. O arquivo `.env` existe em `frontend/.env`?
2. O arquivo contém as 3 variáveis necessárias?
3. O servidor foi realmente reiniciado?

## Comandos Úteis

```bash
# Verificar configuração do .env
npm run check:env

# Criar/recriar arquivo .env
npm run fix:env

# Verificar se variáveis estão sendo carregadas
# (olhe o componente de debug na página)
```

## Importante

⚠️ **SEMPRE reinicie o servidor Vite após criar ou modificar o arquivo `.env`!**

O Vite não recarrega variáveis de ambiente automaticamente durante o desenvolvimento.
