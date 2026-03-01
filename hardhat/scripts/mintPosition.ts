/**
 * Mint a V3 position for USDC/EURC pool.
 * Requires: createPoolAndInit run first.
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import hre from 'hardhat'

const DEPLOYMENTS_PATH = resolve(__dirname, '../../src/config/deployments.arc-testnet.json')
const FEE_500 = 500

// Tick range: ~0.95 to 1.05 around 1:1 (tick 0). For 6 decimals, tick spacing 10.
// tickLower: -100, tickUpper: 100 (narrow range)
const TICK_LOWER = -100
const TICK_UPPER = 100

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  if (!existsSync(DEPLOYMENTS_PATH)) throw new Error('deployments not found')
  const data = JSON.parse(readFileSync(DEPLOYMENTS_PATH, 'utf-8'))
  const npmAddr = data.v3?.positionManager
  const usdc = data.tokens?.USDC?.address ?? '0x3600000000000000000000000000000000000000'
  const eurc = data.tokens?.EURC?.address ?? '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'
  if (!npmAddr) throw new Error('NonfungiblePositionManager not deployed')

  const npmAbi = [
    'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  ]
  const erc20Abi = ['function approve(address spender, uint256 amount) returns (bool)']

  const amount0 = hre.ethers.parseUnits('100', 6)
  const amount1 = hre.ethers.parseUnits('100', 6)

  const token0 = usdc.toLowerCase() < eurc.toLowerCase() ? usdc : eurc
  const token1 = usdc.toLowerCase() < eurc.toLowerCase() ? eurc : usdc
  const token0Contract = new hre.ethers.Contract(token0, erc20Abi, deployer)
  const token1Contract = new hre.ethers.Contract(token1, erc20Abi, deployer)

  await (await token0Contract.approve(npmAddr, amount0)).wait()
  await (await token1Contract.approve(npmAddr, amount1)).wait()

  const npm = new hre.ethers.Contract(npmAddr, npmAbi, deployer)
  const deadline = Math.floor(Date.now() / 1000) + 3600
  const params = {
    token0,
    token1,
    fee: FEE_500,
    tickLower: TICK_LOWER,
    tickUpper: TICK_UPPER,
    amount0Desired: amount0,
    amount1Desired: amount1,
    amount0Min: 0n,
    amount1Min: 0n,
    recipient: deployer.address,
    deadline,
  }

  console.log('Minting position...')
  const tx = await npm.mint(params)
  const rec = await tx.wait()
  const zeroAddr = hre.ethers.zeroPadValue('0x0000000000000000000000000000000000000000', 32).toLowerCase()
  const transferEv = rec?.logs?.find(
    (l: { topics: string[]; address: string }) =>
      l.address.toLowerCase() === npmAddr.toLowerCase() &&
      l.topics[0] === hre.ethers.id('Transfer(address,address,uint256)') &&
      l.topics[1]?.toLowerCase() === zeroAddr
  )
  const tokenId = transferEv ? BigInt(transferEv.topics[3] ?? 0) : 0n
  console.log('Position minted. TokenId:', tokenId.toString())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
