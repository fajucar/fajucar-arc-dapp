# Atualizar o Router após o deploy

O frontend usa **somente** o endereço do Router definido em **src/config/deployments.arc-testnet.json**. Não há fallback para `.env` nem valor hardcoded.

## 1. Editar o JSON

- Abra **src/config/deployments.arc-testnet.json**.
- Localize a chave **"router"**.
- Substitua o valor pelo **novo** endereço do Router (o que você obteve no Remix após o deploy com _factory = 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F).
- Salve o arquivo.

Exemplo:
```json
"router": "0xSEU_NOVO_ENDERECO_AQUI"
```

## 2. Reiniciar o dev e recarregar

- Pare o servidor (Ctrl+C no terminal onde está `npm run dev`).
- Rode de novo: **npm run dev**.
- No navegador, **recarregue a página** (F5 ou Ctrl+R).

## 3. Conferir no console

- Abra o DevTools (F12) → aba **Console**.
- Você deve ver ao carregar a página do Swap:
  - **\[ArcDEX config\] routerAddress:** … (deve ser o novo endereço)
  - **\[ArcDEX config\] factoryAddress:** 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F
  - **\[Swap init\] routerAddress:** … (mesmo do config)
  - **\[Swap init\] factoryAddress:** 0x386c7CEcFc46E3E6c989B0F27f44BEeC3C11ab3F

Se **routerAddress** ainda for 0x2C1aA..., o JSON não foi salvo ou o dev não foi reiniciado.
