export type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
};

export type WalletErrorKind =
  | "walletMissing"
  | "walletRejected"
  | "walletPending"
  | "walletError";

export const HSK_CHAIN_ID = 133;
export const HSK_CHAIN_HEX = "0x85";

export const HSK_CHAIN_PARAMS = {
  chainId: HSK_CHAIN_HEX,
  chainName: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: ["https://testnet.hsk.xyz"],
  blockExplorerUrls: ["https://testnet-explorer.hsk.xyz"],
};

export function getProvider(): Eip1193Provider | undefined {
  return (window as Window & { ethereum?: Eip1193Provider }).ethereum;
}

export function isMobileDevice(ua = navigator.userAgent): boolean {
  return /Android|iPhone|iPad|iPod/i.test(ua);
}

export function isLocalPreview(hostname = window.location.hostname): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function dappTarget(href = window.location.href): { hostPath: string; href: string } {
  const url = new URL(href);
  return {
    hostPath: `${url.host}${url.pathname}${url.search}`,
    href: url.href,
  };
}

/** Opens the current page inside the MetaMask in-app browser (where window.ethereum exists). */
export function metamaskDappLink(href = window.location.href): string {
  return `https://metamask.app.link/dapp/${dappTarget(href).hostPath}`;
}

/** Same idea for Trust Wallet on phones. */
export function trustDappLink(href = window.location.href): string {
  return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(dappTarget(href).href)}`;
}

export const METAMASK_DOWNLOAD = "https://metamask.io/download/";

export function mapWalletError(error: unknown): WalletErrorKind {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? Number((error as { code: unknown }).code)
      : undefined;
  if (code === 4001) return "walletRejected";
  if (code === -32002) return "walletPending";
  return "walletError";
}

export function shortenAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function chainName(chainId: number | null): string {
  if (chainId === 133) return "HashKey Testnet";
  if (chainId === 177) return "HashKey";
  if (chainId === 43113) return "Avalanche Fuji";
  if (chainId === 31337) return "Hardhat local";
  if (chainId === 1) return "Ethereum";
  if (chainId == null) return "—";
  return `Chain ${chainId}`;
}

export function parseChainId(value: unknown): number | null {
  if (typeof value === "string" && value.startsWith("0x")) {
    const parsed = Number.parseInt(value, 16);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

export function parseAccounts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.startsWith("0x"));
}

export async function requestAccounts(wallet: Eip1193Provider): Promise<string> {
  const accounts = parseAccounts(await wallet.request({ method: "eth_requestAccounts" }));
  if (!accounts[0]) throw new Error("empty accounts");
  return accounts[0];
}

export async function readAccounts(wallet: Eip1193Provider): Promise<string> {
  const accounts = parseAccounts(await wallet.request({ method: "eth_accounts" }));
  return accounts[0] ?? "";
}

export async function readChainId(wallet: Eip1193Provider): Promise<number | null> {
  return parseChainId(await wallet.request({ method: "eth_chainId" }));
}

export async function readNativeBalance(
  wallet: Eip1193Provider,
  address: string
): Promise<string | null> {
  try {
    const hex = await wallet.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });
    if (typeof hex !== "string") return null;
    const wei = BigInt(hex);
    const whole = wei / 10n ** 18n;
    const frac = ((wei % 10n ** 18n) * 100n) / 10n ** 18n;
    return `${whole.toString()}.${frac.toString().padStart(2, "0")}`;
  } catch {
    return null;
  }
}

export async function switchToHsk(wallet: Eip1193Provider): Promise<void> {
  try {
    await wallet.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HSK_CHAIN_HEX }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? Number((error as { code: unknown }).code)
        : undefined;
    if (code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [HSK_CHAIN_PARAMS],
    });
  }
}
