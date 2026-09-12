export class BridgeError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: unknown) {
    super(message);
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
