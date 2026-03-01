/**
 * Sanity checks: verify deployed V3 addresses exist and are correct.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import hre from 'hardhat'

const DEPLOYMENTS_PATH = resolve(__dirname, '../../src/config/deployments.arc-testnet.json')

async function main() {
  if (!existsSync(DEPLOYMENTS_PATH)) {
    console.error('deployments.arc-testnet.json not found')
    process.exit(1)
  }
  const data = JSON.parse(readFileSync(DEPLOYMENTS_PATH, 'utf-8'))
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
  ] as const

  console.log('Verifying V3 addresses on', (await provider.getNetwork()).chainId)
  for (const [name, addr] of checks) {
    if (!addr) {
      console.log(`  ${name}: missing`)
      continue
    }
    const code = await provider.getCode(addr)
    const ok = code && code !== '0x'
    console.log(`  ${name} (${addr}): ${ok ? 'OK' : 'NO CODE'}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
