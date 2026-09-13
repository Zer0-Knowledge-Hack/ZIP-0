import crypto from "crypto";
import { ISettlementRail } from "@zip-0/cctp-bridge/dist/core/interfaces.js";
import {
  CrossChainDomain,
  PaymentIntent,
  SettlementRailType,
} from "@zip-0/cctp-bridge/dist/core/types.js";
import { PaymentRoutingEngine } from "@zip-0/cctp-bridge/dist/routing/payment-routing-engine.js";

/** Default settlement rail for institutional cross-chain payments in development and testbeds. */
export class DefaultSettlementRail implements ISettlementRail {
  readonly railType: SettlementRailType;

  constructor(railType: SettlementRailType = "LIQUIDITY_VAULT") {
    this.railType = railType;
  }

  supportsRoute(
    _source: CrossChainDomain | number,
    _destination: CrossChainDomain | number
  ): boolean {
    return true;
  }

  async estimateFee(
    _source: CrossChainDomain | number,
    _destination: CrossChainDomain | number,
    _amount: bigint
  ): Promise<bigint> {
    return 0n;
  }

  async executeSettlement(_intent: PaymentIntent): Promise<string> {
    return `0x${crypto.randomBytes(32).toString("hex")}`;
  }
}

export function createDefaultRoutingEngine(customRails?: ISettlementRail[]): PaymentRoutingEngine {
  if (customRails && customRails.length > 0) {
    return new PaymentRoutingEngine(customRails);
  }
  return new PaymentRoutingEngine([new DefaultSettlementRail("LIQUIDITY_VAULT")]);
}
