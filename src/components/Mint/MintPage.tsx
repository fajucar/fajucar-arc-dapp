import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { decodeEventLog } from "viem";
import toast from "react-hot-toast";

import { FAJUCAR_COLLECTION_ADDRESS } from "../../config/contracts";
import ArcNftAbi from "../../abis/FajuARC.json";

const FIXED_TOKEN_URI =
  "ipfs://bafkreicisecsndv777lv3hfafh3kfgvxf25al2mf7rifrqbdbbjqvcrs6u";

const TRANSFER_EVENT_ABI = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "tokenId", type: "uint256", indexed: true },
  ],
} as const;

function extractTokenIdFromReceipt(
  receipt: { status: string; logs: { address: string; topics: `0x${string}`[]; data: `0x${string}` }[] },
  nftContractAddress: string,
  ownerAddress: string
): string | null {
  if (receipt.status !== "success" || !receipt.logs?.length) return null;
  const nftAddressLower = nftContractAddress.toLowerCase();
  const ownerLower = ownerAddress.toLowerCase();
  for (const log of receipt.logs) {
    if (log.address?.toLowerCase() !== nftAddressLower) continue;
    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT_ABI],
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        strict: false,
      });
      if (decoded.eventName === "Transfer" && decoded.args) {
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

export function MintPage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isMinting, setIsMinting] = useState(false);
  const [message, setMessage] = useState("");
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [lastTxStatus, setLastTxStatus] = useState<"pending" | "success" | "error">("pending");

  async function handleMint() {
    if (!isConnected || !address) {
      setMessage("Conecte sua carteira.");
      return;
    }
    if (!walletClient || !publicClient) {
      setMessage("Carteira não pronta.");
      return;
    }
    const contractAddress = FAJUCAR_COLLECTION_ADDRESS;
    if (!contractAddress) {
      setMessage("Contrato não configurado.");
      return;
    }

    setIsMinting(true);
    setMessage("Mintando...");

    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: ArcNftAbi as never,
        functionName: "mintImageNFT",
        args: [FIXED_TOKEN_URI],
      });
      const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
      setLastTxHash(shortHash);
      setLastTxStatus("pending");
      setMessage("Tx enviada. Aguardando confirmação...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        setLastTxStatus("success");
        const tokenId = extractTokenIdFromReceipt(
          receipt as { status: string; logs: { address: string; topics: `0x${string}`[]; data: `0x${string}` }[] },
          contractAddress,
          address
        );
        toast.success("Mint confirmado! Abrindo My NFTs…");
        const params = new URLSearchParams({ owner: address });
        if (tokenId) params.set("highlight", tokenId);
        navigate(`/my-nfts?${params.toString()}`);
      } else {
        setLastTxStatus("error");
        setMessage("Transação falhou.");
        toast.error("Transação falhou.");
      }
    } catch (e) {
      setLastTxStatus("error");
      const msg = e instanceof Error ? e.message : String(e);
      setMessage(`Erro: ${msg}`);
      toast.error(msg);
    } finally {
      setIsMinting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h1 className="text-4xl font-bold">Mint</h1>
      <p className="text-white/60 mt-1">
        {address ? `Wallet: ${address.slice(0, 6)}...${address.slice(-4)}` : "Conecte sua carteira"}
      </p>

      <div className="mt-6">
        <button
          type="button"
          onClick={handleMint}
          disabled={isMinting || !isConnected}
          className="px-5 py-3 rounded-xl bg-cyan-500/30 hover:bg-cyan-500/40 disabled:opacity-60"
        >
          Mint agora
        </button>
      </div>

      {lastTxHash && (
        <p className="mt-2 text-xs text-white/60">
          Tx: {lastTxHash} | Status: {lastTxStatus}
        </p>
      )}

      {message && (
        <div className="mt-4 text-sm text-white/80 whitespace-pre-wrap">
          {message}
        </div>
      )}
    </div>
  );
}
