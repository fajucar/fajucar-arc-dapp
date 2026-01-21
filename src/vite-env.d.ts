/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_USDC_ADDRESS: string
  readonly VITE_GIFT_CARD_NFT_ADDRESS: string
  readonly VITE_GIFT_CARD_MINTER_ADDRESS: string
  readonly VITE_ARC_COLLECTION_ADDRESS: string
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
  readonly hot?: {
    accept(): void
    accept(cb: (mod: any) => void): void
    accept(dep: string, cb: (mod: any) => void): void
    accept(deps: string[], cb: (mods: any[]) => void): void
    dispose(cb: (data: any) => void): void
    decline(): void
    invalidate(): void
    on(event: string, cb: (...args: any[]) => void): void
    off(event: string, cb: (...args: any[]) => void): void
    send(event: string, data?: any): void
  }
}
















