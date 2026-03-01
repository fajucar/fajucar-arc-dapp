/**
 * Wrapper to pass token pair (USDC FAJU) to createPoolV3Pair without Hardhat rejecting args.
 * Usage: node scripts/runCreatePoolV3.cjs [TOKEN_A] [TOKEN_B]
 * Example: node scripts/runCreatePoolV3.cjs USDC FAJU
 * Or: npm run create:pool:v3 -- USDC FAJU
 */
const { spawnSync } = require('child_process')
const path = require('path')

const tokenA = process.argv[2] || process.env.TOKEN_A || 'USDC'
const tokenB = process.argv[3] || process.env.TOKEN_B || 'FAJU'

process.env.TOKEN_A = tokenA
process.env.TOKEN_B = tokenB

const result = spawnSync('npx', ['hardhat', 'run', 'scripts/createPoolV3Pair.cjs', '--network', 'arcTestnet'], {
  stdio: 'inherit',
  env: process.env,
  cwd: path.join(__dirname, '..'),
  shell: true,
})

process.exit(result.status ?? 1)
