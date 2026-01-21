import { CONTRACT_ADDRESSES } from '../config/contracts';

export function ConfigError() {
  const missingAddresses = [];
  
  if (!CONTRACT_ADDRESSES.MOCK_USDC || CONTRACT_ADDRESSES.MOCK_USDC === '') {
    missingAddresses.push('VITE_MOCK_USDC_ADDRESS');
  }
  if (!CONTRACT_ADDRESSES.GIFT_CARD_NFT || CONTRACT_ADDRESSES.GIFT_CARD_NFT === '') {
    missingAddresses.push('VITE_GIFT_CARD_NFT_ADDRESS');
  }
  if (!CONTRACT_ADDRESSES.GIFT_CARD_MINTER || CONTRACT_ADDRESSES.GIFT_CARD_MINTER === '') {
    missingAddresses.push('VITE_GIFT_CARD_MINTER_ADDRESS');
  }

  if (missingAddresses.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Configuração necessária
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p className="font-semibold mb-2">Os endereços dos contratos não estão configurados ou o servidor precisa ser reiniciado.</p>
            <ol className="list-decimal list-inside mt-2 space-y-2">
              <li>
                <span className="font-semibold">Se o arquivo .env não existe:</span>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>Execute: <code className="bg-yellow-100 px-1 rounded">npm run deploy:mock</code> para fazer deploy dos contratos</li>
                  <li>Crie o arquivo <code className="bg-yellow-100 px-1 rounded">frontend/.env</code> com os endereços:</li>
                </ul>
                <pre className="mt-2 bg-yellow-100 p-2 rounded text-xs overflow-x-auto">
{`VITE_MOCK_USDC_ADDRESS=0x...
VITE_GIFT_CARD_NFT_ADDRESS=0x...
VITE_GIFT_CARD_MINTER_ADDRESS=0x...`}
                </pre>
              </li>
              <li>
                <span className="font-semibold">Se o arquivo .env já existe:</span>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li><strong>Pare o servidor Vite (Ctrl+C no terminal)</strong></li>
                  <li><strong>Reinicie com: <code className="bg-yellow-100 px-1 rounded">npm run dev</code></strong></li>
                  <li>O Vite só carrega variáveis de ambiente quando o servidor é iniciado!</li>
                </ul>
              </li>
            </ol>
            <p className="mt-3 font-semibold">Faltando: {missingAddresses.join(', ')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}



