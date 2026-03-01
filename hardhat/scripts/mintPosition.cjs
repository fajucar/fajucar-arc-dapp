/**
 * Mint a V3 position for USDC/EURC pool.
 * Idempotent: mints a new position each run.
 */
const { readFileSync, existsSync } = require('fs')
const { resolve } = require('path')

const getDeploymentsPath = (network) =>
  resolve(__dirname, `../../src/config/deployments.${network === 'arcTestnet' ? 'arc-testnet' : 'hardhat'}.json`)
const FEE_500 = 500
const TICK_SPACING_500 = 10
const TICK_LOWER = -100
const TICK_UPPER = 100

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]
const NPM_ABI = [
  'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
]

function fmt(n) {
  return n.toString()
}

async function main() {
  const hre = require('hardhat')
  const [deployer] = await hre.ethers.getSigners()
  console.log('Deployer:', deployer.address)

  const deploymentsPath = getDeploymentsPath(hre.network.name)
  if (!existsSync(deploymentsPath)) throw new Error('deployments not found: ' + deploymentsPath)
  const data = JSON.parse(readFileSync(deploymentsPath, 'utf-8'))

  const npmAddr = data.v3?.positionManager ?? data.v3?.nonfungiblePositionManager
  const usdcAddr = data.tokens?.USDC?.address
  const eurcAddr = data.tokens?.EURC?.address
  const usdcDecimals = data.tokens?.USDC?.decimals ?? 6
  const eurcDecimals = data.tokens?.EURC?.decimals ?? 6

  if (!npmAddr) throw new Error('v3.positionManager missing in deployments')
  if (!usdcAddr) throw new Error('tokens.USDC.address missing in deployments')
  if (!eurcAddr) throw new Error('tokens.EURC.address missing in deployments')

  const token0Addr = usdcAddr.toLowerCase() < eurcAddr.toLowerCase() ? usdcAddr : eurcAddr
  const token1Addr = usdcAddr.toLowerCase() < eurcAddr.toLowerCase() ? eurcAddr : usdcAddr
  const isUsdcToken0 = token0Addr.toLowerCase() === usdcAddr.toLowerCase()

  const usdcAmount = hre.ethers.parseUnits('10', usdcDecimals)
  const eurcAmount = hre.ethers.parseUnits('10', eurcDecimals)
  const amount0Desired = isUsdcToken0 ? usdcAmount : eurcAmount
  const amount1Desired = isUsdcToken0 ? eurcAmount : usdcAmount

  const token0 = new hre.ethers.Contract(token0Addr, ERC20_ABI, deployer)
  const token1 = new hre.ethers.Contract(token1Addr, ERC20_ABI, deployer)

  const bal0 = await token0.balanceOf(deployer.address)
  const bal1 = await token1.balanceOf(deployer.address)
  const allow0 = await token0.allowance(deployer.address, npmAddr)
  const allow1 = await token1.allowance(deployer.address, npmAddr)

  console.log('\n--- Addresses ---')
  console.log('USDC:', usdcAddr)
  console.log('EURC:', eurcAddr)
  console.log('PositionManager:', npmAddr)
  console.log('\n--- Decimals ---')
  console.log('USDC decimals:', usdcDecimals)
  console.log('EURC decimals:', eurcDecimals)
  console.log('\n--- Balances (deployer) ---')
  console.log('token0 balance:', fmt(bal0), isUsdcToken0 ? '(USDC)' : '(EURC)')
  console.log('token1 balance:', fmt(bal1), isUsdcToken0 ? '(EURC)' : '(USDC)')
  console.log('\n--- Allowances (deployer -> PositionManager) ---')
  console.log('token0 allowance:', fmt(allow0))
  console.log('token1 allowance:', fmt(allow1))
  console.log('\n--- Amounts ---')
  console.log('amount0Desired:', fmt(amount0Desired), 'amount1Desired:', fmt(amount1Desired))
  console.log('amount0Min: 0, amount1Min: 0')

  if (bal0 < amount0Desired || bal1 < amount1Desired) {
    throw new Error(
      'Saldo insuficiente de USDC/EURC. Faça faucet/mint desses tokens na carteira deployer e tente novamente.'
    )
  }

  const MaxUint256 = 2n ** 256n - 1n
  if (allow0 < amount0Desired) {
    console.log('Approving token0...')
    await (await token0.approve(npmAddr, MaxUint256)).wait(1)
    console.log('approved token0')
  }
  if (allow1 < amount1Desired) {
    console.log('Approving token1...')
    await (await token1.approve(npmAddr, MaxUint256)).wait(1)
    console.log('approved token1')
  }

  const npm = new hre.ethers.Contract(npmAddr, NPM_ABI, deployer)
  const deadline = Math.floor(Date.now() / 1000) + 600

  const params = {
    token0: token0Addr,
    token1: token1Addr,
    fee: FEE_500,
    tickLower: TICK_LOWER,
    tickUpper: TICK_UPPER,
    amount0Desired,
    amount1Desired,
    amount0Min: 0n,
    amount1Min: 0n,
    recipient: deployer.address,
    deadline,
  }

  console.log('\nMinting position...')
  const tx = await npm.mint(params)
  const rec = await tx.wait()

  const zeroAddr = hre.ethers.zeroPadValue('0x0000000000000000000000000000000000000000', 32).toLowerCase()
  const transferEv = rec?.logs?.find(
    (l) =>
      l.address.toLowerCase() === npmAddr.toLowerCase() &&
      l.topics[0] === hre.ethers.id('Transfer(address,address,uint256)') &&
      l.topics[1]?.toLowerCase() === zeroAddr
  )
  const increaseEv = rec?.logs?.find(
    (l) => l.topics[0] === hre.ethers.id('IncreaseLiquidity(uint256,uint128,uint256,uint256)')
  )

  const tokenId = transferEv ? BigInt(transferEv.topics[3] ?? 0) : 0n
  let liquidity = 0n
  if (increaseEv?.data) {
    const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint128', 'uint256', 'uint256'],
      increaseEv.data
    )
    liquidity = decoded[0]
  }

  console.log('\n--- Mint result ---')
  console.log('TokenId:', tokenId.toString())
  console.log('Liquidity:', liquidity.toString())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
