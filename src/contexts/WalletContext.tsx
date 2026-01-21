import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { connectWallet, getWalletState, disconnectWallet, WalletState, detectWalletProviders } from '../utils/wallet';

interface WalletContextType extends WalletState {
  connect: (walletName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  availableWallets: ReturnType<typeof detectWalletProviders>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    provider: null,
    isConnected: false,
    chainId: null,
  });

  const availableWallets = detectWalletProviders();

  const connect = async (walletName?: string) => {
    try {
      const walletState = await connectWallet(walletName);
      setState(walletState);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };

  const disconnect = async () => {
    await disconnectWallet();
    setState({
      address: null,
      provider: null,
      isConnected: false,
      chainId: null,
    });
  };

  const refresh = useCallback(async () => {
    const walletState = await getWalletState();
    setState(walletState);
  }, []);

  useEffect(() => {
    // Check wallet state on mount
    refresh();

    // Listen for account changes
    // Try to get MetaMask provider, fallback to window.ethereum
    let ethereum: any = null;
    if (typeof window.ethereum !== 'undefined') {
      if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
        ethereum = window.ethereum.providers.find((p: any) => p.isMetaMask === true) || window.ethereum;
      } else {
        ethereum = window.ethereum;
      }
    }

    if (ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setState({
            address: null,
            provider: null,
            isConnected: false,
            chainId: null,
          });
        } else {
          refresh();
        }
      };

      const handleChainChanged = () => {
        refresh();
      };

      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);

      return () => {
        ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [refresh]);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        refresh,
        availableWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
