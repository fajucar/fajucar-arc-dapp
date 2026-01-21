const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Template do arquivo .env
const envTemplate = `# Contract addresses - Update these after local deployment
# Run: npm run deploy:local (in the root directory) and copy the addresses here
VITE_MOCK_USDC_ADDRESS=
VITE_GIFT_CARD_NFT_ADDRESS=
VITE_GIFT_CARD_MINTER_ADDRESS=
`;

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Arquivo .env criado em frontend/.env');
  console.log('📝 Agora você precisa:');
  console.log('   1. Executar: npm run deploy:local (na raiz do projeto)');
  console.log('   2. Copiar os endereços para o arquivo .env');
} else {
  console.log('⚠️  Arquivo .env já existe em frontend/.env');
}

