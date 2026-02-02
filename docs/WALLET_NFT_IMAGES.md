# Imagens dos NFTs na carteira (MetaMask etc.)

A carteira (MetaMask, Rainbow, etc.) busca os dados do NFT **diretamente no contrato** e na **URL retornada por `tokenURI(tokenId)`**. Ela não usa o frontend do seu app.

## Por que as imagens não aparecem na carteira?

1. **`tokenURI` no contrato aponta para localhost**  
   Se o contrato foi configurado com algo como `http://localhost:3000/metadata/arc-explorer.json`, a carteira **não consegue acessar** essa URL (ela não está “no seu computador” da mesma forma que o navegador do app).

2. **URL não é pública**  
   A URL retornada por `tokenURI` precisa ser acessível por qualquer um na internet (ex.: IPFS ou o domínio do seu site em produção).

## O que fazer para as imagens aparecerem na carteira

1. **Coloque metadata e imagens em URLs públicas**
   - Opção A: fazer deploy do app (ex.: Vercel, Netlify) e usar a URL de produção (ex.: `https://seu-app.vercel.app/metadata/arc-explorer.json`).
   - Opção B: publicar metadata e imagens no IPFS e usar URIs `ipfs://...` ou `https://ipfs.io/ipfs/...`.

2. **Configure o contrato com essas URLs**
   - No contrato FajucarCollection, use a função de configuração (ex.: `setModel`) para cada `modelId` (1, 2, 3) com:
     - **URI do metadata**: URL pública do JSON (ex.: `https://seu-app.vercel.app/metadata/arc-explorer.json`).
   - O JSON do metadata deve seguir o padrão ERC-721 e ter o campo **`image`** com uma URL **também pública** (ex.: `https://seu-app.vercel.app/assets/nfts/arc_explorer.png` ou IPFS).

3. **NFTs já mintados**
   - Se o contrato já tiver sido configurado com localhost, os NFTs já mintados continuarão com esse `tokenURI`. Só novos mints (após atualizar as URIs no contrato) ou um upgrade/migração do contrato podem usar as novas URLs. Para NFTs já existentes, a carteira continuará tentando acessar a URL antiga.

## Resumo

| Onde                    | Quem busca a imagem                         | O que fazer |
|-------------------------|---------------------------------------------|-------------|
| **App (My NFTs)**       | O frontend do app (com fallbacks)           | Já tratado: fallback com assets do app quando o metadata falha. |
| **Carteira (MetaMask)** | A carteira via `tokenURI` do contrato       | Configurar no contrato **tokenURI públicos** (produção ou IPFS). |

Não é possível fazer a carteira usar as imagens do app sem que o **contrato** retorne URIs públicas.
