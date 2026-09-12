export enum ErrorCode {
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  UNSUPPORTED_DOMAIN = "UNSUPPORTED_DOMAIN",
  INSUFFICIENT_VAULT_BALANCE = "INSUFFICIENT_VAULT_BALANCE",
  PAYMENT_RELEASE_FAILED = "PAYMENT_RELEASE_FAILED",
  PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND",
  RELAYER_EXECUTION_ERROR = "RELAYER_EXECUTION_ERROR",
  INVALID_RECIPIENT = "INVALID_RECIPIENT",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
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

/**
 * Raised when a code path would otherwise have to invent a result it cannot produce.
 *
 * Settlement paths must never return a transaction hash they did not obtain from a real
 * broadcast: a synthetic hash reports success for a transaction that never existed, and it
 * resolves to nothing on any block explorer. Refusing is the honest behaviour.
 */
export class NotImplementedError extends BridgeError {
  constructor(what: string, guidance?: string) {
    super(
      ErrorCode.NOT_IMPLEMENTED,
      guidance ? `${what} is not implemented. ${guidance}` : `${what} is not implemented.`,
      { what }
    );
    this.name = "NotImplementedError";
  }
}

export class InvalidRecipientError extends BridgeError {
  constructor(recipient: string, expected: string) {
    super(
      ErrorCode.INVALID_RECIPIENT,
      `Invalid recipient "${recipient}". Expected ${expected}.`,
      { recipient, expected }
    );
    this.name = "InvalidRecipientError";
  }
}

export class RelayerExecutionError extends BridgeError {
  constructor(message: string, details?: unknown) {
    super(`Relayer transaction failed: ${message}`, "RELAYER_EXECUTION_ERROR", details);
    this.name = "RelayerExecutionError";
  }
}
