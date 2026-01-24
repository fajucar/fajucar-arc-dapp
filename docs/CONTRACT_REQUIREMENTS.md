# Requisitos do Contrato para Mint On-Chain

## Problema Identificado

O mint atual não está gerando logs no explorer porque o contrato pode não estar emitindo eventos `Transfer` padrão ERC-721.

## Solução: Garantir ERC-721 Compliance

### A) Se o contrato já é ERC-721

A função `mint(uint256 nftType)` **DEVE**:

1. **Chamar `_safeMint` ou `_mint` do OpenZeppelin ERC721:**
   ```solidity
   function mint(uint256 nftType) external {
       require(!hasMintedType(msg.sender, nftType), "Already minted");
       
       uint256 tokenId = _nextTokenId++;
       
       // CRITICAL: _safeMint automatically emits Transfer event
       _safeMint(msg.sender, tokenId);
       
       // Update minted type tracking
       _mintedTypes[msg.sender][nftType] = true;
   }
   ```

2. **Garantir incremento de tokenId:**
   - Usar `_nextTokenId++` ou similar
   - Cada mint deve ter um `tokenId` único e sequencial

3. **NÃO pode mintar sem emitir Transfer:**
   - `_safeMint` e `_mint` do OpenZeppelin **sempre** emitem `Transfer(address(0), to, tokenId)`
   - Se usar implementação custom, garantir que emite o evento

### B) Se o contrato NÃO é ERC-721

**Mudança mínima necessária:**

1. **Herdar de ERC721 do OpenZeppelin:**
   ```solidity
   import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
   
   contract ArcNFT is ERC721 {
       uint256 private _nextTokenId = 1;
       
       function mint(uint256 nftType) external {
           require(!hasMintedType(msg.sender, nftType), "Already minted");
           
           uint256 tokenId = _nextTokenId++;
           _safeMint(msg.sender, tokenId);
           
           _mintedTypes[msg.sender][nftType] = true;
       }
   }
   ```

2. **Ou implementar Transfer event manualmente:**
   ```solidity
   event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
   
   function mint(uint256 nftType) external {
       require(!hasMintedType(msg.sender, nftType), "Already minted");
       
       uint256 tokenId = _nextTokenId++;
       
       // CRITICAL: Emit Transfer event
       emit Transfer(address(0), msg.sender, tokenId);
       
       // Update balances and ownership
       _balances[msg.sender]++;
       _owners[tokenId] = msg.sender;
       
       _mintedTypes[msg.sender][nftType] = true;
   }
   ```

## Validação

Após corrigir o contrato:

1. **Deploy o contrato atualizado**
2. **Execute o script de teste:**
   ```bash
   npm run test:mint-logs -- <TX_HASH>
   ```
3. **Verifique que:**
   - `receipt.logs.length > 0`
   - Existe evento `Transfer` com `from == 0x0`
   - O contrato que emitiu o evento é o `NFT_ADDRESS`

## Frontend

O frontend foi corrigido para:
- ✅ Só marcar como "Minted" se encontrar evento `Transfer`
- ✅ Mostrar erro se não encontrar evento
- ✅ Logs detalhados para debug

## Arquivos Relacionados

- **Frontend:** `src/components/Mint/MintPage.tsx` (linha 165-263)
- **Script de teste:** `scripts/test-mint-logs.ts`
- **ABI:** `src/abis/FajuARC.json`
