import { CONTRACT_ADDRESSES } from '../config/contracts';

export function EnvDebug() {
  // Only show in development
  if (import.meta.env.PROD) return null;

  return (
    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4 text-xs font-mono">
      <h3 className="font-bold mb-2">🔍 Debug: Variáveis de Ambiente</h3>
      <div className="space-y-1">
        <div>
          <span className="text-gray-600">VITE_MOCK_USDC_ADDRESS:</span>{' '}
          <span className={import.meta.env.VITE_MOCK_USDC_ADDRESS ? 'text-green-600' : 'text-red-600'}>
            {import.meta.env.VITE_MOCK_USDC_ADDRESS || 'NÃO DEFINIDA'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">VITE_GIFT_CARD_NFT_ADDRESS:</span>{' '}
          <span className={import.meta.env.VITE_GIFT_CARD_NFT_ADDRESS ? 'text-green-600' : 'text-red-600'}>
            {import.meta.env.VITE_GIFT_CARD_NFT_ADDRESS || 'NÃO DEFINIDA'}
          </span>
        </div>
        <div>
          <span className="text-gray-600">VITE_GIFT_CARD_MINTER_ADDRESS:</span>{' '}
          <span className={import.meta.env.VITE_GIFT_CARD_MINTER_ADDRESS ? 'text-green-600' : 'text-red-600'}>
            {import.meta.env.VITE_GIFT_CARD_MINTER_ADDRESS || 'NÃO DEFINIDA'}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-300">
        <h4 className="font-bold mb-1">📋 Endereços Parseados:</h4>
        <div className="space-y-1">
          <div>
            MOCK_USDC: <span className={CONTRACT_ADDRESSES.MOCK_USDC ? 'text-green-600' : 'text-red-600'}>
              {CONTRACT_ADDRESSES.MOCK_USDC || 'VAZIO'}
            </span>
          </div>
          <div>
            GIFT_CARD_NFT: <span className={CONTRACT_ADDRESSES.GIFT_CARD_NFT ? 'text-green-600' : 'text-red-600'}>
              {CONTRACT_ADDRESSES.GIFT_CARD_NFT || 'VAZIO'}
            </span>
          </div>
          <div>
            GIFT_CARD_MINTER: <span className={CONTRACT_ADDRESSES.GIFT_CARD_MINTER ? 'text-green-600' : 'text-red-600'}>
              {CONTRACT_ADDRESSES.GIFT_CARD_MINTER || 'VAZIO'}
            </span>
          </div>
        </div>
      </div>
      {(!CONTRACT_ADDRESSES.MOCK_USDC || !CONTRACT_ADDRESSES.GIFT_CARD_NFT || !CONTRACT_ADDRESSES.GIFT_CARD_MINTER) && (
        <div className="mt-3 pt-3 border-t border-red-300 bg-red-50 p-2 rounded">
          <p className="text-red-800 font-semibold text-sm mb-2">⚠️ Variáveis não carregadas!</p>
          <div className="text-red-700 text-xs space-y-2">
            <p className="font-semibold">Solução:</p>
            <ol className="list-decimal list-inside ml-2 space-y-1">
              <li>No terminal onde o servidor está rodando, pressione <strong>Ctrl+C</strong> para parar</li>
              <li>Execute: <code className="bg-red-100 px-1 rounded">cd frontend && npm run fix:env</code></li>
              <li>Depois execute: <code className="bg-red-100 px-1 rounded">npm run dev</code></li>
              <li>Recarregue esta página (F5)</li>
            </ol>
            <p className="mt-2 text-xs italic">
              ⚠️ O Vite só carrega variáveis de ambiente quando o servidor é INICIADO. 
              Se você criou/modificou o .env com o servidor rodando, precisa reiniciar!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

