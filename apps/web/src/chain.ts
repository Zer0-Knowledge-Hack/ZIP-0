/**
 * Read-only view of the deployed testnet contracts.
 *
 * The app has no send path yet (#38 keeps the submit button disabled), so everything here is a
 * read. That is deliberate: showing real numbers pulled from the chain is what separates this from
 * a mockup, and it costs no key, no signature and no trust.
 *
 * The one rule that matters: a failed read must surface as "unavailable", never as a number. We
 * removed three fabricated transaction hashes from this codebase; a liquidity figure that silently
 * falls back to a placeholder would be the same lie in a nicer suit.
 */
import { createPublicClient, defineChain, http } from "viem";

export const HSK_TESTNET = defineChain({
  id: 133,
  name: "HashKey Chain Testnet",
  nativeCurrency: { name: "HSK", symbol: "HSK", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet.hsk.xyz"] } },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://testnet-explorer.hsk.xyz" },
  },
  testnet: true,
});

/** Settlement token backing the vault on testnet. Six decimals, as USDC is everywhere. */
export const USDC = "0x1f65E72EE31F709969Dfc75f98f5867EaE332CD9" as const;
export const USDC_DECIMALS = 6;

const BALANCE_OF = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * A public node can be slow or down, and this runs on a projector during a demo. Fail fast and
 * render the unavailable state rather than leaving a spinner on screen.
 */
const client = createPublicClient({
  chain: HSK_TESTNET,
  transport: http(undefined, { timeout: 8_000, retryCount: 1 }),
});

export type NetworkState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ok"; blockNumber: bigint; liquidity: bigint };

export async function readNetworkState(vault: `0x${string}`): Promise<NetworkState> {
  try {
    // Both reads must succeed. A block number next to a missing balance invites the reader to
    // assume the balance is zero rather than unknown.
    const [blockNumber, liquidity] = await Promise.all([
      client.getBlockNumber(),
      client.readContract({
        address: USDC,
        abi: BALANCE_OF,
        functionName: "balanceOf",
        args: [vault],
      }),
    ]);
    return { status: "ok", blockNumber, liquidity };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Formats a six-decimal token amount for display.
 *
 * Truncates rather than rounds: showing more liquidity than the vault holds is the direction that
 * misleads. Grouping follows the active locale so the figure reads naturally in both languages.
 */
export function formatLiquidity(raw: bigint, locale: string): string {
  const scale = 10n ** BigInt(USDC_DECIMALS);
  const whole = raw / scale;
  const cents = (raw % scale) / 10n ** BigInt(USDC_DECIMALS - 2);

  // The integer part stays a bigint through grouping so it cannot lose precision, and the decimal
  // separator is taken from the locale rather than assumed to be a dot.
  const separator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value ?? ".";

  return `${new Intl.NumberFormat(locale).format(whole)}${separator}${String(cents).padStart(2, "0")}`;
}

/** Block heights are long enough to need grouping, and they are read aloud during demos. */
export function formatBlock(block: bigint, locale: string): string {
  return new Intl.NumberFormat(locale).format(block);
}
