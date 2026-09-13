import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PaymentStore } from "./payment-store.js";
import {
  AuthorizationPayload,
  BridgePaymentStatus,
  PaymentIntent,
} from "./types.js";

interface SerializedAuthorizationPayload extends Omit<AuthorizationPayload, "value"> {
  value: string;
}

interface SerializedPaymentIntent
  extends Omit<PaymentIntent, "amount" | "createdAt" | "authorization"> {
  amount: string;
  createdAt: string;
  authorization?: SerializedAuthorizationPayload;
}

/**
 * JSON file store so payment tracking survives a process restart.
 *
 * `bigint` and `Date` are converted explicitly; a missing file is an empty store.
 * Writes go through a temp file then rename to avoid leaving a half-written JSON.
 */
export class FilePaymentStore implements PaymentStore {
  constructor(private readonly filePath: string) {}

  async get(paymentId: `0x${string}`): Promise<PaymentIntent | null> {
    const records = await this.load();
    return records.get(paymentId) ?? null;
  }

  async set(intent: PaymentIntent): Promise<void> {
    const records = await this.load();
    records.set(intent.paymentId, { ...intent });
    await this.save(records);
  }

  async list(): Promise<PaymentIntent[]> {
    return Array.from((await this.load()).values());
  }

  async findByStatus(status: BridgePaymentStatus): Promise<PaymentIntent[]> {
    return (await this.list()).filter((intent) => intent.status === status);
  }

  private async load(): Promise<Map<`0x${string}`, PaymentIntent>> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (err: unknown) {
      if (isNotFound(err)) {
        return new Map();
      }
      throw err;
    }

    if (raw.trim() === "") {
      return new Map();
    }

    const parsed = JSON.parse(raw) as Record<string, SerializedPaymentIntent>;
    const records = new Map<`0x${string}`, PaymentIntent>();

    for (const [paymentId, serialized] of Object.entries(parsed)) {
      records.set(paymentId as `0x${string}`, deserializePayment(serialized));
    }

    return records;
  }

  private async save(records: Map<`0x${string}`, PaymentIntent>): Promise<void> {
    const payload: Record<string, SerializedPaymentIntent> = {};
    for (const [paymentId, intent] of records) {
      payload[paymentId] = serializePayment(intent);
    }

    await mkdir(path.dirname(this.filePath), { recursive: true });

    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmpPath, JSON.stringify(payload), "utf8");

    try {
      await rename(tmpPath, this.filePath);
    } catch {
      await unlink(this.filePath).catch(() => undefined);
      await rename(tmpPath, this.filePath);
    }
  }
}

function serializePayment(intent: PaymentIntent): SerializedPaymentIntent {
  return {
    ...intent,
    amount: intent.amount.toString(),
    createdAt: intent.createdAt.toISOString(),
    authorization: intent.authorization
      ? {
          ...intent.authorization,
          value: intent.authorization.value.toString(),
        }
      : undefined,
  };
}

function deserializePayment(serialized: SerializedPaymentIntent): PaymentIntent {
  return {
    ...serialized,
    amount: BigInt(serialized.amount),
    createdAt: new Date(serialized.createdAt),
    authorization: serialized.authorization
      ? {
          ...serialized.authorization,
          value: BigInt(serialized.authorization.value),
        }
      : undefined,
  };
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "ENOENT"
  );
}
