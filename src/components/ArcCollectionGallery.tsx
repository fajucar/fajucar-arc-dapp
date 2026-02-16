import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi';
import { getAddress } from 'viem';
import { decodeEventLog } from 'viem';
import { ARC_COLLECTION } from '../config/arcCollection';
import { ARC_TESTNET, FAJUCAR_COLLECTION_ADDRESS } from '../config/contracts';
import { CONSTANTS } from '../config/constants';
import FajucarCollectionAbi from '../abis/FajucarCollection.json';
import toast from 'react-hot-toast';

// FajucarCollection: mintById(modelId). modelId 1=Arc Explorer, 2=Arc Guardian, 3=Arc Builder.

const TRANSFER_EVENT_ABI = {
  type: 'event' as const,
  name: 'Transfer' as const,
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ],
};

function isValidContractAddress(value: string | undefined): value is `0x${string}` {
  if (!value || typeof value !== 'string') return false;
  const s = value.trim();
  return s.startsWith('0x') && s.length === 42;
}

function extractTokenIdFromReceipt(
  receipt: { status: string; logs: { address: string; topics: `0x${string}`[]; data: `0x${string}` }[] },
  nftContractAddress: string,
  ownerAddress: string
): string | null {
  if (receipt.status !== 'success' || !receipt.logs?.length) return null;
  const nftLower = nftContractAddress.toLowerCase();
  const ownerLower = ownerAddress.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address?.toLowerCase() !== nftLower) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT_ABI],
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        strict: false,
      });
      if (decoded.eventName === 'Transfer' && decoded.args) {
        const to = (decoded.args as { to?: string }).to;
        if (to?.toLowerCase() === ownerLower) {
          const tokenId = (decoded.args as { tokenId?: bigint }).tokenId;
          if (tokenId !== undefined) return tokenId.toString();
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

type NFTCardProps = {
  item: typeof ARC_COLLECTION[0];
  index: number;
  onMint: (item: typeof ARC_COLLECTION[0]) => void;
  minting: number | null;
  hasCollection: boolean;
  contractError: boolean;
};

function NFTCard({ item, index, onMint, minting, hasCollection, contractError }: NFTCardProps) {
  const isDisabled = !hasCollection || contractError || minting === item.id || minting !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.08 }}
      className="group relative rounded-2xl border border-slate-700/50 bg-slate-900/50 overflow-hidden
        hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.15)] 
        transition-all duration-300 ease-in-out hover:-translate-y-2 hover:scale-[1.02]"
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

      <div className="aspect-square bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden relative">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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

      <div className="p-4 relative">
        <h3 className="text-lg font-semibold mb-2 text-white">{item.name}</h3>
        <p className="text-sm text-slate-400 mb-4 line-clamp-2">{item.description}</p>

        <motion.button
          onClick={() => onMint(item)}
          disabled={isDisabled}
          whileHover={!isDisabled ? { scale: 1.02 } : {}}
          whileTap={!isDisabled ? { scale: 0.98 } : {}}
          className={`relative w-full px-4 py-3 rounded-xl font-semibold overflow-hidden transition-all duration-300 group/btn
            ${isDisabled
              ? 'bg-slate-700/60 text-slate-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)]'
            } ${isDisabled ? 'animate-pulse' : ''}`}
        >
          {!isDisabled && (
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 pointer-events-none" />
          )}
          {minting === item.id ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Minting...
            </span>
          ) : (
            'Mint this NFT'
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

export function ArcCollectionGallery() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [minting, setMinting] = useState<number | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastContract, setLastContract] = useState<string | null>(null);
  const [lastType, setLastType] = useState<string | null>(null);
  const [lastMintTokenId, setLastMintTokenId] = useState<string | null>(null);
  const [lastMintError, setLastMintError] = useState<string | null>(null);
  const [lastTxStatus, setLastTxStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');

  const contractAddress = FAJUCAR_COLLECTION_ADDRESS;
  const hasCollection = Boolean(
    contractAddress && contractAddress.trim() &&
    contractAddress.startsWith('0x') && contractAddress.trim().length === 42
  );
  const contractError = hasCollection
    ? null
    : 'Collection contract not configured in production.';

  const handleMint = async (item: typeof ARC_COLLECTION[0]) => {
    if (!address || !isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (chainId !== ARC_TESTNET.chainId) {
      toast.error(`Please switch to ${ARC_TESTNET.chainName} (Chain ID: ${ARC_TESTNET.chainId})`);
      return;
    }

    if (!walletClient || !publicClient) {
      toast.error('Wallet not ready.');
      return;
    }

    if (!hasCollection || !isValidContractAddress(contractAddress)) {
      setLastTxStatus('failed');
      setLastMintError(contractError ?? 'Invalid contract address.');
      toast.error(contractError ?? 'Invalid contract address.');
      return;
    }

    const nftContractAddress = getAddress(contractAddress);

    const modelId = item.id;
    if (modelId !== 1 && modelId !== 2 && modelId !== 3) {
      toast.error('Invalid model. Use Arc Explorer (1), Guardian (2), or Builder (3).');
      return;
    }

    setMinting(item.id);
    setLastMintError(null);
    setLastTxStatus('pending');
    setLastMintTokenId(null);
    setLastTxHash(null);

    try {
      toast.loading(`Minting ${item.name}...`, { id: 'minting' });

      // Simulate to get revert reason (e.g. MODEL_DISABLED, URI_NOT_SET) without sending tx
      try {
        await publicClient.simulateContract({
          address: nftContractAddress,
          abi: FajucarCollectionAbi as never,
          functionName: 'mintById',
          args: [BigInt(modelId)],
          account: address,
        });
      } catch (simError: unknown) {
        setLastTxStatus('failed');
        let msg = 'Transaction would revert.';
        if (simError && typeof simError === 'object') {
          const e = simError as { shortMessage?: string; message?: string };
          msg = (e.shortMessage ?? e.message ?? msg) as string;
        } else if (simError instanceof Error) msg = simError.message;
        setLastMintError(msg);
        toast.error(msg, { id: 'minting', duration: 6000 });
        setMinting(null);
        return;
      }

      const hash = await walletClient.writeContract({
        address: nftContractAddress,
        abi: FajucarCollectionAbi as never,
        functionName: 'mintById',
        args: [BigInt(modelId)],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== 'success') {
        setLastTxHash(hash);
        setLastTxStatus('failed');
        const errMsg = 'Transaction reverted on-chain (e.g. MODEL_DISABLED or URI_NOT_SET).';
        setLastMintError(errMsg);
        toast.error(errMsg, { id: 'minting', duration: 5000 });
        setMinting(null);
        return;
      }

      const tokenId = extractTokenIdFromReceipt(
        receipt as { status: string; logs: { address: string; topics: `0x${string}`[]; data: `0x${string}` }[] },
        nftContractAddress,
        address
      );

      setLastTxHash(hash);
      setLastContract(nftContractAddress);
      setLastType(item.name);
      setLastMintTokenId(tokenId);
      setLastTxStatus('success');
      toast.success(tokenId ? `Minted ${item.name}! Token #${tokenId}` : `Minted ${item.name}!`, { id: 'minting' });
    } catch (error: unknown) {
      setLastTxStatus('failed');
      let message = 'Failed to mint NFT';
      if (typeof error === 'object' && error !== null && 'shortMessage' in error) {
        message = String((error as { shortMessage: string }).shortMessage);
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }
      if (message.toLowerCase().includes('rejected') || message.toLowerCase().includes('denied')) {
        message = 'Transaction rejected by user.';
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
    <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 backdrop-blur-xl p-6 shadow-[0_0_30px_rgba(34,211,238,0.05)]">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2 text-white">Mint Your Arc NFTs</h2>
        <p className="text-slate-400">
          Choose one of Arc&apos;s official artworks and mint your NFT on Arc Testnet.
        </p>
      </div>

      {contractError && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-amber-200 text-sm font-medium mb-1">Collection contract not configured</p>
          <p className="text-amber-200/90 text-sm">{contractError}</p>
          <p className="text-slate-400 text-xs mt-2">
            Set VITE_FAJUCAR_COLLECTION_ADDRESS in your deployment environment (e.g. Vercel) to enable minting.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ARC_COLLECTION.slice(0, 3).map((item, index) => (
          <NFTCard key={item.id} item={item} index={index} onMint={handleMint} minting={minting} hasCollection={hasCollection} contractError={!!contractError} />
        ))}
      </div>

      {lastTxHash && lastTxStatus === 'success' && (
        <div className="mt-6 rounded-xl border border-cyan-500/30 bg-slate-800/50 p-4">
          <p className="text-slate-300 text-sm mb-2">
            Mint submitted: <span className="font-mono text-cyan-300">{lastType ?? 'NFT'}</span> — {lastTxHash.slice(0, 6)}...{lastTxHash.slice(-4)}
          </p>
          {lastMintTokenId && (
            <p className="text-slate-300 text-sm mb-2">
              Token ID: <span className="font-mono text-cyan-300">#{lastMintTokenId}</span>
            </p>
          )}
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
              NFT Contract: {lastContract.slice(0, 6)}...{lastContract.slice(-4)}
            </p>
          )}
        </div>
      )}

      {lastTxStatus === 'failed' && lastMintError && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-slate-800/50 p-4">
          <p className="text-slate-300 text-sm font-medium mb-1">Last mint result: failed</p>
          <p className="text-slate-300 text-sm break-words">{lastMintError}</p>
          {lastTxHash && (
            <a
              href={`${CONSTANTS.LINKS.explorer}/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 mt-2"
            >
              View failed tx on Explorer
            </a>
          )}
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
