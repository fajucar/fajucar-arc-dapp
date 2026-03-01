/**
 * Sanity checks: verify deployed V3 addresses.
 */
const { readFileSync, existsSync } = require('fs')
const { resolve } = require('path')

const getDeploymentsPath = (network) =>
  resolve(__dirname, `../../src/config/deployments.${network === 'arcTestnet' ? 'arc-testnet' : 'hardhat'}.json`)

async function main() {
  const hre = require('hardhat')
  const deploymentsPath = getDeploymentsPath(hre.network.name)
  if (!existsSync(deploymentsPath)) {
    console.error('deployments.arc-testnet.json not found')
    process.exit(1)
  }
  const data = JSON.parse(readFileSync(deploymentsPath, 'utf-8'))
  const v3 = data.v3
  if (!v3) {
    console.error('No v3 section in deployments')
    process.exit(1)
  }

  const provider = hre.ethers.provider
  const checks = [
    ['WETH9', v3.weth9],
    ['Factory', v3.factory],
    ['SwapRouter', v3.swapRouter],
    ['NFTDescriptor', v3.nftDescriptor],
    ['NonfungibleTokenPositionDescriptor', v3.positionDescriptor],
    ['NonfungiblePositionManager', v3.positionManager],
  ]

  console.log('Verifying V3 addresses on', (await provider.getNetwork()).chainId)
  for (const [name, addr] of checks) {
    if (!addr) {
      console.log('  ' + name + ': missing')
      continue
    }
    const code = await provider.getCode(addr)
    const ok = code && code !== '0x'
    console.log('  ' + name + ' (' + addr + '): ' + (ok ? 'OK' : 'NO CODE'))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
