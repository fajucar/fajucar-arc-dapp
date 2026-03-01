/**
 * Export V3 ABIs to src/abis/v3/
 */
const { mkdirSync, writeFileSync, existsSync } = require('fs')
const { resolve, dirname } = require('path')

const OUT = resolve(__dirname, '../../src/abis/v3')

function exportAbi(fullPath, outName) {
  const artifact = require(fullPath)
  const abi = typeof artifact.abi === 'undefined' ? artifact : artifact.abi
  if (!abi) throw new Error(`No ABI in ${fullPath}`)
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
  const dest = resolve(OUT, outName + '.json')
  writeFileSync(dest, JSON.stringify(abi, null, 2))
  console.log('Exported', outName)
}

const coreRoot = dirname(require.resolve('@uniswap/v3-core/package.json'))
const periphRoot = dirname(require.resolve('@uniswap/v3-periphery/package.json'))

exportAbi(resolve(coreRoot, 'artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'), 'UniswapV3Factory')
exportAbi(resolve(coreRoot, 'artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'), 'UniswapV3Pool')
exportAbi(resolve(periphRoot, 'artifacts/contracts/SwapRouter.sol/SwapRouter.json'), 'SwapRouter')
exportAbi(resolve(periphRoot, 'artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'), 'NonfungiblePositionManager')
exportAbi(resolve(periphRoot, 'artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json'), 'NFTDescriptor')
exportAbi(resolve(periphRoot, 'artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json'), 'NonfungibleTokenPositionDescriptor')

console.log('Done.')
