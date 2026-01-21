import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { mintImageNFT } from '../utils/contracts';
import { ARC_COLLECTION } from '../config/arcCollection';
import { ARC_TESTNET, CONTRACT_ADDRESSES } from '../config/contracts';
import toast from 'react-hot-toast';
import { Copy, ExternalLink } from 'lucide-react';

export function ArcCollectionGallery() {
  const { address, provider, isConnected, chainId } = useWallet();
  const [minting, setMinting] = useState<number | null>(null);

  const handleMint = async (item: typeof ARC_COLLECTION[0]) => {
    if (!provider || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    // Check if connected to Arc Testnet
    if (chainId !== ARC_TESTNET.chainId) {
      toast.error(`Please switch to ${ARC_TESTNET.chainName} (Chain ID: ${ARC_TESTNET.chainId})`);
      return;
    }

    // Check if tokenURI is configured
    if (item.tokenURI.includes('YOUR-HOSTED-URL') || item.tokenURI.includes('TODO')) {
      toast.error('TokenURI not configured. Please update arcCollection.ts with actual metadata URLs.');
      return;
    }

    setMinting(item.id);
    
    try {
      toast.loading(`Minting ${item.name}...`, { id: 'minting' });
      
      const tokenId = await mintImageNFT(provider, item.tokenURI);
      const contractAddress = CONTRACT_ADDRESSES.GIFT_CARD_NFT;
      const explorerUrl = `https://testnet.arcscan.app/token/${contractAddress}?a=${tokenId.toString()}`;
      
      // Enhanced success toast with copy buttons and import instructions
      toast.success(
        (t) => (
          <div className="space-y-3">
            <div className="font-semibold text-green-800">
              ✅ Successfully minted {item.name}!
            </div>
            <div className="text-sm space-y-2">
              <div className="flex items-center justify-between bg-green-50 p-2 rounded">
                <span className="text-green-700">Token ID:</span>
                <span className="font-mono text-green-800">{tokenId.toString()}</span>
              </div>
              <div className="flex items-center justify-between bg-green-50 p-2 rounded">
                <span className="text-green-700">Contract:</span>
                <span className="font-mono text-xs text-green-800">
                  {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-green-200">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                onClick={() => toast.dismiss(t.id)}
              >
                <ExternalLink className="w-3 h-3" />
                View on Explorer
              </a>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(contractAddress);
                    toast.success('Contract address copied!');
                  } catch {
                    toast.error('Failed to copy');
                  }
                }}
                className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs font-medium transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="text-xs text-green-700 pt-2 border-t border-green-200">
              💡 <strong>Import to MetaMask:</strong> Go to MetaMask → NFTs → Import NFT → Paste contract address and token ID
            </div>
          </div>
        ),
        { 
          id: 'minting', 
          duration: 10000,
          style: {
            maxWidth: '400px',
          }
        }
      );
    } catch (error: any) {
      console.error('Mint error:', error);
      
      let errorMessage = 'Failed to mint NFT';
      if (error.message) {
        errorMessage = error.message;
      } else if (error.reason) {
        errorMessage = error.reason;
      }
      
      toast.error(errorMessage, { id: 'minting', duration: 5000 });
    } finally {
      setMinting(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Arc Collection</h2>
        <p className="text-gray-500 text-center">Please connect your wallet to mint NFTs</p>
      </div>
    );
  }

  if (chainId !== ARC_TESTNET.chainId) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Arc Collection</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            Please switch to <strong>{ARC_TESTNET.chainName}</strong> (Chain ID: {ARC_TESTNET.chainId}) to mint NFTs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Arc Collection</h2>
        <p className="text-gray-600">
          Escolha uma das artes oficiais da Arc e mint seu NFT na Arc Testnet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ARC_COLLECTION.map((item) => (
          <div
            key={item.id}
            className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-primary-400 transition-colors"
          >
            {/* Image */}
            <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image doesn't exist
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-gray-400">Image not found</div>`;
                  }
                }}
              />
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{item.description}</p>
              
              <button
                onClick={() => handleMint(item)}
                disabled={minting === item.id || minting !== null}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {minting === item.id ? 'Minting...' : 'Mintar este NFT'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {ARC_COLLECTION.some(item => item.tokenURI.includes('YOUR-HOSTED-URL') || item.tokenURI.includes('TODO')) && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm">
            ⚠️ <strong>Note:</strong> Some tokenURIs are not configured. Please update{' '}
            <code className="bg-yellow-100 px-1 rounded">frontend/src/config/arcCollection.ts</code> with actual metadata URLs.
          </p>
        </div>
      )}
    </div>
  );
}












