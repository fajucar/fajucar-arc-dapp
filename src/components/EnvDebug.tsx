import { CONTRACT_ADDRESSES } from '../config/contracts';

export function EnvDebug() {
  // Only show in development
  if (import.meta.env.PROD) return null;

  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4 text-xs font-mono">
      <h3 className="font-bold mb-2">🔍 Debug: Environment Variables</h3>
      <div className="space-y-1">
        <div>
          <span className="text-gray-600">VITE_MOCK_USDC_ADDRESS:</span>{' '}
          <span className={import.meta.env.VITE_MOCK_USDC_ADDRESS ? 'text-green-600' : 'text-red-600'}>
            {import.meta.env.VITE_MOCK_USDC_ADDRESS || 'NOT DEFINED'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">VITE_GIFT_CARD_NFT_ADDRESS:</span>{' '}
          <span className={import.meta.env.VITE_GIFT_CARD_NFT_ADDRESS ? 'text-green-600' : 'text-red-600'}>
            {import.meta.env.VITE_GIFT_CARD_NFT_ADDRESS || 'NOT DEFINED'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">VITE_GIFT_CARD_MINTER_ADDRESS:</span>{' '}
          <span className={import.meta.env.VITE_GIFT_CARD_MINTER_ADDRESS ? 'text-green-600' : 'text-red-600'}>
            {import.meta.env.VITE_GIFT_CARD_MINTER_ADDRESS || 'NOT DEFINED'}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-300">
        <h4 className="font-bold mb-1">📋 Parsed Addresses:</h4>
        <div className="space-y-1">
          <div>
            MOCK_USDC: <span className={CONTRACT_ADDRESSES.MOCK_USDC ? 'text-green-600' : 'text-red-600'}>
              {CONTRACT_ADDRESSES.MOCK_USDC || 'EMPTY'}
            </span>
          </div>
          <div>
            GIFT_CARD_NFT: <span className={CONTRACT_ADDRESSES.GIFT_CARD_NFT ? 'text-green-600' : 'text-red-600'}>
              {CONTRACT_ADDRESSES.GIFT_CARD_NFT || 'EMPTY'}
            </span>
          </div>
          <div>
            GIFT_CARD_MINTER: <span className={CONTRACT_ADDRESSES.GIFT_CARD_MINTER ? 'text-green-600' : 'text-red-600'}>
              {CONTRACT_ADDRESSES.GIFT_CARD_MINTER || 'EMPTY'}
            </span>
          </div>
        </div>
      </div>
      {(!CONTRACT_ADDRESSES.MOCK_USDC || !CONTRACT_ADDRESSES.GIFT_CARD_NFT || !CONTRACT_ADDRESSES.GIFT_CARD_MINTER) && (
        <div className="mt-3 pt-3 border-t border-red-300 bg-red-50 p-2 rounded">
          <p className="text-red-800 font-semibold text-sm mb-2">⚠️ Variables not loaded!</p>
          <div className="text-red-700 text-xs space-y-2">
            <p className="font-semibold">Solution:</p>
            <ol className="list-decimal list-inside ml-2 space-y-1">
              <li>In the terminal where the server is running, press <strong>Ctrl+C</strong> to stop</li>
              <li>Run: <code className="bg-red-100 px-1 rounded">cd frontend && npm run fix:env</code></li>
              <li>Then run: <code className="bg-red-100 px-1 rounded">npm run dev</code></li>
              <li>Reload this page (F5)</li>
            </ol>
            <p className="mt-2 text-xs italic">
              ⚠️ Vite only loads environment variables when the server is STARTED. 
              If you created/modified the .env file while the server was running, you need to restart!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

