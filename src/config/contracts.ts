import { getAddress } from 'ethers';

// Contract addresses - Update these after deployment
// Debug: Log environment variables (remove in production)
if (import.meta.env.DEV) {
  console.log('🔍 [contracts.ts] Environment Variables:');
  console.log('  VITE_MOCK_USDC_ADDRESS:', import.meta.env.VITE_MOCK_USDC_ADDRESS || 'UNDEFINED');
  console.log('  VITE_GIFT_CARD_NFT_ADDRESS:', import.meta.env.VITE_GIFT_CARD_NFT_ADDRESS || 'UNDEFINED');
  console.log('  VITE_GIFT_CARD_MINTER_ADDRESS:', import.meta.env.VITE_GIFT_CARD_MINTER_ADDRESS || 'UNDEFINED');
}

// Helper function to get address with correct checksum
function getChecksumAddress(address: string): string {
  if (!address || address === '') return '';
  try {
    // Convert to lowercase first, then getAddress will apply proper checksum
    const normalized = address.toLowerCase();
    return getAddress(normalized); // This converts to EIP-55 checksum format
  } catch (error) {
    console.error(`Invalid address format: ${address}`, error);
    // Try to fix common issues
    try {
      // Remove any whitespace and try again
      const cleaned = address.trim();
      return getAddress(cleaned.toLowerCase());
    } catch (e) {
      console.error(`Could not fix address: ${address}`, e);
      return address; // Return as-is if invalid (will be caught by validation later)
    }
  }
}

export const CONTRACT_ADDRESSES = {
  // Update these with your deployed contract addresses
  // Using getAddress() to ensure proper EIP-55 checksum format
  // Note: MOCK_USDC is no longer used in v2 (image NFT minter)
  MOCK_USDC: getChecksumAddress(import.meta.env.VITE_MOCK_USDC_ADDRESS || ''),
  GIFT_CARD_NFT: getChecksumAddress(import.meta.env.VITE_GIFT_CARD_NFT_ADDRESS || ''),
  GIFT_CARD_MINTER: getChecksumAddress(import.meta.env.VITE_GIFT_CARD_MINTER_ADDRESS || ''),
};

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
