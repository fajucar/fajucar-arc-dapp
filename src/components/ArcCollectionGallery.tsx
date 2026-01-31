import { useState } from 'react';
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi';
import { ARC_COLLECTION } from '../config/arcCollection';
import { ARC_TESTNET, FAJUCAR_COLLECTION_ADDRESS } from '../config/contracts';
import { CONSTANTS } from '../config/constants';
import ArcNftAbi from '../abis/FajuARC.json';
import toast from 'react-hot-toast';

export function ArcCollectionGallery() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [minting, setMinting] = useState<number | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastContract, setLastContract] = useState<string | null>(null);
  const [lastType, setLastType] = useState<string | null>(null);
  const [lastMintError, setLastMintError] = useState<string | null>(null);
  const [lastTxStatus, setLastTxStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');

  const handleMint = async (item: typeof ARC_COLLECTION[0]) => {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (chainId !== ARC_TESTNET.chainId) {
      toast.error(`Please switch to ${ARC_TESTNET.chainName} (Chain ID: ${ARC_TESTNET.chainId})`);
      return;
    }

    if (item.tokenURI.includes('YOUR-HOSTED-URL') || item.tokenURI.includes('TODO')) {
      toast.error('TokenURI not configured. Please update arcCollection.ts with actual metadata URLs.');
      return;
    }

    if (!walletClient || !publicClient) {
      toast.error('Wallet not ready.');
      return;
    }

    if (!FAJUCAR_COLLECTION_ADDRESS) {
      toast.error('Contract not configured.');
      return;
    }

    setMinting(item.id);
    setLastMintError(null);
    setLastTxStatus('pending');

    try {
      toast.loading(`Minting ${item.name}...`, { id: 'minting' });

      const hash = await walletClient.writeContract({
        address: (import.meta.env.VITE_GIFT_CARD_MINTER_ADDRESS ?? '') as `0x${string}`,
        abi: ArcNftAbi as never,
        functionName: 'mintImageNFT',
        args: [item.tokenURI],
      });

      await publicClient.waitForTransactionReceipt({ hash });

      setLastTxHash(hash);
      setLastContract(FAJUCAR_COLLECTION_ADDRESS ?? null);
      setLastType(item.name);
      setLastTxStatus('success');
      toast.success(`Minted ${item.name}!`, { id: 'minting' });
    } catch (error: unknown) {
      setLastTxStatus('failed');
      let message = 'Failed to mint NFT';
      if (typeof error === 'object' && error !== null && 'shortMessage' in error) {
        message = String((error as { shortMessage: string }).shortMessage);
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      setLastMintError(message);
      toast.error(message, { id: 'minting', duration: 5000 });
    } finally {
      setMinting(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-xl p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Mint Your Arc NFTs</h2>
        <p className="text-slate-400 text-center">Please connect your wallet to mint NFTs</p>
      </div>
    );
  }

  if (chainId !== ARC_TESTNET.chainId) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-xl p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Mint Your Arc NFTs</h2>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-amber-200 text-sm">
            Please switch to <strong>{ARC_TESTNET.chainName}</strong> (Chain ID: {ARC_TESTNET.chainId}) to mint NFTs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-xl p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-white">Mint Your Arc NFTs</h2>
        <p className="text-slate-400">
          Choose one of Arc&apos;s official artworks and mint your NFT on Arc Testnet.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ARC_COLLECTION.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-700/50 bg-slate-900/50 overflow-hidden hover:border-cyan-500/50 transition-colors"
          >
            {/* Image */}
            <div className="aspect-square bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-slate-500">Image not found</div>`;
                  }
                }}
              />
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2 text-white">{item.name}</h3>
              <p className="text-sm text-slate-400 mb-4 line-clamp-2">{item.description}</p>

              <button
                onClick={() => handleMint(item)}
                disabled={minting === item.id || minting !== null}
                className="w-full px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {minting === item.id ? 'Minting...' : 'Mint this NFT'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {lastTxHash && (
        <div className="mt-6 rounded-xl border border-cyan-500/30 bg-slate-800/50 p-4">
          <p className="text-slate-300 text-sm mb-2">
            Mint submitted: <span className="font-mono text-cyan-300">{lastType ?? 'NFT'}</span> — {lastTxHash.slice(0, 6)}...{lastTxHash.slice(-4)}
          </p>
          <a
            href={`${CONSTANTS.LINKS.explorer}/tx/${lastTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View on Explorer
          </a>
          {lastContract && (
            <p className="text-slate-500 text-xs mt-2">
              Contract: {lastContract.slice(0, 6)}...{lastContract.slice(-4)}
            </p>
          )}
        </div>
      )}

      {lastTxStatus === 'failed' && lastMintError && (
        <div className="mt-6 rounded-xl border border-cyan-500/30 bg-slate-800/50 p-4">
          <p className="text-slate-300 text-sm font-medium mb-1">Last mint result: failed</p>
          <p className="text-slate-300 text-sm break-words">{lastMintError}</p>
        </div>
      )}

      {ARC_COLLECTION.slice(0, 3).some(item => item.tokenURI.includes('YOUR-HOSTED-URL') || item.tokenURI.includes('TODO')) && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-amber-200 text-sm">
            ⚠️ <strong>Note:</strong> Some tokenURIs are not configured. Please update{' '}
            <code className="bg-slate-800 px-1 rounded text-slate-300">frontend/src/config/arcCollection.ts</code> with actual metadata URLs.
          </p>
        </div>
      )}
    </div>
  );
}












