import { getAddress } from 'ethers';

// Contract addresses - Update these after deployment
// Debug: Log environment variables (remove in production)
if (import.meta.env.DEV) {
  console.log('🔍 [contracts.ts] Environment Variables:');
  console.log('  VITE_FAJUCAR_COLLECTION_ADDRESS:', import.meta.env.VITE_FAJUCAR_COLLECTION_ADDRESS || 'UNDEFINED');
}

// Helper function to get address with correct checksum
// NEVER throws - always returns empty string if invalid
function getChecksumAddress(address: string | undefined): string {
  if (!address || typeof address !== 'string' || address.trim() === '') {
    return '';
  }
  try {
    // Convert to lowercase first, then getAddress will apply proper checksum
    const normalized = address.trim().toLowerCase();
    // Validate it looks like an address before calling getAddress
    if (!/^0x[a-f0-9]{40}$/i.test(normalized)) {
      if (import.meta.env.DEV) {
        console.warn(`Invalid address format (not 40 hex chars): ${address}`);
      }
      return '';
    }
    return getAddress(normalized); // This converts to EIP-55 checksum format
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Invalid address format: ${address}`, error);
    }
    // Return empty string instead of throwing
    return '';
  }
}

// Safe access to env vars - never throws
function getEnvVar(key: string): string {
  try {
    const value = import.meta.env[key];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export const CONTRACT_ADDRESSES = {
  // Update these with your deployed contract addresses
  // Using getAddress() to ensure proper EIP-55 checksum format
  // Note: MOCK_USDC is no longer used in v2 (image NFT minter)
  // NEVER throws - returns empty string if env var is missing or invalid
  MOCK_USDC: getChecksumAddress(getEnvVar('VITE_MOCK_USDC_ADDRESS')),
  GIFT_CARD_NFT: getChecksumAddress(getEnvVar('VITE_GIFT_CARD_NFT_ADDRESS')),
  GIFT_CARD_MINTER: getChecksumAddress(getEnvVar('VITE_GIFT_CARD_MINTER_ADDRESS')),
};

// Fajucar Collection - Single contract for all NFT models
// This is the new unified contract address
export const FAJUCAR_COLLECTION_ADDRESS: `0x${string}` | undefined = (() => {
  const addr = getChecksumAddress(getEnvVar('VITE_FAJUCAR_COLLECTION_ADDRESS'));
  if (!addr) {
    if (import.meta.env.DEV) {
      console.error('❌ [contracts.ts] VITE_FAJUCAR_COLLECTION_ADDRESS is not configured!');
      console.error('   Please set VITE_FAJUCAR_COLLECTION_ADDRESS in your .env file');
    }
    return undefined;
  }
  return addr as `0x${string}`;
})();

// Validate FAJUCAR_COLLECTION_ADDRESS on module load (in dev mode)
if (import.meta.env.DEV && !FAJUCAR_COLLECTION_ADDRESS) {
  console.error('❌ [contracts.ts] FAJUCAR_COLLECTION_ADDRESS is undefined!');
  console.error('   Mint functionality will not work until VITE_FAJUCAR_COLLECTION_ADDRESS is set');
}

// Debug: Log parsed addresses
if (import.meta.env.DEV) {
  console.log('📋 [contracts.ts] Parsed Addresses:');
  console.log('  CONTRACT_ADDRESSES:', CONTRACT_ADDRESSES);
}

// Arc Testnet configuration
// Source: https://docs.arc.network/arc/references/connect-to-arc
export const ARC_TESTNET = {
  chainId: 5042002, // Official Chain ID from Arc docs
  chainName: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC', // Arc uses USDC as native gas token (not ETH!)
    symbol: 'USDC',
    decimals: 6, // USDC has 6 decimals (not 18!)
  },
  rpcUrls: [
    'https://rpc.testnet.arc.network', // Primary RPC from official docs
    'https://rpc.blockdaemon.testnet.arc.network', // Alternative 1
    'https://rpc.drpc.testnet.arc.network', // Alternative 2
    'https://rpc.quicknode.testnet.arc.network', // Alternative 3
  ],
  blockExplorerUrls: ['https://testnet.arcscan.app'], // Official explorer
};

// Localhost configuration for local testing
export const LOCALHOST_NETWORK = {
  chainId: 31337,
  chainName: 'Hardhat Local',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: ['http://127.0.0.1:8545'],
  blockExplorerUrls: [],
};

// Note: DEPOSIT_AMOUNT is no longer used in v2 (image NFT minter)
// The new flow mints NFTs directly without requiring USDC deposits
