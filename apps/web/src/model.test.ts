import { describe, expect, it } from "vitest";
import { es } from "./i18n/es";
import { en } from "./i18n/en";
import { amountValue } from "./model";
describe("payment draft", () => {
  it("keeps exact six-decimal amounts", () => {
    expect(amountValue("123456789.123456")).toBe(123456789123456n);
  });
  it.each(["0", "-1", "1.0000001", "1e6", "1,25", "NaN", ""])(
    "rejects ambiguous or invalid amount %s",
    (value) => {
      expect(amountValue(value)).toBeNull();
    }
  );
  it("provides matching, nonempty translations", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    expect(
      [...Object.values(es), ...Object.values(en)].every(
        (value) => value.trim().length > 0
      )
    ).toBe(true);
  });
});
