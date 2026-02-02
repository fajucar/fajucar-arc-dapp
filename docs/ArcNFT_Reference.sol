// SPDX-License-Identifier: MIT
// Referência ERC-721 para deploy. Corrige reverts comuns no mint.
// Compatível com o ABI FajuARC.json (safeMint, mintImageNFT, balanceOf, ownerOf, tokenURI, etc.).

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Erros típicos que causam revert no mint (e como este contrato evita):
 *
 * 1) Whitelist / onlyOwner: se mint() exige whitelist ou owner, EOA comum falha.
 *    Solução: permitir mint para qualquer EOA (ou usar role MINTER).
 *
 * 2) alreadyMinted: hasMintedType(msg.sender, nftType) bloqueia segundo mint do mesmo tipo.
 *    Solução: mensagem clara "Already minted this type"; ou remover limite por tipo se for 1:1.
 *
 * 3) Supply: require(tokenId <= maxSupply) ou similar.
 *    Solução: definir maxSupply alto ou ilimitado; mensagem "Max supply reached".
 *
 * 4) msg.value: require(msg.value >= mintPrice) quando o contrato não exige pagamento.
 *    Solução: não exigir valor em mint público; ou mensagem "Insufficient value".
 *
 * 5) Pausable: quando paused, mint reverte.
 *    Solução: mensagem "Mint is paused"; despausar para testes.
 */
contract ArcNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId = 1;
    uint256 public constant MAX_SUPPLY = 10_000;
    bool public paused;

    mapping(address => mapping(uint256 => bool)) public hasMintedType;
    mapping(uint256 => string) private _tokenURIs;

    event ImageNFTMinted(uint256 indexed tokenId, address indexed to, string tokenURI);

    constructor(address initialOwner) ERC721("ArcNFT", "ARC") Ownable(initialOwner) {}

    modifier whenNotPaused() {
        require(!paused, "Mint is paused");
        _;
    }

    function pause() external onlyOwner {
        paused = true;
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    // safeMint(to, uri) – qualquer EOA pode chamar para mintar para si (to == msg.sender) ou outro
    function safeMint(address to, string calldata uri) external whenNotPaused {
        require(to != address(0), "Mint to zero address");
        require(bytes(uri).length > 0, "Empty token URI");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _tokenURIs[tokenId] = uri;
        emit ImageNFTMinted(tokenId, to, uri);
    }

    // mintImageNFT(uri) – minta para msg.sender com URI
    function mintImageNFT(string calldata uri) external whenNotPaused returns (uint256) {
        require(bytes(uri).length > 0, "Empty token URI");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        _tokenURIs[tokenId] = uri;
        emit ImageNFTMinted(tokenId, msg.sender, uri);
        return tokenId;
    }

    // mint(nftType) – um mint por tipo por conta; mensagem clara se já mintou
    function mint(uint256 nftType) external whenNotPaused {
        require(!hasMintedType[msg.sender][nftType], "Already minted this type");
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        hasMintedType[msg.sender][nftType] = true;
    }

    function mintById(uint256 modelId) external whenNotPaused returns (uint256) {
        require(_nextTokenId <= MAX_SUPPLY, "Max supply reached");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        return tokenId;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // Se o contrato mantém array de tokens por usuário (opcional)
    mapping(address => uint256[]) private _ownedTokens;

    function getUserTokens(address user) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(user);
        uint256[] memory tokens = new uint256[](balance);
        uint256 count = _nextTokenId - 1;
        uint256 idx = 0;
        for (uint256 i = 1; i <= count && idx < balance; i++) {
            try this.ownerOf(i) returns (address o) {
                if (o == user) {
                    tokens[idx++] = i;
                }
            } catch {}
        }
        return tokens;
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721URIStorage)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
}
