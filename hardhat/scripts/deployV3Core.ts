/**
 * Deploy V3 Core: WETH9, UniswapV3Factory
 * Idempotent: reads existing from deployments, skips if already deployed.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import hre from 'hardhat'

const DEPLOYMENTS_PATH = resolve(__dirname, '../../src/config/deployments.arc-testnet.json')

function loadDeployments(): Record<string, unknown> {
  if (existsSync(DEPLOYMENTS_PATH)) {
    return JSON.parse(readFileSync(DEPLOYMENTS_PATH, 'utf-8'))
  }
  return { chainId: 5042002 }
}

function saveDeployments(data: Record<string, unknown>) {
  writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(data, null, 2))
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log('Deployer:', deployer.address)

  const deployments = loadDeployments() as { chainId: number; v3?: { weth9?: string; factory?: string } }
  deployments.v3 = deployments.v3 || {}

  // 1. WETH9
  let weth9Addr = deployments.v3.weth9
  if (!weth9Addr) {
    const Weth9 = await hre.ethers.getContractFactory('WETH9')
    const weth9 = await Weth9.deploy()
    await weth9.waitForDeployment()
    weth9Addr = await weth9.getAddress()
    deployments.v3.weth9 = weth9Addr
    saveDeployments(deployments)
    console.log('WETH9 deployed:', weth9Addr)
  } else {
    console.log('WETH9 already deployed:', weth9Addr)
  }

  // 2. UniswapV3Factory (from package artifact)
  let factoryAddr = deployments.v3.factory
  if (!factoryAddr) {
    const FactoryArtifact = await import('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
    const Factory = new hre.ethers.ContractFactory(
      FactoryArtifact.abi,
      FactoryArtifact.bytecode,
      deployer
    )
    const factory = await Factory.deploy()
    await factory.waitForDeployment()
    factoryAddr = await factory.getAddress()
    deployments.v3.factory = factoryAddr
    saveDeployments(deployments)
    console.log('UniswapV3Factory deployed:', factoryAddr)
  } else {
    console.log('UniswapV3Factory already deployed:', factoryAddr)
  }

  console.log('\n--- V3 Core Addresses ---')
  console.log('WETH9:', weth9Addr)
  console.log('Factory:', factoryAddr)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
