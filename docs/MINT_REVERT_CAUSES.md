# Causas comuns de revert no mint (ERC-721)

## Objetivo

Quando a transação de mint aparece no explorer como **FAILED (revert)** mas o frontend não tratava isso, o problema é duplo:

1. **Contrato**: algum `require` ou condição bloqueia o mint para EOA.
2. **Frontend**: não validava `receipt.status` e simulava sucesso.

## Erros típicos no contrato

| Causa | Exemplo no contrato | Mensagem sugerida | Solução |
|-------|----------------------|-------------------|---------|
| **Whitelist / onlyOwner** | `require(whitelist[msg.sender])` ou `onlyOwner` no mint | "Not allowed to mint" | Permitir mint para EOA (ou role MINTER) |
| **alreadyMinted** | `require(!hasMintedType[msg.sender][nftType])` | "Already minted this type" | OK; só garantir mensagem clara |
| **Supply** | `require(_nextTokenId <= maxSupply)` | "Max supply reached" | Aumentar limite ou mensagem clara |
| **msg.value** | `require(msg.value >= mintPrice)` | "Insufficient value" | Não exigir valor no mint público ou documentar preço |
| **Pausable** | `whenNotPaused` | "Mint is paused" | Despausar para testes |
| **Zero address** | mint para `address(0)` | "Mint to zero address" | Validar `to != address(0)` |
| **Token URI vazia** | `require(bytes(uri).length > 0)` | "Empty token URI" | Front envia URI fixa válida |

## O que o frontend faz agora

1. **Simulate antes de enviar**: `publicClient.simulateContract(...)`. Se falhar, mostra o motivo do revert e **não envia** a transação.
2. **Aguarda receipt**: `publicClient.waitForTransactionReceipt({ hash })`.
3. **Valida status**: só considera sucesso se `receipt.status === 'success'`. Se falhar, mostra "Transaction reverted on-chain" e link para o explorer.
4. **Sucesso só quando status === success**: o card "Mint submitted" e o toast de sucesso só aparecem nesse caso. Nenhum NFT fantasma.
5. **Listagem**: My NFTs usa apenas `balanceOf` + `tokenOfOwnerByIndex` (ou `getUserTokens` / scan `ownerOf`). Sem totalSupply isolado, sem arrays mockados, sem IDs fixos.

## Contrato de referência

Ver `docs/ArcNFT_Reference.sol` para um contrato Solidity que:

- Implementa `safeMint(to, uri)` e `mintImageNFT(uri)` sem whitelist bloqueando EOA.
- Usa mensagens de revert claras.
- Respeita supply e pausable com mensagens explícitas.
- Está alinhado ao ABI `src/abis/FajuARC.json`.

Depois de ajustar o contrato real (whitelist, supply, pausable, msg.value), fazer novo deploy e atualizar `VITE_FAJUCAR_COLLECTION_ADDRESS` no frontend.
