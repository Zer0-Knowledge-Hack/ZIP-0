# ZIP-0 — Visual Identity

Direction: **Modern Rail**. Near-black surfaces, one precise accent, tabular figures.

The audience in the pitch is a bank treasury. The audience at the demo is a developer. The
identity has to hold both readings, which rules out both a heritage-bank look and a terminal
aesthetic.

## The governing idea

If the competitor is SWIFT, credibility comes from looking **precise**, not from looking modern.
In financial infrastructure, trust is communicated by restraint: few colours, generous space,
numbers that align perfectly, no ornament. Anything that reads as "designed" subtracts.

Concretely, that means three rules:

1. **One accent colour.** Most fintech uses three or four. We use one. Everything else is
   surface, ink, or a settlement state.
2. **Numbers are the interface.** Amounts, chain IDs and hashes are the content. They get the
   best typography in the system; prose gets whatever is left.
3. **The rule is a brand element.** A thin horizontal line — the rail — separates content
   instead of boxes, borders and cards competing for attention.

## Differentiating from generic fintech

The honest risk with this direction is looking like every other payments startup. Three things
push against it:

| Move | Why it differentiates |
| :--- | :--- |
| The mark is a **zero crossed by a rail** | Geometric, font-independent, and specific to what the product does. Not an abstract swoosh. |
| **`ZIP·0` with a midpoint**, not a hyphen | The interpunct is a settlement mark — it reads as a separator between two ledgers rather than a compound word. |
| **Monospaced figures everywhere**, including in prose | Most fintech uses mono only in code blocks. Using it for every amount signals that this is a settlement system, not a marketing page. |

## The mark

[`docs/assets/zip0-mark.svg`](assets/zip0-mark.svg) — a zero drawn as two arcs, opened where a
continuous horizontal rail passes through.

It is geometric rather than typographic, so it renders identically without webfonts and stays
legible at favicon size. The gap where the rail meets the ring should read as a transfer passing
through, not as a broken circle. It inherits `currentColor`, so it works on any surface without a
second asset.

### Wordmark

```
ZIP·0
```

Display face, weight 600, letter-spacing `0.04em`. The interpunct is `·` (U+00B7), never a hyphen
or a period. In contexts that cannot render it — package names, URLs, file names — use `zip-0`.

Lockup: mark on the left, wordmark on the right, separated by the cap height of the wordmark.

## Colour

Full token definitions live in [`docs/assets/zip0-tokens.css`](assets/zip0-tokens.css). Consume
that file; do not transcribe hex values into components.

| Role | Light | Dark |
| :--- | :--- | :--- |
| Paper | `#f7f9fc` | `#0a0e14` |
| Surface | `#ffffff` | `#141a23` |
| Ink | `#0a0e14` | `#e6eaf0` |
| Ink muted | `#5a6879` | `#96a3b5` |
| **Signal** (the one accent) | `#1f5fe0` | `#4b86ff` |
| Settled | `#0f7a54` | `#34d399` |
| Pending | `#9a6400` | `#fbbf24` |
| Failed | `#b3261e` | `#f87171` |

Signal is for links, focus rings and the single primary action on a screen. If two things on a
page are signal-coloured, one of them is wrong.

## Typography

| Use | Face | Weight |
| :--- | :--- | :--- |
| Display | Inter Tight (fallback Inter) | 600 |
| Text | Inter | 400 / 500 |
| **Figures, hashes, addresses** | JetBrains Mono | 400 |

### Why tabular figures are a correctness feature

This is the one typographic decision that is not aesthetic.

The product displays columns of amounts and long hex strings. With proportional digits, a column
of amounts cannot be scanned and a misplaced decimal can hide. With tabular lining figures, every
digit occupies the same width, columns align on the decimal, and a wrong magnitude is visible at
a glance.

Apply `.zip-num` to every amount and `.zip-hash` to every address. Both are defined in the token
file and enable `tnum`, `lnum` and the slashed `zero` feature — because an unambiguous `0` in a
hash matters when someone is comparing it against an explorer.

## Accessibility

Settlement status is communicated by colour, which makes this non-optional.

- **Never rely on colour alone.** `SETTLED` and `FAILED` must differ by label or icon as well as
  hue. Pair the dot with its word.
- This gets demoed on a projector in a lit room. Test the dark palette on a screen you do not
  control before relying on it.

### Measured contrast

Every foreground token was checked against its background rather than assumed. All pass WCAG AA
for body text (≥ 4.5:1):

| Token | On light paper | On dark paper |
| :--- | ---: | ---: |
| Ink | 18.34:1 | 16.02:1 |
| Ink muted | 5.39:1 | 7.55:1 |
| Signal | 5.28:1 | 5.67:1 |
| Settled | 5.06:1 | 10.06:1 |
| **Pending** | **4.74:1** | 11.59:1 |
| Failed | 6.20:1 | 6.99:1 |

Pending on light paper is the tightest pair in the system at 4.74:1. It passes, but there is
almost no margin — if that amber is ever lightened, re-check it. Do not use it for small text.

## What not to do

- No gradients, glassmorphism or glow. They read as decoration, and decoration reads as
  unserious in a settlement context.
- No second accent colour. If something needs emphasis, use weight, size or space.
- **Do not borrow HashKey, Circle or Avalanche visual language.** Displaying their logos to
  indicate supported networks is expected; adopting their palette or shapes is not.
- No purple. The category default is exactly what we are trying not to look like.
- Do not set amounts in the text face. Ever.

## Files

| Path | Contents |
| :--- | :--- |
| [`docs/assets/zip0-mark.svg`](assets/zip0-mark.svg) | The mark, `currentColor`, favicon-safe |
| [`docs/assets/zip0-tokens.css`](assets/zip0-tokens.css) | All tokens, light and dark, plus numeral classes |

Both are consumed directly by `apps/web` (#38).
