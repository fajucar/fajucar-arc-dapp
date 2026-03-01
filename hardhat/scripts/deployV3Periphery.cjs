/**
 * Deploy V3 Periphery: NFTDescriptor, NonfungibleTokenPositionDescriptor (linked),
 * SwapRouter, NonfungiblePositionManager
 * Requires: deployV3Core run first (WETH9, Factory in deployments)
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

function linkNFTDescriptor(bytecode, nftDescriptorAddress) {
  const addr = nftDescriptorAddress.replace(/^0x/, '').toLowerCase()
  if (addr.length !== 40) throw new Error('Invalid address length')
  const start = 2 + 1681 * 2
  const before = bytecode.slice(0, start)
  const after = bytecode.slice(start + 40)
  return before + addr + after
}

function toNativeCurrencyLabelBytes(ethers, label) {
  const encoded = ethers.toUtf8Bytes(label)
  if (encoded.length > 32) throw new Error('Label too long')
  const hex = ethers.hexlify(encoded).slice(2)
  return '0x' + hex.padEnd(64, '0')
}

async function main() {
  const hre = require('hardhat')
  const networkName = hre.network.name
  const deploymentsPath = getDeploymentsPath(networkName)
  const [deployer] = await hre.ethers.getSigners()
  console.log('Deployer:', deployer.address, '| Network:', networkName)

  const deployments = loadDeployments(deploymentsPath)
  deployments.v3 = deployments.v3 || {}

  const weth9 = deployments.v3.weth9
  const factory = deployments.v3.factory
  if (!weth9 || !factory) {
    throw new Error('Run deployV3Core first. Missing weth9 or factory in deployments.')
  }

  let nftDescriptorAddr = deployments.v3.nftDescriptor
  if (!nftDescriptorAddr) {
    const NFTDescriptorArtifact = require('@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json')
    const Lib = new hre.ethers.ContractFactory(
      NFTDescriptorArtifact.abi,
      NFTDescriptorArtifact.bytecode,
      deployer
    )
    const lib = await Lib.deploy()
    await lib.waitForDeployment()
    nftDescriptorAddr = await lib.getAddress()
    deployments.v3.nftDescriptor = nftDescriptorAddr
    saveDeployments(deploymentsPath, deployments)
    console.log('NFTDescriptor deployed:', nftDescriptorAddr)
  } else {
    console.log('NFTDescriptor already deployed:', nftDescriptorAddr)
  }

  let descriptorAddr = deployments.v3.positionDescriptor
  if (!descriptorAddr) {
    const DescriptorArtifact = require('@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json')
    const linkedBytecode = linkNFTDescriptor(DescriptorArtifact.bytecode, nftDescriptorAddr)
    const nativeLabelBytes = toNativeCurrencyLabelBytes(hre.ethers, 'USDC')
    const Descriptor = new hre.ethers.ContractFactory(
      DescriptorArtifact.abi,
      linkedBytecode,
      deployer
    )
    const desc = await Descriptor.deploy(weth9, nativeLabelBytes)
    await desc.waitForDeployment()
    descriptorAddr = await desc.getAddress()
    deployments.v3.positionDescriptor = descriptorAddr
    saveDeployments(deploymentsPath, deployments)
    console.log('NonfungibleTokenPositionDescriptor deployed:', descriptorAddr)
  } else {
    console.log('NonfungibleTokenPositionDescriptor already deployed:', descriptorAddr)
  }

  let swapRouterAddr = deployments.v3.swapRouter
  if (!swapRouterAddr) {
    const SwapRouterArtifact = require('@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json')
    const SwapRouter = new hre.ethers.ContractFactory(
      SwapRouterArtifact.abi,
      SwapRouterArtifact.bytecode,
      deployer
    )
    const router = await SwapRouter.deploy(factory, weth9)
    await router.waitForDeployment()
    swapRouterAddr = await router.getAddress()
    deployments.v3.swapRouter = swapRouterAddr
    saveDeployments(deploymentsPath, deployments)
    console.log('SwapRouter deployed:', swapRouterAddr)
  } else {
    console.log('SwapRouter already deployed:', swapRouterAddr)
  }

  let positionManagerAddr = deployments.v3.positionManager
  if (!positionManagerAddr) {
    const NPMArtifact = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json')
    const NPM = new hre.ethers.ContractFactory(
      NPMArtifact.abi,
      NPMArtifact.bytecode,
      deployer
    )
    const npm = await NPM.deploy(factory, weth9, descriptorAddr)
    await npm.waitForDeployment()
    positionManagerAddr = await npm.getAddress()
    deployments.v3.positionManager = positionManagerAddr
    saveDeployments(deploymentsPath, deployments)
    console.log('NonfungiblePositionManager deployed:', positionManagerAddr)
  } else {
    console.log('NonfungiblePositionManager already deployed:', positionManagerAddr)
  }

  console.log('\n--- V3 Periphery Addresses ---')
  console.log('NFTDescriptor:', nftDescriptorAddr)
  console.log('NonfungibleTokenPositionDescriptor:', descriptorAddr)
  console.log('SwapRouter:', swapRouterAddr)
  console.log('NonfungiblePositionManager:', positionManagerAddr)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
