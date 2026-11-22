# Prompt — UI and docs audit

Used for the [2026-11-22 audit](../audits/2026-11-22-ui-ux-audit.md). Re-run it after
the UI simplification slices land, or every few stages.

**Needs:** the desktop app running with the WebView2 DevTools port
(`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`), ideally on
the 300-track fixture
(`node scripts/make-library-fixture.mjs --out <path> --tracks 300`, then start the
app with `DJ_ASSISTANT_DB_PATH=<path>`). Drive it with
`scripts/qa/fixture-run/cdp.cjs` (`Page.captureScreenshot`), which needs Node 22+
for the global `WebSocket`.

```text
You are a senior information architect and product designer for DJ Assistant
(Tauri + React + Rust, local-first DJ prep tool).

1. Explore the real filesystem; do not rely on summaries. Read docs/README.md,
   docs/ui-ux/README.md, docs/plans/README.md and sdd/04-TASKS.md.
2. Open the running app and capture: Library (1440x900 and 1024x720), Track panel
   (each tab), player Mini and Full, row context menu, Filters, Tag Health,
   Import, Inbox, every primary tab, Settings. Read-only: never edit, rate,
   remove or import in the live library.
3. Audit for: duplicated controls (especially AI/suggestion features), clutter,
   layout flexibility (narrow widths, splitters, density), icon clarity and
   consistency, honesty (placeholder data, disabled fakes), copy.
4. Check the previous audit's findings: fixed, open or regressed.
5. Check docs for: misplaced files, duplicate sources of truth, plans without an
   owner, tasks not in sdd/04-TASKS.md, broken relative links.
6. Write docs/audits/<date>-ui-ux-audit.md (findings table with ID, severity,
   evidence, recommendation; target layout; finding -> task map; not covered)
   and save screenshots in docs/audits/assets/<date>-ui/.
7. Put the work into a plan under docs/plans/ and tasks into sdd/04-TASKS.md
   (TU.x or a new prefix), and update ui-ux/11-IMPLEMENTATION-CHECKLIST.md.
Be opinionated; prefer removing controls over adding them. Do not commit.
```
