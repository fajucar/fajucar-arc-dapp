/**
 * Script de teste para verificar a implementação
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TESTANDO IMPLEMENTAÇÃO DA LANDING PAGE ARC NETWORK\n');

const tests = [];
let passed = 0;
let failed = 0;

// Função helper para testar arquivos
function testFile(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    console.log(`✅ ${description}`);
    passed++;
    return true;
  } else {
    console.log(`❌ ${description} - Arquivo não encontrado: ${filePath}`);
    failed++;
    return false;
  }
}

// Função helper para testar conteúdo de arquivo
function testFileContent(filePath, searchString, description) {
  const fullPath = path.join(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${description} - Arquivo não existe`);
    failed++;
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  if (content.includes(searchString)) {
    console.log(`✅ ${description}`);
    passed++;
    return true;
  } else {
    console.log(`❌ ${description} - Conteúdo não encontrado: ${searchString}`);
    failed++;
    return false;
  }
}

console.log('📁 TESTANDO ESTRUTURA DE PASTAS:\n');

// Testar estrutura de pastas
testFile('src/config/chains.ts', 'Configuração de chains (chains.ts)');
testFile('src/config/wagmi.ts', 'Configuração Wagmi (wagmi.ts)');
testFile('src/config/constants.ts', 'Constantes (constants.ts)');

testFile('src/components/Web3/ConnectButton.tsx', 'ConnectButton component');
testFile('src/components/Web3/WalletModal.tsx', 'WalletModal component');
testFile('src/components/Web3/NetworkSwitcher.tsx', 'NetworkSwitcher component');

testFile('src/components/Hero/Hero.tsx', 'Hero component');
testFile('src/components/Hero/GlassCard.tsx', 'GlassCard component');

testFile('src/components/Stats/NetworkStats.tsx', 'NetworkStats component');
testFile('src/components/Stats/StatCard.tsx', 'StatCard component');

testFile('src/components/Demo/TransactionDemo.tsx', 'TransactionDemo component');

testFile('src/components/Comparison/WhyArc.tsx', 'WhyArc component');

testFile('src/components/Layout/Header.tsx', 'Header component');
testFile('src/components/Layout/Footer.tsx', 'Footer component');
testFile('src/components/Layout/Layout.tsx', 'Layout component');

testFile('src/hooks/useArcStats.ts', 'useArcStats hook');
testFile('src/hooks/useBlockNumber.ts', 'useBlockNumber hook');
testFile('src/hooks/useGasPrice.ts', 'useGasPrice hook');

testFile('src/lib/utils.ts', 'Utils library');
testFile('src/lib/formatters.ts', 'Formatters library');

console.log('\n📝 TESTANDO CONTEÚDO DOS ARQUIVOS:\n');

// Testar conteúdo crítico
testFileContent('src/config/wagmi.ts', 'target: \'metaMask\'', 'Wagmi config prioriza MetaMask');
testFileContent('src/config/chains.ts', '5042002', 'Arc Testnet chainId configurado');
testFileContent('src/components/Web3/ConnectButton.tsx', 'ConnectButton', 'ConnectButton implementado');
testFileContent('src/components/Web3/WalletModal.tsx', 'WalletModal', 'WalletModal implementado');
testFileContent('src/App.tsx', 'WagmiProvider', 'App.tsx usa WagmiProvider');
testFileContent('src/main.tsx', 'WagmiProvider', 'main.tsx configura WagmiProvider');
testFileContent('src/main.tsx', 'QueryClientProvider', 'React Query configurado');
testFileContent('src/main.tsx', 'HelmetProvider', 'Helmet configurado');
testFileContent('src/App.tsx', 'Hero', 'App.tsx importa Hero');
testFileContent('src/App.tsx', 'NetworkStats', 'App.tsx importa NetworkStats');
testFileContent('src/App.tsx', 'TransactionDemo', 'App.tsx importa TransactionDemo');
testFileContent('src/App.tsx', 'WhyArc', 'App.tsx importa WhyArc');

console.log('\n📦 TESTANDO DEPENDÊNCIAS:\n');

// Verificar package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

const requiredDeps = [
  'wagmi',
  'viem',
  '@tanstack/react-query',
  'framer-motion',
  'react-hot-toast',
  'react-helmet-async',
  'react-countup',
  'clsx',
  'tailwind-merge'
];

requiredDeps.forEach(dep => {
  if (dependencies[dep]) {
    console.log(`✅ ${dep} instalado`);
    passed++;
  } else {
    console.log(`❌ ${dep} NÃO instalado`);
    failed++;
  }
});

console.log('\n📊 RESULTADO FINAL:\n');
console.log(`✅ Passou: ${passed}`);
console.log(`❌ Falhou: ${failed}`);
console.log(`📈 Total: ${passed + failed}`);
console.log(`🎯 Taxa de sucesso: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (failed === 0) {
  console.log('🎉 TODOS OS TESTES PASSARAM! A implementação está completa.\n');
  process.exit(0);
} else {
  console.log('⚠️  Alguns testes falharam. Verifique os erros acima.\n');
  process.exit(1);
}

