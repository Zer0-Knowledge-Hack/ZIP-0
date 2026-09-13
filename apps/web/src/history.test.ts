import { describe, expect, it } from "vitest";
import { statusTone } from "./history";

describe("payment status tone", () => {
  it("maps API statuses without inventing new ones", () => {
    expect(statusTone("COMPLETED")).toBe("done");
    expect(statusTone("FAILED")).toBe("fail");
    expect(statusTone("PROCESSING")).toBe("pending");
    expect(statusTone("PENDING")).toBe("pending");
    expect(statusTone("DRAFT")).toBe("draft");
  });
});
