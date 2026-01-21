# 📸 Como Colocar as Imagens dos NFTs

## 📁 Localização Correta

Coloque as 3 imagens nesta pasta:
```
C:\Users\Fabio Souza\OneDrive\Documentos\ArcMinter-STABLE\public\assets\nfts\
```

## 🖼️ Nomes dos Arquivos

As imagens devem ter exatamente estes nomes:
1. `arc_explorer.png`
2. `arc_builder.png`
3. `arc_guardian.png`

## ✅ Verificação

Após colocar as imagens, execute este comando para verificar:

```powershell
cd "C:\Users\Fabio Souza\OneDrive\Documentos\ArcMinter-STABLE"
Get-ChildItem "public\assets\nfts\*.png"
```

Você deve ver as 3 imagens listadas.

## 🚀 Próximo Passo

Depois de colocar as imagens, você pode fazer o deploy do contrato:

```bash
cd C:\Users\Fabio Souza\ARC
npx hardhat compile
npx hardhat run scripts/deploy-arc-collection.ts --network arcTestnet
```


