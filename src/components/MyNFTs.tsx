import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { getUserTokens, getNFTInfo } from '../utils/contracts';
import toast from 'react-hot-toast';

interface NFTInfo {
  tokenId: string;
  tokenURI: string;
  owner: string;
}

// Descrições dos personagens por tokenId
const NFT_DESCRIPTIONS: Record<number, { title: string; description: string }> = {
  1: {
    title: "O Observador",
    description: "Um personagem que representa vigilância, visão estratégica e o nascimento da Arc."
  },
  2: {
    title: "O Guardião",
    description: "Símbolo de proteção, força e estabilidade da rede."
  },
  3: {
    title: "O Arquiteto",
    description: "Responsável por construir e organizar as camadas do ecossistema."
  }
};

// Helper para obter descrição baseada em tokenId
function getNFTDescription(tokenId: string): { title: string; description: string } {
  const id = parseInt(tokenId, 10);
  return NFT_DESCRIPTIONS[id] || {
    title: `NFT #${tokenId}`,
    description: "Descrição em breve"
  };
}

// Helper para obter imagem fallback baseada em tokenId
function getFallbackImage(tokenId: string): string {
  const id = parseInt(tokenId, 10);
  if (id === 1) {
    return '/assets/nfts/arc_explorer.png';
  } else if (id === 2) {
    return '/assets/nfts/arc_builder.png';
  } else if (id === 3) {
    return '/assets/nfts/arc_guardian.png';
  }
  return '/assets/nfts/arc_explorer.png';
}

// Helper para converter IPFS para HTTP
function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
  }
  if (uri.startsWith('https://') || uri.startsWith('http://')) {
    return uri;
  }
  return uri;
}

export function MyNFTs() {
  const { address, provider, isConnected } = useWallet();
  const [nfts, setNfts] = useState<NFTInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadataCache, setMetadataCache] = useState<Record<string, { name?: string; image?: string }>>({});

  const loadNFTs = useCallback(async () => {
    if (!provider || !address) return;
    
    setLoading(true);
    setError(null);
    try {
      const tokenIds = await getUserTokens(provider, address);
      
      // If no tokens, just set empty array (not an error)
      if (tokenIds.length === 0) {
        setNfts([]);
        setLoading(false);
        return;
      }
      
      // Fetch info for each token
      const nftInfos = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            return await getNFTInfo(provider, tokenId);
          } catch (error) {
            console.warn(`Error loading token ${tokenId}:`, error);
            return null;
          }
        })
      );
      
      // Filter out nulls
      const validNFTs = nftInfos.filter((nft): nft is NFTInfo => nft !== null);
      setNfts(validNFTs);

      // Load metadata in background (non-blocking, visual only)
      validNFTs.forEach(async (nft) => {
        if (nft.tokenURI && nft.tokenURI.trim() !== '') {
          try {
            const httpUrl = ipfsToHttp(nft.tokenURI);
            const response = await fetch(httpUrl, {
              headers: { 'Accept': 'application/json' },
            });
            if (response.ok) {
              const data = await response.json();
              setMetadataCache((prev) => ({
                ...prev,
                [nft.tokenId]: {
                  name: data?.name,
                  image: data?.image,
                },
              }));
            }
          } catch (error) {
            // Silently fail - metadata is optional
          }
        }
      });
    } catch (error: any) {
      console.error('Failed to load NFTs:', error);
      setError(error?.message || 'Failed to load NFTs');
      // Only show error toast if it's not just an empty result
      if (!error.message?.includes('empty') && !error.message?.includes('no tokens')) {
        toast.error(error.message || 'Failed to load NFTs');
      }
      setNfts([]);
    } finally {
      setLoading(false);
    }
  }, [provider, address]);

  useEffect(() => {
    if (isConnected) {
      loadNFTs();
    } else {
      setNfts([]);
      setMetadataCache({});
    }
  }, [isConnected, loadNFTs]);

  if (!isConnected) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-8 text-center">
        <p className="text-slate-400">Please connect your wallet to view your NFTs</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Minhas NFTs</h2>
        </div>
        {/* Skeleton loader */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-pulse"
            >
              <div className="w-full h-64 bg-slate-700 rounded-lg mb-4"></div>
              <div className="h-6 bg-slate-700 rounded mb-2"></div>
              <div className="h-4 bg-slate-700 rounded mb-1"></div>
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
        <p className="text-slate-400 text-center mt-4">Loading your NFTs...</p>
      </div>
    );
  }

  if (error && nfts.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-red-500/30 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Minhas NFTs</h2>
          <button
            onClick={loadNFTs}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Retry
          </button>
        </div>
        <p className="text-red-400 text-center">{error}</p>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Minhas NFTs</h2>
          <button
            onClick={loadNFTs}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <p className="text-slate-400 text-center">You don't have any NFTs yet. Mint one from the collection above!</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Minhas NFTs</h2>
        <button
          onClick={loadNFTs}
          disabled={loading}
          className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {/* Grid responsivo estável - todos os cards têm mesma largura/altura */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nfts.map((nft) => {
          const description = getNFTDescription(nft.tokenId);
          const metadata = metadataCache[nft.tokenId];
          const imageUrl = metadata?.image 
            ? ipfsToHttp(metadata.image) 
            : getFallbackImage(nft.tokenId);
          
          return (
            <div
              key={nft.tokenId}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col h-full transition-all hover:border-slate-600 hover:shadow-lg"
            >
              {/* Imagem com altura fixa e object-fit: cover */}
              <div className="w-full h-64 mb-4 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                <img
                  src={imageUrl}
                  alt={metadata?.name || description.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback para imagem local se metadata.image falhar
                    const target = e.target as HTMLImageElement;
                    target.src = getFallbackImage(nft.tokenId);
                  }}
                />
              </div>
              
              {/* Conteúdo do card - flex-grow para ocupar espaço restante */}
              <div className="flex flex-col flex-grow">
                {/* Nome do NFT */}
                <h3 className="text-lg font-semibold text-white mb-2">
                  {metadata?.name || `NFT #${nft.tokenId}`}
                </h3>
                
                {/* Título do personagem */}
                <h4 className="text-sm font-medium text-cyan-400 mb-2">
                  {description.title}
                </h4>
                
                {/* Descrição do personagem */}
                <p className="text-sm text-slate-400 mb-4 line-clamp-3 flex-grow">
                  {description.description}
                </p>
                
                {/* Token ID e Owner - sempre no final */}
                <div className="mt-auto space-y-2 pt-4 border-t border-slate-700">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Token ID</span>
                    <span className="text-slate-300 font-mono">#{nft.tokenId}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Owner: {nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
