import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = process.cwd()
  const envPath = resolve(envDir, '.env')

  // ✅ Carrega SOMENTE variáveis VITE_
  const env = loadEnv(mode, envDir, 'VITE_')

  // ✅ Debug do arquivo .env (só pra confirmar que existe e está legível)
  if (mode === 'development') {
    console.log('🔍 [vite.config.ts] envDir =', envDir)
    console.log('🔍 [vite.config.ts] envPath =', envPath, 'exists =', existsSync(envPath))

    try {
      readFileSync(envPath, 'utf-8')
      console.log('🔍 [vite.config.ts] Arquivo .env encontrado e lido (utf-8)')
    } catch {
      console.warn('⚠️  [vite.config.ts] Arquivo .env não pôde ser lido como UTF-8')
    }

    console.log('🔍 [vite.config.ts] Variáveis VITE_ carregadas (loadEnv):')
    console.log('  VITE_GIFT_CARD_NFT_ADDRESS:', env.VITE_GIFT_CARD_NFT_ADDRESS || '❌ UNDEFINED')
    console.log('  VITE_GIFT_CARD_MINTER_ADDRESS:', env.VITE_GIFT_CARD_MINTER_ADDRESS || '❌ UNDEFINED')
    console.log('  VITE_MOCK_USDC_ADDRESS:', env.VITE_MOCK_USDC_ADDRESS || '(vazio/undefined — ok)')
  }

  // ✅ Só estas duas são obrigatórias
  const missingRequired =
    !env.VITE_GIFT_CARD_NFT_ADDRESS?.trim() ||
    !env.VITE_GIFT_CARD_MINTER_ADDRESS?.trim()

  if (missingRequired && mode === 'development') {
    console.error('')
    console.error('❌ ERRO: Variáveis obrigatórias não foram carregadas!')
    console.error('   Obrigatórias:')
    console.error('   - VITE_GIFT_CARD_NFT_ADDRESS')
    console.error('   - VITE_GIFT_CARD_MINTER_ADDRESS')
    console.error('')
    console.error('   Confira se o arquivo .env está em:', envPath)
    console.error('   E se você rodou `npm run dev` dentro da pasta frontend.')
    console.error('')
  }

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
    },
    server: {
      port: 3000,
      host: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  }
})
