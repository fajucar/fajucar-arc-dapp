/**
 * Wallet Provider Selection
 * Handles multiple wallet extensions (MetaMask, Rabby, etc.)
 */

export interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (...args: any[]) => void) => void;
  removeListener: (event: string, handler: (...args: any[]) => void) => void;
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isTrust?: boolean;
}

/**
 * Pick the best available wallet provider
 * Priority: MetaMask > Rabby > First available
 */
export function pickProvider(): EthereumProvider | null {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }

  // If multiple providers exist (EIP-6963)
  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    const providers = window.ethereum.providers;
    
    // Prefer MetaMask
    const metaMask = providers.find((p: any) => p.isMetaMask);
    if (metaMask) {
      console.log('[Provider] ✅ Selected MetaMask');
      return metaMask;
    }
    
    // Then Rabby
    const rabby = providers.find((p: any) => p.isRabby);
    if (rabby) {
      console.log('[Provider] ✅ Selected Rabby');
      return rabby;
    }
    
    // Fallback to first provider
    console.log('[Provider] ✅ Selected first available provider');
    return providers[0];
  }
  
  // Single provider
  console.log('[Provider] ✅ Using single provider');
  return window.ethereum as EthereumProvider;
}

/**
 * Get all available providers
 */
export function getAllProviders(): EthereumProvider[] {
  if (typeof window === 'undefined' || !window.ethereum) {
    return [];
  }

  if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
    return window.ethereum.providers;
  }

  return [window.ethereum as EthereumProvider];
}

/**
 * Get provider name
 */
export function getProviderName(provider: EthereumProvider): string {
  if (provider.isMetaMask) return 'MetaMask';
  if (provider.isRabby) return 'Rabby';
  if (provider.isCoinbaseWallet) return 'Coinbase Wallet';
  if (provider.isBraveWallet) return 'Brave Wallet';
  return 'Ethereum Wallet';
}

// Extend Window interface
declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

