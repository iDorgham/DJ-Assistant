# DJ Assistant — Accessibility

**Status:** Living — 2026-10-14
**Companions:** [UX Principles](./UX_PRINCIPLES.md) · [Design System](./DESIGN_SYSTEM.md) · [Screens & Flows](./SCREENS_AND_FLOWS.md)

Accessibility is part of "the DJ is in control": if a control cannot be reached, read, or
understood, the control is not real. This document states the target, records what the
Phase 0 UI already does, and lists what still needs work.

---

## 1. Commitment and target

- **Target:** **WCAG 2.2 Level AA** for the desktop app at MVP.
- **Scope:** the Tauri/React UI. Keyboard and screen-reader support are required for all
  core flows (scan, browse, search, analyze, cue, build, export).
- **Honesty:** this is a desktop workstation used in dim rooms; a **dark theme** is the
  default, and a fully validated **light theme is planned**, not shipped.

---

## 2. Colour and contrast

Text colour tokens against the canvas (`#0f1117`) were measured with the WCAG relative
luminance formula. Use these findings when choosing text colours.

| Token | Value | Contrast vs canvas | Verdict |
|-------|-------|--------------------|---------|
| `text-primary` | `#f1f5f9` | **≈ 17.2:1** | ✅ AAA |
| `text-secondary` | `#cbd5e1` | **≈ 12.7:1** | ✅ AAA |
| `text-muted` | `#94a3b8` | **≈ 7.4:1** | ✅ AA (normal text) |
| `text-dim` | `#64748b` | **≈ 4.0:1** | ⚠️ Fails AA normal; **large/decorative only** |
| `text-disabled` | `#475569` | **≈ 2.5:1** | ⚠️ Disabled/decorative only |
| `primary-text` | `#60a5fa` | **≈ 7.4:1** | ✅ AA |

**Rules**

1. `text-primary`, `text-secondary`, and `text-muted` are safe for body and table text.
2. **`text-dim` must not carry essential information at normal size.** It is used for the
   row index and placeholders today; placeholders should be reviewed (see §7).
3. **`text-disabled` is for disabled controls and decorative glyphs only** (e.g. the
   no-artwork `Music` icon).
4. Never rely on colour alone to convey status: every status pill pairs a tint with an
   **icon and a text label** (e.g. "Indexed"), which is also what makes it colour-blind safe.
5. When a light theme is added, every token pair must be re-measured.

---

## 3. Keyboard

The UI must be fully operable without a pointer. Phase 0 uses native controls, so most
behaviour comes for free where the markup is correct; the table and custom elements need
explicit review.

**Requirements**

- Every interactive element is reachable by `Tab` in a logical order.
- Focus is always **visible** (see §4).
- The search input and primary actions are reachable and labelled.
- Rows in the library table, once interactive (Phase 2), must be focusable and navigable
  with arrow keys, activatable with `Enter`.

**Planned shortcut set** (to be implemented with the workstation; document actual bindings
when they exist):

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + F` | Focus search |
| `Ctrl/Cmd + O` | Open folder to scan |
| `↑` / `↓` | Move selection in the library table |
| `Enter` | Open selected track (detail) |
| `Space` | Toggle selection / preview |
| `Esc` | Close drawer / cancel dialog |
| `Ctrl/Cmd + Z` | Undo last reversible bulk action |

> Do not invent shortcuts that collide with OS or DJ-software conventions; finalise and
> record them before shipping.

---

## 4. Focus visibility

- Every focusable element must show a non-colour-only focus indicator (outline or ring)
  that meets WCAG 2.4.7 (Focus Visible) and 2.4.11 (Focus Not Obscured—Minimum).
- Current `focus:border-blue-500` gives a focus *border* on inputs. Ensure the default
  browser outline is not removed anywhere without an equivalent visible replacement
  (`focus:outline-hidden` is used on the search input — verify an alternative indicator is
  present).

---

## 5. Motion

- All animation must respect `prefers-reduced-motion: reduce`. This applies to:
  - the idle brand logo spin (`animate-spin-slow`),
  - the refresh icon spin (`animate-spin`),
  - progress-bar transitions (`transition-all duration-200`),
  - hover/colour transitions.
- Under reduced motion, replace spin with a static or non-rotating indicator, and progress
  with an instantly-updating bar.
- Motion must never be the *only* signal of a state; always pair it with text or an icon.

---

## 6. Semantics and assistive technology

- **Landmarks:** the shell maps to `header`, the working area to `main`, and the status bar
  to a `footer`/status region so screen-reader users can jump between them.
- **Live regions:** scan and analysis progress must be announced politely
  (`aria-live="polite"`), and completion summaries announced without stealing focus.
  Avoid announcing every file in a fast scan.
- **Progress bars:** expose `role="progressbar"` with `aria-valuemin/max/now` when
  determinate, and `aria-valuetext` (e.g. "128 of 402 files") otherwise.
- **Tables:** the library is tabular data; use real `<table>`/`<th scope>` semantics with a
  caption or `aria-label` so headers are associated with cells.
- **Icons:** decorative icons are `aria-hidden`; icon-only buttons get an `aria-label`
  (and a `title` for sighted users).
- **Images:** artwork uses empty `alt=""` (decorative) — the track title carries the
  meaning; do not repeat the title in the alt text.
- **Modals/drawers** (planned): trap focus, return focus on close, and be dismissible with
  `Esc`.

---

## 7. Known gaps and follow-ups

| # | Gap | Action |
|---|-----|--------|
| 1 | Search input removes the default outline (`focus:outline-hidden`) | Add a visible focus ring or outline; verify against §4 |
| 2 | `text-dim` placeholders (~3.5:1 on the search field's `#1a1e2b` background) | Raise placeholder colour to ≥ 4.5:1, or accept only where non-essential |
| 3 | Progress bar has no ARIA roles/values yet | Add `role="progressbar"` + `aria-*` as in §6 |
| 4 | Working area lacks a `main` landmark | Add a `<main>` landmark; retain the existing `<header>` and `<footer>` elements |
| 5 | Library table rows not keyboard-navigable | Make rows focusable/navigable in Phase 2 |
| 6 | Reduced-motion not honoured | Add `prefers-reduced-motion` handling for spin/progress |
| 7 | Live announcements for scan/analysis | Add `aria-live` region with throttled updates |

These are tracked as UI work, not aspirational notes; each should land with the screen it
touches.

---

## 8. Testing checklist

Run before merging any UI change:

- [ ] Keyboard: complete the flow using only `Tab`/`Shift+Tab`/`Enter`/`Space`/`Esc`.
- [ ] Focus is always visible; nothing removes the outline without a replacement.
- [ ] Zoom/scale: at 150% OS text scaling, nothing clips or overlaps.
- [ ] Contrast: new colours meet the ratios in §2.
- [ ] Status: every status has an icon **and** a text label (not colour alone).
- [ ] Screen reader: landmarks, table headers, progress announcements are sane.
- [ ] Reduced motion: enable `prefers-reduced-motion` and confirm no essential motion.
- [ ] Errors: failure states explain what happened and how to recover.

Automated checks (axe / Lighthouse where applicable) supplement, never replace, the manual
checklist above.

---

*Accessibility regressions are bugs. Fix them in the PR that introduces them, and update
§7 when a gap is closed.*
