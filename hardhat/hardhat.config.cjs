const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
require('dotenv').config({ path: path.join(__dirname, '../.env') })
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })
require('@nomicfoundation/hardhat-ethers')

const { RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env

const pk = DEPLOYER_PRIVATE_KEY
  ? (DEPLOYER_PRIVATE_KEY.startsWith('0x') ? DEPLOYER_PRIVATE_KEY : '0x' + DEPLOYER_PRIVATE_KEY)
  : null

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.7.6',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 1337 },
    arcTestnet: {
      url: RPC_URL,
      chainId: 5042002,
      accounts: pk ? [pk] : [],
    },
  },
  paths: {
    root: __dirname,
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
}
