# ArcMinter (Arc Testnet) — Frontend dApp

React + Vite frontend for minting / managing Gift Card NFTs on **Arc Testnet**.

## Quick start (local)

1) Install deps
```bash
npm install
```

2) Create your env file
```bash
cp .env.example .env
```
Edit `.env` with your deployed contract addresses.

3) Run
```bash
npm run dev
```

## Build
```bash
npm run build
```
Output goes to `dist/`.

## Vercel deploy

### Configuração no painel da Vercel:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Variáveis de ambiente:

Adicione as seguintes variáveis em **Vercel → Settings → Environment Variables**:

- `VITE_WALLETCONNECT_PROJECT_ID` (obrigatório)
- `VITE_ARC_COLLECTION_ADDRESS` (obrigatório)
- `VITE_GIFT_CARD_NFT_ADDRESS` (opcional)

Consulte o arquivo `.env.example` para referência.

## Network (Arc Testnet)
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`

## Testes com TestSprite

Para rodar testes de ponta a ponta com IA via [TestSprite](https://www.testsprite.com/) (MCP no Cursor):

1. Instale o servidor MCP do TestSprite no Cursor e configure sua chave de API (veja [docs/TESTSPRITE.md](docs/TESTSPRITE.md)).
2. Inicie a aplicação: `npm run dev` (app em http://localhost:3000).
3. No chat do Cursor, peça: **"Ajude-me a testar este projeto com o TestSprite."**

Configuração completa e solução de problemas: **[docs/TESTSPRITE.md](docs/TESTSPRITE.md)**.

## Repo hygiene
- Secrets do **not** belong in git. Keep `.env` local and commit only `.env.example`.
- Extra docs/scripts are in `docs/` and `tools/windows/`.
