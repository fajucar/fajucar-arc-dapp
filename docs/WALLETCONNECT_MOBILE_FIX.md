# WalletConnect Mobile Fix

## Where is the config?

- **Main config:** `src/config/wagmi.ts`
- **Connect UI:** `src/components/Web3/WalletModal.tsx`
- **Provider:** `src/main.tsx` (WagmiProvider)

## Required env vars

| Variable | Description |
|----------|-------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID. Get a free one at [cloud.walletconnect.com](https://cloud.walletconnect.com) → New Project. |

Add to:
- `.env` for local dev
- **Vercel → Settings → Environment Variables** for production

## How it works

- **Desktop:** WalletConnect shows a QR code. User scans with MetaMask/Trust/Rabby mobile app.
- **Mobile:** WalletConnect shows a wallet list with deep links. Tapping opens the wallet app.
- **Fallback (mobile):** "Open in MetaMask" button opens the site in MetaMask's in-app browser (no WalletConnect needed).

## Tech stack

- **wagmi** v3 + **viem** v2
- **walletConnect** connector from `wagmi/connectors` (uses @walletconnect/ethereum-provider v2)
- Chain: Arc Testnet (chainId 5042002)

## Testing

### Desktop

1. Run `npm run dev`
2. Click "Connect Wallet"
3. Choose "WalletConnect" → QR code appears
4. Scan with mobile wallet → should connect

### Android / iOS

**Option A – WalletConnect (requires projectId):**

1. Open fajucar.xyz in Chrome/Safari
2. Tap "Connect Wallet"
3. Tap "WalletConnect" or "MetaMask" (via WalletConnect)
4. App should open; approve connection

**Option B – Open in MetaMask (always works):**

1. Tap "Connect Wallet"
2. Tap the orange "Open in MetaMask" card at top
3. Site opens in MetaMask's browser → connect works

### Debug

- In dev, open console: `[wagmi] WalletConnect projectId configured` means the env var is set.
- If you see `VITE_WALLETCONNECT_PROJECT_ID is empty`, add it to `.env` and Vercel, then rebuild.
