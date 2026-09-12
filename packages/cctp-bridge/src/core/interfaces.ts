import {
  PaymentIntent,
  PaymentQuote,
  SettlementRailType,
  AuthorizationPayload,
} from "./types.js";

export interface ISettlementRail {
  readonly railType: SettlementRailType;
  supportsRoute(sourceChainId: number, destinationChainId: number): boolean;
  estimateFee(sourceChainId: number, destinationChainId: number, amount: bigint): Promise<bigint>;
  executeSettlement(
    intent: PaymentIntent,
    authorizationSignature?: `0x${string}`
  ): Promise<`0x${string}`>;
}

export interface IPaymentRouter {
  registerRail(rail: ISettlementRail): void;
  getQuote(
    sourceChainId: number,
    destinationChainId: number,
    amount: bigint
  ): Promise<PaymentQuote>;
  routePayment(
    intent: Omit<PaymentIntent, "status" | "createdAt" | "railType">
  ): Promise<PaymentIntent>;
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
