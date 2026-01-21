# 🔧 Solução: Problema com Endereços dos Contratos

## ⚠️ Problema
Os endereços dos contratos não estão sendo carregados pelo Vite, causando erros ao conectar a carteira.

## ✅ Solução Rápida

### Passo 1: Verificar/Criar arquivo .env
Execute no terminal (na pasta `frontend`):
```bash
npm run fix:env
```

Ou execute diretamente:
```bash
node scripts/fix-env.js
```

### Passo 2: **IMPORTANTE - Reiniciar o servidor Vite**

O Vite **SÓ CARREGA** variáveis de ambiente quando o servidor é **INICIADO**.

1. **Pare o servidor Vite:**
   - No terminal onde está rodando `npm run dev`, pressione `Ctrl+C`

2. **Reinicie o servidor:**
   ```bash
   npm run dev
   ```

3. **Recarregue a página no navegador:**
   - Pressione `F5` ou `Ctrl+R`

## 📄 Arquivo .env

O arquivo `frontend/.env` deve conter:
```
VITE_MOCK_USDC_ADDRESS=0x3d77FAb8568F9c50C034311AA22088Cd045a30A0
VITE_GIFT_CARD_NFT_ADDRESS=0x345BE458b089C9747a4251BB39250F180a55D823
VITE_GIFT_CARD_MINTER_ADDRESS=0x7F6E8905e03D4CC7e93ABa24bCA569E142Bd88dF
```

## 🔍 Verificação

Após reiniciar o servidor, você deve ver:
- ✅ O componente `EnvDebug` mostrando as variáveis em verde
- ✅ O aviso "Configuração necessária" desaparecendo
- ✅ Poder conectar a carteira sem erros

## ❓ Por que isso acontece?

O Vite carrega variáveis de ambiente apenas na inicialização do servidor. Se você:
- Criar o arquivo `.env` depois que o servidor já está rodando
- Modificar o arquivo `.env` com o servidor rodando

As variáveis **NÃO serão carregadas** até você reiniciar o servidor.

## 🛠️ Scripts Disponíveis

- `npm run fix:env` - Verifica e corrige o arquivo .env
- `npm run check:env` - Verifica se o arquivo .env está correto
- `npm run setup:env` - Cria o arquivo .env
