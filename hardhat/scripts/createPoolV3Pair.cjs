/**
 * Create V3 pool for any token pair. Use: npx hardhat run scripts/createPoolV3Pair.cjs --network arcTestnet
 * Pair via args: node createPoolV3Pair.cjs USDC FAJU  (defaults to USDC FAJU if none)
 *
 * sqrtPriceX96 for 1:1 human price:
 * - Both 6 decimals (USDC/EURC): sqrt(1)*2^96
 * - token0=18 decimals, token1=6 decimals (FAJU/USDC): price=1e6/1e18, sqrt=1e-6, sqrtPriceX96 = 2^96/1e6
 * - token0=6 decimals, token1=18 decimals (USDC/FAJU): price=1e18/1e6, sqrt=1e6, sqrtPriceX96 = 1e6*2^96
 */
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { resolve } = require('path')

const FEE_500 = 500

const ARC_TOKENS = {
  USDC: { address: '0x3600000000000000000000000000000000000000', decimals: 6 },
  EURC: { address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a', decimals: 6 },
  FAJU: { address: '0x0e8147CdB023474f440636051AA26f7DCaf2aEa7', decimals: 18 },
  ARCX: { address: '0xA99F353665F89784f0442FB666ea775b6C1af87d', decimals: 18 },
}

function getSqrtPriceX96For1to1(d0, d1) {
  // price = 10^d1/10^d0. sqrtPriceX96 = sqrt(price) * 2^96 = (10^(d1/2) * 2^96) / 10^(d0/2)
  const Q96 = 1n << 96n
  if (d0 === d1) return Q96
  const sqrtNum = BigInt(10 ** Math.floor(d1 / 2))
  const sqrtDen = BigInt(10 ** Math.floor(d0 / 2))
  return (sqrtNum * Q96) / sqrtDen
}

async function main() {
  const hre = require('hardhat')
  const symA = (process.env.TOKEN_A || 'USDC').toUpperCase()
  const symB = (process.env.TOKEN_B || 'FAJU').toUpperCase()

  const tokenA = ARC_TOKENS[symA]
  const tokenB = ARC_TOKENS[symB]
  if (!tokenA) throw new Error(`Unknown token: ${symA}. Valid: ${Object.keys(ARC_TOKENS).join(', ')}`)
  if (!tokenB) throw new Error(`Unknown token: ${symB}. Valid: ${Object.keys(ARC_TOKENS).join(', ')}`)
  if (symA === symB) throw new Error('Select different tokens')

  const [deployer] = await hre.ethers.getSigners()
  console.log('Deployer:', deployer.address)
  console.log('Creating pool:', symA, '/', symB, 'fee 0.05%')

  const v3Path = resolve(__dirname, '../../src/config/deployments.v3.arc-testnet.json')
  if (!existsSync(v3Path)) throw new Error('deployments.v3.arc-testnet.json not found')
  const data = JSON.parse(readFileSync(v3Path, 'utf-8'))

  const factoryAddr = data.v3Factory
  if (!factoryAddr) throw new Error('v3Factory missing')

  const addr0 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenA.address : tokenB.address
  const addr1 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenB.address : tokenA.address
  const dec0 = addr0 === tokenA.address ? tokenA.decimals : tokenB.decimals
  const dec1 = addr0 === tokenA.address ? tokenB.decimals : tokenA.decimals

  const factoryAbi = [
    'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)',
    'function createPool(address tokenA, address tokenB, uint24 fee) returns (address pool)',
  ]
  const poolAbiPath = resolve(__dirname, '../../src/abis/v3/UniswapV3Pool.json')
  const poolAbiFull = existsSync(poolAbiPath)
    ? JSON.parse(readFileSync(poolAbiPath, 'utf-8'))
    : require('@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json').abi

  const factory = new hre.ethers.Contract(factoryAddr, factoryAbi, deployer)
  let poolAddr = await factory.getPool(addr0, addr1, FEE_500)

  if (poolAddr === hre.ethers.ZeroAddress) {
    console.log('Creating pool...')
    const tx = await factory.createPool(addr0, addr1, FEE_500)
    const rec = await tx.wait()
    const ev = rec?.logs?.find((l) =>
      l.topics[0] === hre.ethers.id('PoolCreated(address,address,uint24,int24,address)')
    )
    if (ev?.data) {
      const dataHex = ev.data.slice(2)
      poolAddr = '0x' + dataHex.slice(-40)
    } else {
      poolAddr = await factory.getPool(addr0, addr1, FEE_500)
    }
    if (poolAddr === hre.ethers.ZeroAddress) throw new Error('Failed to get pool after createPool')
    console.log('Pool created:', poolAddr)
  } else {
    console.log('Pool already exists:', poolAddr)
  }

  const code = await hre.ethers.provider.getCode(poolAddr)
  if (!code || code === '0x') throw new Error('Pool has no bytecode')

  const pool = new hre.ethers.Contract(poolAddr, poolAbiFull, deployer)
  const slot0 = await pool.slot0()
  const isInitialized = slot0.sqrtPriceX96 > 0n

  if (!isInitialized) {
    const sqrtPriceX96 = getSqrtPriceX96For1to1(dec0, dec1)
    console.log('Initializing pool at 1:1 (sqrtPriceX96:', sqrtPriceX96.toString(), ')')
    await (await pool.initialize(sqrtPriceX96)).wait()
    console.log('Pool initialized')
  } else {
    console.log('Pool already initialized')
  }

  const poolKey = `v3Pool_${symA}_${symB}_500`.replace(/-/g, '_')
  data[poolKey] = poolAddr
  writeFileSync(v3Path, JSON.stringify(data, null, 2))

  console.log('\n--- Summary ---')
  console.log('Pool', symA + '/' + symB + ':', poolAddr)
  console.log('Saved to', v3Path, 'as', poolKey)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
