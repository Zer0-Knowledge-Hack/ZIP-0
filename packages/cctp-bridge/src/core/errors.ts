export enum ErrorCode {
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  UNSUPPORTED_DOMAIN = "UNSUPPORTED_DOMAIN",
  INSUFFICIENT_VAULT_BALANCE = "INSUFFICIENT_VAULT_BALANCE",
  PAYMENT_RELEASE_FAILED = "PAYMENT_RELEASE_FAILED",
  PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND",
  RELAYER_EXECUTION_ERROR = "RELAYER_EXECUTION_ERROR",
}

export class BridgeError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(codeOrMessage: string, messageOrCode?: string, details?: unknown) {
    if (Object.values(ErrorCode).includes(codeOrMessage as ErrorCode)) {
      super(messageOrCode ?? codeOrMessage);
      this.code = codeOrMessage;
      this.details = details;
    } else {
      super(codeOrMessage);
      this.code = messageOrCode ?? "BRIDGE_ERROR";
      this.details = details;
    }
    this.name = "BridgeError";
  }
}

export class InsufficientVaultLiquidityError extends BridgeError {
  constructor(required: bigint, available: bigint) {
    super(
      `Insufficient liquidity in HSK Vault: required ${required}, available ${available}`,
      "INSUFFICIENT_VAULT_LIQUIDITY",
      { required, available }
    );
    this.name = "InsufficientVaultLiquidityError";
  }
}

export class PaymentNotFoundError extends BridgeError {
  constructor(paymentId: string) {
    super(`Payment intent not found: ${paymentId}`, "PAYMENT_NOT_FOUND", { paymentId });
    this.name = "PaymentNotFoundError";
  }
}

export class UnsupportedRouteError extends BridgeError {
  constructor(source: number, destination: number) {
    super(
      `No settlement rail supports route ${source} -> ${destination}`,
      "UNSUPPORTED_ROUTE",
      { source, destination }
    );
    this.name = "UnsupportedRouteError";
  }
}

export class RelayerExecutionError extends BridgeError {
  constructor(message: string, details?: unknown) {
    super(`Relayer transaction failed: ${message}`, "RELAYER_EXECUTION_ERROR", details);
    this.name = "RelayerExecutionError";
  }
}
