/**
 * Deploy V3 Periphery: NFTDescriptor, NonfungibleTokenPositionDescriptor (linked),
 * SwapRouter, NonfungiblePositionManager
 * Requires: deployV3Core run first (WETH9, Factory in deployments)
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

/** Link NFTDescriptor lib address into NonfungibleTokenPositionDescriptor bytecode */
function linkNFTDescriptor(bytecode: string, nftDescriptorAddress: string): string {
  const addr = nftDescriptorAddress.replace(/^0x/, '').toLowerCase()
  if (addr.length !== 40) throw new Error('Invalid address length')
  // linkReferences: start 1681 (bytes), length 20 -> replace 40 hex chars at 2 + 1681*2
  const start = 2 + 1681 * 2
  const before = bytecode.slice(0, start)
  const after = bytecode.slice(start + 40)
  return before + addr + after
}

/** bytes32 right-padded with zeros for native currency label (e.g. "USDC" for Arc) */
function toNativeCurrencyLabelBytes(label: string): string {
  const encoded = hre.ethers.toUtf8Bytes(label)
  if (encoded.length > 32) throw new Error('Label too long')
  const hex = hre.ethers.hexlify(encoded).slice(2)
  return '0x' + hex.padEnd(64, '0')
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  console.log('Deployer:', deployer.address)

  const deployments = loadDeployments() as {
    chainId: number
    v3?: {
      weth9?: string
      factory?: string
      swapRouter?: string
      nftDescriptor?: string
      positionDescriptor?: string
      positionManager?: string
    }
  }
  deployments.v3 = deployments.v3 || {}

  const weth9 = deployments.v3.weth9
  const factory = deployments.v3.factory
  if (!weth9 || !factory) {
    throw new Error('Run deployV3Core.ts first. Missing weth9 or factory in deployments.')
  }

  // 1. NFTDescriptor (library)
  let nftDescriptorAddr = deployments.v3.nftDescriptor
  if (!nftDescriptorAddr) {
    const NFTDescriptorArtifact = await import(
      '@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json'
    )
    const Lib = new hre.ethers.ContractFactory(
      NFTDescriptorArtifact.abi,
      NFTDescriptorArtifact.bytecode,
      deployer
    )
    const lib = await Lib.deploy()
    await lib.waitForDeployment()
    nftDescriptorAddr = await lib.getAddress()
    deployments.v3.nftDescriptor = nftDescriptorAddr
    saveDeployments(deployments)
    console.log('NFTDescriptor deployed:', nftDescriptorAddr)
  } else {
    console.log('NFTDescriptor already deployed:', nftDescriptorAddr)
  }

  // 2. NonfungibleTokenPositionDescriptor (with linked NFTDescriptor)
  let descriptorAddr = deployments.v3.positionDescriptor
  if (!descriptorAddr) {
    const DescriptorArtifact = await import(
      '@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json'
    )
    const linkedBytecode = linkNFTDescriptor(
      DescriptorArtifact.bytecode,
      nftDescriptorAddr
    )
    // Arc uses USDC as gas token - label as USDC
    const nativeLabelBytes = toNativeCurrencyLabelBytes('USDC')
    const Descriptor = new hre.ethers.ContractFactory(
      DescriptorArtifact.abi,
      linkedBytecode,
      deployer
    )
    const desc = await Descriptor.deploy(weth9, nativeLabelBytes)
    await desc.waitForDeployment()
    descriptorAddr = await desc.getAddress()
    deployments.v3.positionDescriptor = descriptorAddr
    saveDeployments(deployments)
    console.log('NonfungibleTokenPositionDescriptor deployed:', descriptorAddr)
  } else {
    console.log('NonfungibleTokenPositionDescriptor already deployed:', descriptorAddr)
  }

  // 3. SwapRouter
  let swapRouterAddr = deployments.v3.swapRouter
  if (!swapRouterAddr) {
    const SwapRouterArtifact = await import(
      '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
    )
    const SwapRouter = new hre.ethers.ContractFactory(
      SwapRouterArtifact.abi,
      SwapRouterArtifact.bytecode,
      deployer
    )
    const router = await SwapRouter.deploy(factory, weth9)
    await router.waitForDeployment()
    swapRouterAddr = await router.getAddress()
    deployments.v3.swapRouter = swapRouterAddr
    saveDeployments(deployments)
    console.log('SwapRouter deployed:', swapRouterAddr)
  } else {
    console.log('SwapRouter already deployed:', swapRouterAddr)
  }

  // 4. NonfungiblePositionManager
  let positionManagerAddr = deployments.v3.positionManager
  if (!positionManagerAddr) {
    const NPMArtifact = await import(
      '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
    )
    const NPM = new hre.ethers.ContractFactory(
      NPMArtifact.abi,
      NPMArtifact.bytecode,
      deployer
    )
    const npm = await NPM.deploy(factory, weth9, descriptorAddr)
    await npm.waitForDeployment()
    positionManagerAddr = await npm.getAddress()
    deployments.v3.positionManager = positionManagerAddr
    saveDeployments(deployments)
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
