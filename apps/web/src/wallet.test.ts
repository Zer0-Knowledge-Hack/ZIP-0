import { describe, expect, it } from "vitest";
import {
  chainName,
  isLocalPreview,
  isMobileDevice,
  mapWalletError,
  metamaskDappLink,
  parseAccounts,
  parseChainId,
  shortenAddress,
  trustDappLink,
} from "./wallet";

describe("wallet helpers", () => {
  it("shortens addresses for small screens", () => {
    expect(shortenAddress("0x503a41a175e599F62353790D1B958d1c296C38ef")).toBe("0x503a…38ef");
  });

  it("maps wallet rejection and pending codes", () => {
    expect(mapWalletError({ code: 4001 })).toBe("walletRejected");
    expect(mapWalletError({ code: -32002 })).toBe("walletPending");
    expect(mapWalletError({ code: 0 })).toBe("walletError");
  });

  it("parses chain ids and accounts", () => {
    expect(parseChainId("0x85")).toBe(133);
    expect(parseAccounts(["0xabc", 12])).toEqual(["0xabc"]);
    expect(chainName(133)).toBe("HashKey Testnet");
  });

  it("builds mobile wallet deep links", () => {
    const page = "https://demo.zip0.example/app/pay";
    expect(metamaskDappLink(page)).toBe("https://metamask.app.link/dapp/demo.zip0.example/app/pay");
    expect(trustDappLink(page)).toContain("demo.zip0.example");
    expect(isMobileDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isMobileDevice("Mozilla/5.0 (Windows NT 10.0)")).toBe(false);
    expect(isLocalPreview("127.0.0.1")).toBe(true);
  });
});
