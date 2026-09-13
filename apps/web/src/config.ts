/**
 * Deployment the UI reads from.
 *
 * These are public, read-only values: an RPC endpoint, an explorer and contract addresses.
 * No key ever reaches the browser — the UI observes chain state, it does not sign.
 *
 * NOTE: the vault below predates the ABI changes in #25 (claimRefund, acknowledgePayment) and
 * #28 (depositWithAuthorization). It is being redeployed in #35; update this address and the
 * README together when that lands.
 */
export const NETWORK = {
  name: "HashKey Chain Testnet",
  chainId: 133,
  rpcUrl: "https://testnet.hsk.xyz",
  explorerUrl: "https://testnet-explorer.hsk.xyz",
  nativeSymbol: "HSK",
} as const;

export const CONTRACTS = {
  vault: "0x14e59806054773fc341377aEC472C07e500BCc86",
  usdc: "0x46a7BE8Cea2d9EB017D0a0277467E680bcA04f17",
} as const;

/** USDC and MockUSDC both use 6 decimals across every supported network. */
export const USDC_DECIMALS = 6;

export const explorerAddress = (address: string): string =>
  `${NETWORK.explorerUrl}/address/${address}`;

export const explorerTx = (hash: string): string => `${NETWORK.explorerUrl}/tx/${hash}`;
