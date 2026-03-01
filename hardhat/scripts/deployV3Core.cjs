/**
 * Deploy V3 Core: WETH9, UniswapV3Factory
 * Idempotent: reads existing from deployments, skips if already deployed.
 */
const { readFileSync, writeFileSync, existsSync } = require('fs')
const { resolve } = require('path')

const getDeploymentsPath = (network) =>
  resolve(__dirname, `../../src/config/deployments.${network === 'arcTestnet' ? 'arc-testnet' : 'hardhat'}.json`)

function loadDeployments(path) {
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf-8'))
  }
  return { chainId: 5042002 }
}

function saveDeployments(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2))
}

async function main() {
  const hre = require('hardhat')
  const networkName = hre.network.name
  const deploymentsPath = getDeploymentsPath(networkName)

  const [deployer] = await hre.ethers.getSigners()
  if (!deployer) throw new Error('No deployer account. Set DEPLOYER_PRIVATE_KEY in .env for arcTestnet, or use --network hardhat for local.')
  console.log('Deployer:', deployer.address, '| Network:', networkName)

  const deployments = loadDeployments(deploymentsPath)
  deployments.v3 = deployments.v3 || {}

  let weth9Addr = deployments.v3.weth9
  if (!weth9Addr) {
    const Weth9 = await hre.ethers.getContractFactory('WETH9')
    const weth9 = await Weth9.deploy()
    await weth9.waitForDeployment()
    weth9Addr = await weth9.getAddress()
    deployments.v3.weth9 = weth9Addr
    saveDeployments(deploymentsPath, deployments)
    console.log('WETH9 deployed:', weth9Addr)
  } else {
    console.log('WETH9 already deployed:', weth9Addr)
  }

  let factoryAddr = deployments.v3.factory
  if (!factoryAddr) {
    const FactoryArtifact = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json')
    const Factory = new hre.ethers.ContractFactory(
      FactoryArtifact.abi,
      FactoryArtifact.bytecode,
      deployer
    )
    const factory = await Factory.deploy()
    await factory.waitForDeployment()
    factoryAddr = await factory.getAddress()
    deployments.v3.factory = factoryAddr
    saveDeployments(deploymentsPath, deployments)
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
