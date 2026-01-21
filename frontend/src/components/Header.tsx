import React, { useState, useEffect } from 'react';
import { Wallet, Globe, Zap, Twitter, LogOut, ChevronDown } from 'lucide-react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { ARC_TESTNET_CHAIN_ID } from '../constants';
import { WalletModal } from './Web3/WalletModal';

// Helper to normalize and compare chainIds safely (handles hex strings, BigInt, numbers)
const normalizeChainId = (chainId: string | number | bigint | null | undefined): number | null => {
  if (chainId === null || chainId === undefined) return null;
  if (typeof chainId === 'bigint') return Number(chainId);
  if (typeof chainId === 'string') {
    // Handle hex string like "0x4d0a02" or "0x200"
    if (chainId.startsWith('0x')) {
      return parseInt(chainId, 16);
    }
    return parseInt(chainId, 10);
  }
  return Number(chainId);
};

const Header: React.FC = () => {
  const { address, isConnected, chainId } = useAccount();
  const { isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  
  // Normalize chainId properly (handle all formats)
  const normalizedChainId = normalizeChainId(chainId);
  const isCorrectNetwork = normalizedChainId === ARC_TESTNET_CHAIN_ID;
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  // Debug: Log network state
  useEffect(() => {
    if (isConnected) {
      console.log('[Header] Network state:', {
        rawChainId: chainId,
        normalizedChainId,
        expected: ARC_TESTNET_CHAIN_ID,
        isCorrect: isCorrectNetwork
      });
    }
  }, [chainId, normalizedChainId, isCorrectNetwork, isConnected]);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const handleSwitchNetwork = () => {
    if (switchChain) {
      switchChain({ chainId: ARC_TESTNET_CHAIN_ID });
    }
    setShowDropdown(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-slate-900/80 border-b border-cyan-500/20 shadow-sm supports-[backdrop-filter]:bg-slate-900/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-3 group cursor-default">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center shadow-[0_4px_15px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-transform duration-300">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">
              Arc<span className="text-cyan-400">Minter</span>
            </h1>
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Testnet Access</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          
          {/* Social */}
          <a 
            href="https://x.com/Fajucar_xyz" 
            target="_blank" 
            rel="noreferrer"
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-cyan-400 transition-all text-sm font-medium border border-slate-700"
          >
            <Twitter className="w-4 h-4" />
            <span>@Fajucar_xyz</span>
          </a>

          {/* Network Indicator */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            isCorrectNetwork 
              ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300' 
              : 'bg-amber-900/30 border-amber-500/30 text-amber-300'
          }`}>
             <Globe className="w-3 h-3" />
             <span>{isCorrectNetwork ? 'Arc Testnet' : 'Wrong Network'}</span>
          </div>

          {/* Connect Button / Wallet Dropdown */}
          {isConnected ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg bg-slate-800/60 border border-cyan-500/30 text-white hover:bg-slate-700/60"
              >
                <Wallet className="w-4 h-4" />
                <span>{formatAddress(address!)}</span>
                {!isCorrectNetwork && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 glass-panel border border-cyan-500/30 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="text-xs text-slate-400 mb-1">Connected as</p>
                      <p className="text-sm font-mono text-white break-all">{address}</p>
                      {chainId && (
                        <p className="text-xs text-slate-400 mt-1">
                          Chain ID: {chainId} {chainId === ARC_TESTNET_CHAIN_ID ? '✓' : '✗'}
                        </p>
                      )}
                    </div>
                    {!isCorrectNetwork && (
                      <button
                        onClick={handleSwitchNetwork}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-cyan-400 hover:bg-cyan-500/10 transition-colors border-b border-slate-700"
                      >
                        <Globe className="w-4 h-4" />
                        Switch to Arc Testnet
                      </button>
                    )}
                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect Wallet
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[Header] Connect Wallet button clicked');
                  setShowWalletModal(true);
                }}
                disabled={isConnecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg bg-slate-900 text-white hover:bg-slate-800 hover:shadow-cyan-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wallet className="w-4 h-4 text-cyan-400" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
              <WalletModal 
                isOpen={showWalletModal} 
                onClose={() => setShowWalletModal(false)} 
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
