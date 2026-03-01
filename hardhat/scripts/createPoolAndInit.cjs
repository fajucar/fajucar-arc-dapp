/**
 * Create USDC/EURC pool with 0.05% fee and initialize at 1:1 price.
 * Idempotent: skips create/init if already done.
 */
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { resolve } = require('path')

const getDeploymentsPath = (network) =>
  resolve(__dirname, `../../src/config/deployments.${network === 'arcTestnet' ? 'arc-testnet' : 'hardhat'}.json`)
const FEE_500 = 500

// sqrtPriceX96 for 1:1 (both 6 decimals): sqrt(1) * 2^96 = 2^96
const SQRT_PRICE_1_1 = 1n << 96n

async function main() {
  const hre = require('hardhat')
  const [deployer] = await hre.ethers.getSigners()
  console.log('Deployer:', deployer.address)

  const deploymentsPath = getDeploymentsPath(hre.network.name)
  if (!existsSync(deploymentsPath)) throw new Error('deployments not found: ' + deploymentsPath)
  const data = JSON.parse(readFileSync(deploymentsPath, 'utf-8'))

  const factoryAddr = data.v3?.factory
  const usdc = data.tokens?.USDC?.address
  const eurc = data.tokens?.EURC?.address

  if (!factoryAddr) throw new Error('v3.factory missing in deployments. Run deploy:periphery first.')
  if (!usdc) throw new Error('tokens.USDC.address missing in deployments')
  if (!eurc) throw new Error('tokens.EURC.address missing in deployments')

  // token0 < token1 for UniswapV3
  const token0 = usdc.toLowerCase() < eurc.toLowerCase() ? usdc : eurc
  const token1 = usdc.toLowerCase() < eurc.toLowerCase() ? eurc : usdc

  const factoryAbi = [
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
    'function createPool(address tokenA, address tokenB, uint24 fee) returns (address pool)',
  ]
  let poolAbiFull
  const poolAbiPath = resolve(__dirname, '../../src/abis/v3/UniswapV3Pool.json')
  if (existsSync(poolAbiPath)) {
    poolAbiFull = JSON.parse(readFileSync(poolAbiPath, 'utf-8'))
  } else {
    poolAbiFull = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json').abi
  }

  const factory = new hre.ethers.Contract(factoryAddr, factoryAbi, deployer)
  let poolAddr = await factory.getPool(token0, token1, FEE_500)
  let poolCreated = false

  console.log('Pool address from getPool:', poolAddr)

  if (poolAddr === hre.ethers.ZeroAddress) {
    console.log('Creating pool USDC/EURC fee 0.05%...')
    const tx = await factory.createPool(token0, token1, FEE_500)
    const rec = await tx.wait()
    const ev = rec?.logs?.find((l) =>
      l.topics[0] === hre.ethers.id('PoolCreated(address,address,uint24,int24,address)')
    )
    poolAddr = ev ? '0x' + ev.topics[3]?.slice(-40) : (await factory.getPool(token0, token1, FEE_500))
    if (poolAddr === hre.ethers.ZeroAddress) throw new Error('Failed to get pool address after createPool')
    poolCreated = true
    console.log('Pool created:', poolAddr)
  }

  // Validate pool address has bytecode
  const code = await hre.ethers.provider.getCode(poolAddr)
  if (!code || code === '0x') throw new Error('Pool address has no bytecode at ' + poolAddr)
  console.log('Pool code length:', code.length)

  const pool = new hre.ethers.Contract(poolAddr, poolAbiFull, deployer)

  // Validate pool.factory() matches deployments
  let poolFactoryAddr
  try {
    poolFactoryAddr = await pool.factory()
  } catch (e) {
    throw new Error('Pool contract mismatch: factory() call failed. ' + e.message)
  }
  if (poolFactoryAddr.toLowerCase() !== factoryAddr.toLowerCase()) {
    throw new Error(
      'Pool contract mismatch: pool.factory()=' + poolFactoryAddr + ' != deployments.factory=' + factoryAddr
    )
  }
  console.log('Pool.factory():', poolFactoryAddr)

  const slot0 = await pool.slot0()
  const isInitialized = slot0.sqrtPriceX96 > 0n
  let poolInitialized = false
  let sqrtPriceX96 = isInitialized ? slot0.sqrtPriceX96 : SQRT_PRICE_1_1

  if (!isInitialized) {
    console.log('Initializing pool at 1:1...')
    await (await pool.initialize(SQRT_PRICE_1_1)).wait()
    poolInitialized = true
  }

  // Save to deployments
  data.v3 = data.v3 || {}
  data.v3.v3Pool_USDC_EURC_500 = poolAddr
  data.v3.v3Pool_USDC_EURC_500_sqrtPriceX96 = sqrtPriceX96.toString()
  writeFileSync(deploymentsPath, JSON.stringify(data, null, 2))

  console.log('\n--- Summary ---')
  console.log('Pool address:', poolAddr)
  console.log('Code length:', code.length)
  console.log('Pool.factory():', poolFactoryAddr)
  console.log('Pool:', poolCreated ? 'created' : 'existed')
  console.log('Initialized:', isInitialized || poolInitialized ? 'yes' : 'no')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
