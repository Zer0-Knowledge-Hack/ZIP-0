import { parseUnits } from "viem";

export function amountValue(value: string): bigint | null {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return null;
  const amount = parseUnits(value, 6);
  return amount > 0n ? amount : null;
}

/** Stellar account IDs are G… base32, 56 characters. */
export function isStellarAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
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

/** true = dark. Explicit choice wins over OS preference. */
export function initialThemeDark(): boolean {
  try {
    const saved = localStorage.getItem("zip0-theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
  } catch {
    /* Storage may be disabled. */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
