/**
 * Create USDC/EURC pool with 0.05% fee and initialize at 1:1 price.
 * Requires: deployV3Core + deployV3Periphery
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import hre from 'hardhat'

const DEPLOYMENTS_PATH = resolve(__dirname, '../../src/config/deployments.arc-testnet.json')

// Fee tier 0.05% = 500
const FEE_500 = 500

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  if (!existsSync(DEPLOYMENTS_PATH)) throw new Error('deployments not found')
  const data = JSON.parse(readFileSync(DEPLOYMENTS_PATH, 'utf-8'))
  const factoryAddr = data.v3?.factory
  const usdc = data.tokens?.USDC?.address ?? '0x3600000000000000000000000000000000000000'
  const eurc = data.tokens?.EURC?.address ?? '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'
  if (!factoryAddr) throw new Error('V3 factory not deployed')

  const factoryAbi = [
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
    'function createPool(address tokenA, address tokenB, uint24 fee) returns (address pool)',
  ]
  const poolAbi = [
    'function initialize(uint160 sqrtPriceX96)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked)',
  ]

  const factory = new hre.ethers.Contract(factoryAddr, factoryAbi, deployer)
  let poolAddr = await factory.getPool(usdc, eurc, FEE_500)

  if (poolAddr === hre.ethers.ZeroAddress) {
    console.log('Creating pool USDC/EURC fee 0.05%...')
    const tx = await factory.createPool(usdc, eurc, FEE_500)
    const rec = await tx.wait()
    const ev = rec?.logs?.find((l: { topics: string[] }) =>
      l.topics[0] === hre.ethers.id('PoolCreated(address,address,uint24,int24,address)')
    )
    poolAddr = ev ? '0x' + ev.topics[3]?.slice(-40) : (await factory.getPool(usdc, eurc, FEE_500))
    console.log('Pool created:', poolAddr)
  } else {
    console.log('Pool already exists:', poolAddr)
  }

  const pool = new hre.ethers.Contract(poolAddr, poolAbi, deployer)
  const slot0 = await pool.slot0()
  if (slot0.sqrtPriceX96 === 0n) {
    // 1:1 for 6 decimals each: sqrt(1e6/1e6) = 1, so sqrtPriceX96 = 1 << 96
    const sqrtPriceX96 = 1n << 96n
    console.log('Initializing pool at 1:1...')
    await (await pool.initialize(sqrtPriceX96)).wait()
    console.log('Pool initialized')
  } else {
    console.log('Pool already initialized, sqrtPriceX96:', slot0.sqrtPriceX96.toString())
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
