import {
  AuthorizationPayload,
  CrossChainDomain,
  PaymentIntent,
  PaymentQuote,
  PaymentRequest,
  RoutedPaymentIntent,
  SettlementRailType,
} from "./types.js";

export type { PaymentStore } from "./payment-store.js";
export { InMemoryPaymentStore } from "./in-memory-payment-store.js";
export { FilePaymentStore } from "./file-payment-store.js";

/**
 * A settlement mechanism capable of moving value between two domains.
 *
 * Each rail decides for itself which routes it can serve. The router asks; it never
 * branches on rail type. Adding a new mechanism means adding an implementation of this
 * interface and registering it — no change to the routing engine.
 */
export interface ISettlementRail {
  readonly railType: SettlementRailType;

  /** Whether this rail can settle the given route. Must not throw. */
  supportsRoute(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number
  ): boolean;

  /** Expected cost of settling `amount` over this route, denominated in the payment token. */
  estimateFee(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number,
    amount: bigint
  ): Promise<bigint>;

  /**
   * Executes settlement and resolves with the destination-chain transaction hash — the
   * transaction that proves value arrived. Rails that also emit a source-chain transaction
   * are responsible for surfacing it through their own API.
   * @param authorizationSignature Optional gasless authorization (EIP-2612 or ERC-3009).
   */
  executeSettlement(
    intent: PaymentIntent,
    authorizationSignature?: `0x${string}`
  ): Promise<string>;
}

/**
 * Entry point for payment execution. Chooses a rail for the requested route and settles
 * over it, so callers never name a settlement mechanism.
 */
export interface IPaymentRouter {
  /** Makes a rail available to the router. */
  registerRail(rail: ISettlementRail): void;

  /** Gets fee and finality quote for a route. */
  getQuote(
    sourceChainId: number,
    destinationChainId: number,
    amount: bigint
  ): Promise<PaymentQuote>;

  /** Routes and settles a payment, returning the intent with its rail recorded. */
  routePayment(
    request: PaymentRequest | Omit<PaymentIntent, "status" | "createdAt" | "railType">
  ): Promise<RoutedPaymentIntent>;

  /** Fee quote for a route, delegated to whichever rail owns it. */
  estimateFee(
    source: CrossChainDomain | number,
    destination: CrossChainDomain | number,
    amount: bigint
  ): Promise<bigint>;

  getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null>;
}

export interface IGaslessAuthorizer {
  verifyAuthorization(
    payload: AuthorizationPayload,
    chainId: number,
    tokenAddress: `0x${string}`
  ): Promise<boolean>;
}

export interface IEvmAdapter {
  depositPayment(intent: Omit<PaymentIntent, "status" | "createdAt">): Promise<`0x${string}`>;
  releasePayment(
    paymentId: `0x${string}`,
    recipient: `0x${string}`,
    amount: bigint
  ): Promise<`0x${string}`>;
  /**
   * Marks a vault deposit as picked up by the relayer (`INITIATED` → `ACKNOWLEDGED`), which stops
   * the payer from reclaiming it through `claimRefund`. Resolves with the confirmed tx hash.
   */
  acknowledgePayment(paymentId: `0x${string}`): Promise<`0x${string}`>;
  getVaultBalance(): Promise<bigint>;
  onPaymentInitiated(callback: (intent: PaymentIntent) => Promise<void>): () => void;
}

export interface IStellarAdapter {
  creditPayment(recipient: string, amount: bigint, referenceId: string): Promise<string>;
  onPaymentReceived(
    callback: (payment: { referenceId: string; amount: bigint; sender: string }) => Promise<void>
  ): () => void;
  getBalance(accountId: string): Promise<bigint>;
}

export interface IRelayerOrchestrator {
  handleHskToStellar(intent: PaymentIntent): Promise<void>;
  handleStellarToHsk(payment: {
    referenceId: string;
    amount: bigint;
    destinationHskAddress: `0x${string}`;
  }): Promise<`0x${string}`>;
  getPaymentStatus(paymentId: `0x${string}`): Promise<PaymentIntent | null>;
}
