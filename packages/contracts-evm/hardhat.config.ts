import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../../.env" });

const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  process.env.RELAYER_PRIVATE_KEY ||
  process.env.HSK_RELAYER_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          evmVersion: "cancun",
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // HashKey Chain publishes its RPCs under hsk.xyz. The former *.alt.technology
    // endpoints are decommissioned and return no response — see docs/hsk-chain-integration.md.
    hskTestnet: {
      url: process.env.HSK_RPC_URL || "https://testnet.hsk.xyz",
      chainId: 133,
      accounts: [PRIVATE_KEY],
    },
    hskMainnet: {
      url: process.env.HSK_MAINNET_RPC_URL || "https://mainnet.hsk.xyz",
      chainId: 177,
      accounts: [PRIVATE_KEY],
    },
    avaxFuji: {
      url: process.env.AVAX_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || "snowtrace",
      // Blockscout does not require a real key; any non-empty value is accepted.
      hskMainnet: process.env.HSK_EXPLORER_API_KEY || "blockscout",
      hskTestnet: process.env.HSK_EXPLORER_API_KEY || "blockscout",
    },
    customChains: [
      {
        network: "hskMainnet",
        chainId: 177,
        urls: {
          apiURL: "https://hashkey.blockscout.com/api",
          browserURL: "https://hashkey.blockscout.com",
        },
      },
      {
        network: "hskTestnet",
        chainId: 133,
        urls: {
          apiURL: "https://testnet-explorer.hsk.xyz/api",
          browserURL: "https://testnet-explorer.hsk.xyz",
        },
      },
    ],
  },
};

export default config;
