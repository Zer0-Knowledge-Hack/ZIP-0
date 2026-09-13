/**
 * Guards against the failure mode that cost this project four separate debugging sessions:
 * the same selector declared twice in the same cascade context, where the later block silently
 * overrides the earlier one.
 *
 * It is not a style preference. A fix applied to the first block has no effect, so the code reads
 * as though it does one thing while the browser does another. The navbar contrast fix in #44 was
 * invisible for exactly this reason — `.desktop-nav button` was set to `--zip-ink-muted` and then
 * re-set to `--zip-signal-faint` four hundred lines further down.
 *
 * Duplicates across *different* media queries are legitimate overrides and are not flagged.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import postcss, { type AtRule, type Node } from "postcss";

const STYLE = fileURLToPath(new URL("./style.css", import.meta.url));

/*
 * postcss types Node as a base class rather than a discriminated union, so `type === "atrule"`
 * does not narrow on its own and the cast has to be explicit.
 */
type Parent = Node | undefined;
const asAtRule = (node: Node): AtRule => node as AtRule;

/** The chain of enclosing at-rules, which is what makes two rules compete in the first place. */
function contextOf(node: Node): string {
  const parts: string[] = [];
  let p: Parent = node.parent;
  while (p && p.type !== "root") {
    if (p.type === "atrule") {
      const at = asAtRule(p);
      parts.unshift(`@${at.name} ${at.params}`);
    }
    p = p.parent;
  }
  return parts.join(" >> ") || "(top level)";
}

function isInsideKeyframes(node: Node): boolean {
  let p: Parent = node.parent;
  while (p && p.type !== "root") {
    // "from", "to" and "50%" are keyframe steps, not competing selectors.
    if (p.type === "atrule" && /keyframes/.test(asAtRule(p).name)) return true;
    p = p.parent;
  }
  return false;
}

function duplicateSelectors(): string[] {
  const root = postcss.parse(readFileSync(STYLE, "utf8"), { from: STYLE });
  const seen = new Map<string, number[]>();

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) return;
    // Selector lists are order-independent: ".a, .b" and ".b, .a" are the same rule.
    const normalised = rule.selector
      .split(",")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .sort()
      .join(", ");
    const key = `${contextOf(rule)} || ${normalised}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(rule.source?.start?.line ?? 0);
  });

  return [...seen.entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([key, lines]) => `${key}  (lines ${lines.join(", ")})`);
}

describe("style.css hygiene", () => {
  it("declares each selector once per cascade context", () => {
    expect(duplicateSelectors()).toEqual([]);
  });
});
