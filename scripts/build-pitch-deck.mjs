/**
 * Generates the ZIP·0 pitch deck as a .pptx.
 *
 * The deck is generated rather than hand-built so the identity stays in sync with
 * docs/assets/zip0-tokens.css, and so a copy change is a one-line diff in review rather than a
 * binary nobody can read. The output is still a normal PowerPoint file: open it, edit it, present
 * it offline.
 *
 *   node scripts/build-pitch-deck.mjs
 *   -> docs/assets/zip0-pitch.pptx
 *
 * Content follows docs/pitch-script.md exactly. If the script changes, change it there first.
 *
 * Two typefaces only, both present on any machine with Office installed:
 *   Georgia  — display. The serif carries the institutional read.
 *   Consolas — every figure, and the small labels.
 *
 * Figures never use Georgia. It ships old-style numerals, which sit at different heights and
 * destroy the alignment the identity is built on.
 */
import PptxGenJS from "pptxgenjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Tokens mirrored from docs/assets/zip0-tokens.css (dark palette).
const C = {
  paper: "0A0E14",
  surface: "141A23",
  border: "243040",
  ink: "E6EAF0",
  inkMuted: "96A3B5",
  inkFaint: "71839D",
  signal: "4B86FF",
  settled: "34D399",
  pending: "FBBF24",
};

const DISPLAY = "Georgia";
const MONO = "Consolas";

const W = 13.333;
const H = 7.5;
const M = 0.95;

const deck = new PptxGenJS();
deck.layout = "LAYOUT_16x9";
deck.author = "ZIP-0";
deck.title = "ZIP-0 — Pitch";

/** Every slide opens with the rail. It is the one structural device in the identity. */
function slide(notes) {
  const s = deck.addSlide();
  s.background = { color: C.paper };
  s.addShape(deck.ShapeType.rect, {
    x: M, y: 0.8, w: W - M * 2, h: 0.012, fill: { color: C.border }, line: { width: 0 },
  });
  if (notes) s.addNotes(notes);
  return s;
}

function eyebrow(s, text, y = 1.45) {
  s.addText(text.toUpperCase(), {
    x: M, y, w: W - M * 2, h: 0.3,
    fontFace: MONO, fontSize: 11, color: C.inkFaint, charSpacing: 2,
  });
}

function foot(s, left, num) {
  s.addShape(deck.ShapeType.rect, {
    x: M, y: 6.62, w: W - M * 2, h: 0.012, fill: { color: C.border }, line: { width: 0 },
  });
  s.addText(left, {
    x: M, y: 6.75, w: 8, h: 0.3, fontFace: MONO, fontSize: 10, color: C.inkFaint, charSpacing: 1,
  });
  s.addText(num, {
    x: W - M - 1, y: 6.75, w: 1, h: 0.3, align: "right",
    fontFace: MONO, fontSize: 10, color: C.inkFaint,
  });
}

/**
 * The mark: a zero crossed by a rail.
 *
 * Drawn as a ring, then the aperture punched by a thick line in the ground colour, then the rail
 * itself on top. That reproduces the gap where the transfer passes through instead of faking it.
 */
function mark(s, x, y, size) {
  const stroke = size * 0.095;
  s.addShape(deck.ShapeType.ellipse, {
    x, y, w: size, h: size,
    fill: { type: "none" }, line: { color: C.signal, width: stroke * 72 },
  });
  s.addShape(deck.ShapeType.rect, {
    x: x - size * 0.14, y: y + size / 2 - stroke * 0.9, w: size * 1.28, h: stroke * 1.8,
    fill: { color: C.paper }, line: { width: 0 },
  });
  s.addShape(deck.ShapeType.rect, {
    x: x - size * 0.14, y: y + size / 2 - stroke / 2, w: size * 1.28, h: stroke,
    fill: { color: C.signal }, line: { width: 0 },
  });
}

function wordmark(s, x, y) {
  s.addText("ZIP·0", {
    x, y, w: 5, h: 1.5,
    fontFace: DISPLAY, fontSize: 66, bold: true, color: C.ink, charSpacing: 2,
  });
}

/* ---------------------------------------------------------------- 01 */
{
  const s = slide(
    "Say it plainly and stop: \"My name is Julio Severiche, and this is ZIP-0.\" Do not explain the name."
  );
  mark(s, M, 2.55, 1.25);
  wordmark(s, M + 1.75, 2.5);
  s.addText("Cross-border settlement for institutions that cannot hold crypto.", {
    x: M, y: 4.35, w: 8.5, h: 0.6,
    fontFace: DISPLAY, fontSize: 20, color: C.inkMuted,
  });
  foot(s, "Julio Severiche", "01");
}

/* ---------------------------------------------------------------- 02 */
{
  const s = slide(
    "The pause after \"48,600 arrives\" is the whole pitch. Let them do the subtraction. If you fill the silence they hear a statistic, not a loss."
  );
  eyebrow(s, "An exporter in Cochabamba ships to Brazil");

  const rows = [
    ["Invoiced", "50,000.00", C.ink],
    ["Arrived, eleven days later", "48,600.00", C.ink],
    ["Taken in flight by three banks", "−1,400.00", C.pending],
  ];
  rows.forEach(([label, value, colour], i) => {
    const y = 2.25 + i * 1.25;
    s.addText(label, {
      x: M, y: y + 0.42, w: 5.5, h: 0.4,
      fontFace: MONO, fontSize: 13, color: i === 2 ? C.pending : C.inkMuted,
    });
    s.addText(
      [
        { text: value, options: { fontSize: 40, color: colour } },
        { text: "  USD", options: { fontSize: 16, color: C.inkFaint } },
      ],
      { x: M + 5.5, y, w: W - M * 2 - 5.5, h: 0.95, align: "right", fontFace: MONO }
    );
    if (i < 2) {
      s.addShape(deck.ShapeType.rect, {
        x: M, y: y + 1.0, w: W - M * 2, h: 0.008, fill: { color: C.border }, line: { width: 0 },
      });
    }
  });
  foot(s, "Nobody stole anything", "02");
}

/* ---------------------------------------------------------------- 03 */
{
  const s = slide(
    "Do not say \"we replace SWIFT\". We replace the settlement layer. Give \"twenty-seven trillion\" room to land."
  );
  eyebrow(s, "Where the money actually moves");

  // Lane 1 — messaging. One clean line: it never holds the money.
  s.addText(
    [
      { text: "SWIFT", options: { color: C.ink, bold: true } },
      { text: "   MESSAGING", options: { color: C.inkFaint } },
    ],
    { x: M, y: 2.2, w: 8, h: 0.35, fontFace: MONO, fontSize: 13, charSpacing: 1 }
  );
  s.addShape(deck.ShapeType.rect, {
    x: M, y: 2.78, w: W - M * 2, h: 0.03, fill: { color: C.signal }, line: { width: 0 },
  });
  s.addText("Carries the instruction. Never holds the money.", {
    x: M, y: 2.95, w: 8, h: 0.4, fontFace: DISPLAY, fontSize: 16, color: C.inkMuted,
  });

  // Lane 2 — settlement. Three intermediaries, each taking a bite.
  s.addText(
    [
      { text: "CORRESPONDENT BANKING", options: { color: C.ink, bold: true } },
      { text: "   SETTLEMENT", options: { color: C.inkFaint } },
    ],
    { x: M, y: 4.15, w: 9, h: 0.35, fontFace: MONO, fontSize: 13, charSpacing: 1 }
  );
  s.addShape(deck.ShapeType.rect, {
    x: M, y: 4.79, w: W - M * 2, h: 0.03, fill: { color: C.border }, line: { width: 0 },
  });
  [0.28, 0.5, 0.72].forEach((t) => {
    const cx = M + (W - M * 2) * t;
    s.addShape(deck.ShapeType.ellipse, {
      x: cx - 0.26, y: 4.54, w: 0.52, h: 0.52,
      fill: { color: C.surface }, line: { color: C.pending, width: 1.25 },
    });
    s.addText("−", {
      x: cx - 0.26, y: 4.57, w: 0.52, h: 0.46, align: "center",
      fontFace: MONO, fontSize: 15, color: C.pending,
    });
  });
  s.addText(
    [
      { text: "Where the fee comes out. And where ", options: { color: C.inkMuted } },
      { text: "$27 trillion", options: { color: C.signal } },
      { text: " sits idle, pre-funded.", options: { color: C.inkMuted } },
    ],
    { x: M, y: 5.35, w: 10.5, h: 0.4, fontFace: DISPLAY, fontSize: 16 }
  );
  foot(s, "The layer nobody replaced", "03");
}

/* ---------------------------------------------------------------- 04 */
{
  const s = slide("First time you may say the word \"contract\". Still do not say \"blockchain\".");
  eyebrow(s, "ZIP·0");
  s.addText("One rail.\nNo intermediaries.", {
    x: M, y: 2.35, w: 10, h: 2.1,
    fontFace: DISPLAY, fontSize: 54, color: C.ink, lineSpacing: 60,
  });
  s.addText("A settlement contract holds the funds. It locks on one side and releases on the other.", {
    x: M, y: 4.75, w: 8.5, h: 0.8,
    fontFace: DISPLAY, fontSize: 19, color: C.inkMuted,
  });
  foot(s, "No pre-funded account in every corridor", "04");
}

/* ---------------------------------------------------------------- 05 */
{
  const s = slide(
    "Switch to the deployed app on this slide. The figure moves because it is read from the chain, not stored in the deck."
  );
  s.addShape(deck.ShapeType.ellipse, {
    x: M, y: 1.5, w: 0.14, h: 0.14, fill: { color: C.settled }, line: { width: 0 },
  });
  s.addText("LIVE ON HASHKEY CHAIN", {
    x: M + 0.3, y: 1.42, w: 8, h: 0.3,
    fontFace: MONO, fontSize: 11, color: C.settled, charSpacing: 2,
  });

  s.addText("SETTLEMENT CONTRACT — SOURCE VERIFIED", {
    x: M, y: 2.35, w: 10, h: 0.28, fontFace: MONO, fontSize: 10.5, color: C.inkFaint, charSpacing: 1.5,
  });
  s.addText("0x3028a9AfCD5E2c3C2E1fD35d984Be65640ca4e07", {
    x: M, y: 2.68, w: 11.5, h: 0.5, fontFace: MONO, fontSize: 22, color: C.ink,
  });

  s.addText("AVAILABLE FUNDS — READ EVERY 15 SECONDS", {
    x: M, y: 3.75, w: 10, h: 0.28, fontFace: MONO, fontSize: 10.5, color: C.inkFaint, charSpacing: 1.5,
  });
  s.addText("49,999.60 USDC", {
    x: M, y: 4.08, w: 11.5, h: 0.75, fontFace: MONO, fontSize: 38, color: C.ink,
  });

  s.addText("You do not have to believe me. You can read it.", {
    x: M, y: 5.25, w: 9, h: 0.5, fontFace: DISPLAY, fontSize: 19, color: C.inkMuted,
  });
  foot(s, "Switch to the deployed app here", "05");
}

/* ---------------------------------------------------------------- 06 */
{
  const s = slide(
    "Do not soften this slide. Every other team will claim more than they built - stating the limits is the differentiator, not a caveat."
  );
  eyebrow(s, "Let me be precise about what this is");

  const chips = ["Testnet", "Unaudited", "Trusted operator", "Submit disabled"];
  let x = M;
  chips.forEach((label) => {
    const w = 0.28 + label.length * 0.145;
    s.addShape(deck.ShapeType.rect, {
      x, y: 2.5, w, h: 0.72,
      fill: { color: C.surface }, line: { color: C.border, width: 1 },
    });
    s.addText(label, {
      x, y: 2.5, w, h: 0.72, align: "center", valign: "middle",
      fontFace: MONO, fontSize: 16, color: C.ink,
    });
    x += w + 0.3;
  });

  s.addText("Every figure in the interface came from a real chain read — or it says unavailable.", {
    x: M, y: 4.1, w: 9.5, h: 0.9, fontFace: DISPLAY, fontSize: 24, color: C.ink,
  });
  foot(s, "Nothing here is decoration", "06");
}

/* ---------------------------------------------------------------- 07 */
{
  const s = slide("End on the line. Do not add a thank-you sentence after it.");
  mark(s, M, 1.65, 0.95);
  wordmark(s, M + 1.4, 1.55);
  s.addText("The amount you send\nis the amount that arrives.", {
    x: M, y: 3.35, w: 11, h: 2,
    fontFace: DISPLAY, fontSize: 46, color: C.ink, lineSpacing: 54,
  });
  s.addText("Next: an audit, and one pilot corridor — Bolivia to Brazil.", {
    x: M, y: 5.5, w: 9, h: 0.5, fontFace: DISPLAY, fontSize: 18, color: C.inkMuted,
  });
  foot(s, "ZIP·0", "07");
}

const out = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "assets",
  "zip0-pitch.pptx"
);

await deck.writeFile({ fileName: out });
console.log("wrote " + out);
