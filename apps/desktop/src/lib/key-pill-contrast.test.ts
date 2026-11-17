import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { camelotColor } from "./camelot.ts";
import { EMPTY_KEY_PAINT, pillPaint, RELATION_TONE, type PillPaint } from "./key-pill-surface.ts";

/**
 * The K10 gate: every text colour a key pill can ask for, measured against
 * every surface it can end up on, at WCAG AA (`docs/ui/01-DESIGN-SYSTEM.md` §4,
 * "Pills … stay legible in both themes").
 *
 * The tokens are parsed from `index.css` rather than restated here, so changing
 * the palette moves this gate instead of quietly disagreeing with it.
 */

const AA_TEXT = 4.5;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const RELATIONS = Object.keys(RELATION_TONE) as (keyof typeof RELATION_TONE)[];
const CODES: string[] = [];
for (let n = 1; n <= 12; n++) for (const letter of ["A", "B"]) CODES.push(`${n}${letter}`);

/** Every ground a library row can present to a pill sitting inside it. */
const ROW_GROUNDS = ["background", "hover", "active"] as const;

interface Block {
  [token: string]: string;
}

function cssBlocks(source: string): { selector: string; body: Block }[] {
  const css = source.replace(BLOCK_COMMENT, "");
  const out: { selector: string; body: Block }[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1]!.split(";").pop()!.trim().replace(/\s+/g, " ");
    const body: Block = {};
    let seen = 0;
    for (const decl of match[2]!.split(";")) {
      const pair = /^\s*(--[\w-]+)\s*:\s*([^;]+?)\s*$/.exec(decl);
      if (pair) {
        body[pair[1]!] = pair[2]!;
        seen++;
      }
    }
    if (seen) out.push({ selector, body });
  }
  return out;
}

const parsed = cssBlocks(
  readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8")
);

function findBlock(label: string, matches: (selector: string) => boolean): Block {
  const found = parsed.find((block) => matches(block.selector));
  assert.ok(found, `index.css has no ${label} block`);
  return found.body;
}

const baseDecls: Block = {
  ...findBlock("raw palette", (s) => s === ":root"),
  ...findBlock("@theme aliases", (s) => s === "@theme"),
};
const themeDecls = {
  dark: findBlock("dark theme", (s) => s.includes('[data-theme="dark"]')),
  light: findBlock("light theme", (s) => s.includes('[data-theme="light"]')),
};

function resolve(name: string, theme: "dark" | "light", seen = 0): string {
  assert.ok(seen < 8, `${name} does not resolve to a colour`);
  const value = themeDecls[theme][name] ?? baseDecls[name];
  assert.ok(value, `index.css never defines ${name}`);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  if (alias) return resolve(alias[1]!, theme, seen + 1);
  assert.match(value, /^#[0-9a-fA-F]{6}$/, `${name} is not a 6-digit hex in the ${theme} theme`);
  return value.toUpperCase();
}

function tokens(theme: "dark" | "light") {
  return {
    background: resolve("--cds-background", theme),
    hover: resolve("--cds-layer-hover", theme),
    active: resolve("--cds-layer-active", theme),
    primary: resolve("--cds-text-primary", theme),
    secondary: resolve("--cds-text-secondary", theme),
    muted: resolve("--cds-text-muted", theme),
  };
}

function varName(reference: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(reference);
  assert.ok(match, `groundToken is not a custom property reference: ${reference}`);
  return match[1]!;
}

/** The opaque surfaces a rendered pill can present to its own text. */
function surfaces(theme: "dark" | "light", paint: PillPaint): string[] {
  const t = tokens(theme);
  const grounds = paint.groundToken
    ? [resolve(varName(paint.groundToken), theme)]
    : ROW_GROUNDS.map((key) => t[key]);
  if (!paint.hueLayer) return grounds;
  const layer = /^linear-gradient\((#[0-9A-F]{6}[0-9A-F]{2}),\s*\1\)$/.exec(paint.hueLayer);
  assert.ok(layer, `hueLayer is not a solid gradient layer: ${paint.hueLayer}`);
  return grounds.map((ground) => composite(layer[1]!, ground));
}

function ink(paint: PillPaint, theme: "dark" | "light"): string {
  const t = tokens(theme);
  return paint.ink === "primary" ? t.primary : paint.ink === "secondary" ? t.secondary : t.muted;
}

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
};

/** WCAG contrast ratio between two opaque colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** source-over of an 8-digit hex layer onto an opaque ground. */
function composite(layer: string, ground: string): string {
  const alpha = parseInt(layer.slice(7, 9), 16) / 255;
  const top = rgb(layer);
  const bottom = rgb(ground);
  const mixed = top.map((value, i) =>
    Math.round((value! * alpha + bottom[i]! * (1 - alpha)) * 255)
  );
  return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function worst(paint: PillPaint, theme: "dark" | "light"): number {
  return Math.min(...surfaces(theme, paint).map((surface) => contrast(ink(paint, theme), surface)));
}

for (const theme of ["dark", "light"] as const) {
  test(`${theme}: a referenced key pill clears AA on every row state`, () => {
    for (const code of CODES) {
      for (const relation of RELATIONS) {
        const paint = pillPaint(camelotColor(code, theme), RELATION_TONE[relation]);
        const ratio = worst(paint, theme);
        assert.ok(
          ratio >= AA_TEXT,
          `${theme} ${code} ${relation} sits on ${surfaces(theme, paint).join(", ")} at ${ratio.toFixed(
            2
          )}:1 (AA needs ${AA_TEXT}:1)`
        );
      }
    }
  });

  test(`${theme}: an unreferenced key pill clears AA on every row state`, () => {
    for (const code of CODES) {
      const paint = pillPaint(camelotColor(code, theme), null);
      const ratio = worst(paint, theme);
      assert.ok(
        ratio >= AA_TEXT,
        `${theme} ${code} with no reference sits at ${ratio.toFixed(2)}:1 (AA needs ${AA_TEXT}:1)`
      );
    }
  });

  test(`${theme}: a tinted pill paints its own ground, so the row cannot move under it`, () => {
    for (const code of CODES) {
      for (const relation of RELATIONS) {
        const tone = RELATION_TONE[relation];
        if (tone.quiet) continue;
        const paint = pillPaint(camelotColor(code, theme), tone);
        assert.ok(
          paint.groundToken,
          `${theme} ${code} ${relation} paints a translucent fill straight onto the row, so hover and selection change the ground under the text`
        );
      }
    }
  });

  test(`${theme}: quiet pills clear AA on every row state`, () => {
    const cases: [string, PillPaint][] = [
      ["incompatible", pillPaint(camelotColor("7B", theme), RELATION_TONE.incompatible)],
      ["unknown", pillPaint(camelotColor("7B", theme), RELATION_TONE.unknown)],
      ["key-less track", EMPTY_KEY_PAINT],
    ];
    for (const [label, paint] of cases) {
      const ratio = worst(paint, theme);
      assert.ok(
        ratio >= AA_TEXT,
        `${theme} ${label} sits on ${surfaces(theme, paint).join(", ")} at ${ratio.toFixed(2)}:1 (AA needs ${AA_TEXT}:1)`
      );
    }
  });
}

test("the row grounds are the surfaces the library table actually paints", () => {
  assert.deepEqual(tokens("light"), {
    background: "#F4F4F4",
    hover: "#E8E8E8",
    active: "#C6C6C6",
    primary: "#161616",
    secondary: "#525252",
    muted: "#6F6F6F",
  });
  assert.deepEqual(tokens("dark"), {
    background: "#161616",
    hover: "#353535",
    active: "#4C4C4C",
    primary: "#F4F4F4",
    secondary: "#C6C6C6",
    muted: "#8D8D8D",
  });
});
