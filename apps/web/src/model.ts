import { parseUnits } from "viem";
export function amountValue(value: string): bigint | null {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return null;
  const amount = parseUnits(value, 6);
  return amount > 0n ? amount : null;
}
export function initialLanguage(): "es" | "en" {
  try {
    const saved = localStorage.getItem("zip0-language");
    if (saved === "es" || saved === "en") return saved;
  } catch {
    /* Storage may be disabled. */
  }
  return navigator.language.startsWith("es") ? "es" : "en";
}
