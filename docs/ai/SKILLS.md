# Agent Skills — Installed Inventory

**Document type:** Reference for AI agents (and humans) working on DJ Assistant
**Status:** Living — last updated 2026-10-20
**Scope:** Machine-level OpenCode skills available to every session on this workstation

> The library lives **outside the repository**, in the machine-level OpenCode
> skills directory (`C:\Users\User\.config\opencode\skills`). A `.opencode/skills/`
> copy can be synced from it for local experiments, but that directory is
> **gitignored and eslint-ignored** — it is machine-local, and collaborators and
> CI do not receive it. Nothing in the project build, test, or CI pipeline
> depends on either location.
>
> **Total installed: 240** — 18 pre-existing + 222 added on 2026-10-19.

**Not to be confused with** [`architecture/SKILLS_SYSTEM.md`](../architecture/SKILLS_SYSTEM.md),
which documents the *application's own* scoped-automation skills feature (a
product concept). This file is about the **OpenCode agent skills** the model
loads. For the agents, commands, and scripts that drive routing, see
[`AGENTS.md`](./AGENTS.md); for the generated priority tables, see
[`SKILL_ROUTING.md`](./SKILL_ROUTING.md).

---

## 1. How skills are used here

- Skills are advertised to the model by ID + description; the agent loads one
  with the `skill` tool, or you can force one from a prompt with `@skill-id`.
- Skills are **advisory technique, not project authority**. For anything UI-facing,
  [`docs/ui/01-DESIGN-SYSTEM.md`](../ui/01-DESIGN-SYSTEM.md) and the rest of
  [`docs/ui/`](../ui/README.md) remain the source of truth for DJ Assistant's
  tokens, components, and layout — a generic design skill never overrides them.
- Skills are additive: load the one that matches the task, ignore the rest.
- With 240 skills registered, prefer the **router skills** (`design`, `tauri`,
  `ios`) over loading families wholesale — they pick the 2–4 relevant skills.

---

## 2. Interface craft — `jakubkrehel/skills` (14)

Install source: <https://github.com/jakubkrehel/skills>

| Skill ID | When to use |
|----------|-------------|
| `better-interface` | Combined review pass across accessibility, layout, writing, typography, color, and UI polish |
| `better-ui` | Polish surfaces, icons, motion — radii, optical alignment, shadows, icon states, animation |
| `better-typography` | Type scale, spacing, font features, wrapping, truncation, punctuation |
| `better-colors` | Generate palettes, name semantic tokens, convert formats, measure contrast |
| `better-accessibility` | Keyboard/focus behavior, ARIA, accessible names, forms, screen-reader announcements, zoom — against WCAG 2.2 |
| `better-layout` | Grouping, alignment, reading order, responsive structure, translation room |
| `better-writing` | Interface copy: labels, errors, empty states, confirmations |
| `interface-review` | Review a branch / PR / uncommitted diff for interface regressions (user-invoked) |
| `explain-interface` | Explain how a site, visual effect, or animation was built from a live URL or screenshot (user-invoked) |
| `break` | Stress-test one component under every reachable state on a temporary page (user-invoked) |
| `state-machine` | Render every state of a component with mock data and a switcher (user-invoked) |
| `variant` | Build multiple variants of a component and iterate to a pick (user-invoked) |
| `build-design` | Build UI from a Figma file or design image using existing project tokens/components |
| `technical-drawing` | Precise static technical drawings of physical objects (SVG/PNG/PDF output) |

---

## 3. Design taste — `Leonxlnx/taste-skill` (8)

Install source: <https://github.com/Leonxlnx/taste-skill>

| Skill ID | When to use |
|----------|-------------|
| `taste-skill` (display name `design-taste-frontend`) | **Default skill.** Art direction for landing pages, product pages, dashboards, and app screens — deals researched directions, finds real imagery, inspects the result in a real browser and fixes slop. Use when a page looks generic, templated, or "AI-made" |
| `soft-skill` | Calm, polished UI: soft contrast, whitespace, spring motion (opt-in) |
| `minimalist-skill` | Editorial product UI, restrained palette, crisp structure (opt-in) |
| `brutalist-skill` | Hard mechanical language: Swiss type, sharp contrast, experimental layout (opt-in) |
| `gpt-tasteskill` | Stricter variant for GPT/Codex models: more layout variance, stronger motion direction (opt-in) |
| `stitch-skill` | Rules for Google Stitch, optional `DESIGN.md` export (opt-in) |
| `taste-skill-v1` | The original pre-v2 version, kept for compatibility (opt-in) |
| `taste-skill-v2-experimental` | The single-file dial-driven rewrite that preceded v2 (opt-in) |

**Requirements for `taste-skill`:** Node 22+ and an installed Chrome, Edge, or
Chromium; internet access only for finding openly-licensed pictures. It installs
nothing and needs no API keys. A full build takes roughly 30–45 minutes.

**Scope note:** the classic skills above are opt-in — an agent should not pick
them on its own, only when explicitly named. The image-generation skills
(`imagegen-*`, `brandkit`, `image-to-code`) live in a separate repo
([Leonxlnx/imagegen-skills](https://github.com/Leonxlnx/imagegen-skills)) and are
**not** installed here.

---

## 4. Design system reference library — `jpoindexter/design-and-ai-skills` (39)

Install source: <https://github.com/jpoindexter/design-and-ai-skills> (`design-system-skills/`)

Reference-grade skills for **any screen: web, macOS/Windows desktop, mobile**,
current to WCAG 2.2, Material 3, Apple HIG, and W3C DTCG.

**Routers:** `design` (routes any cross-platform UI task to 2–4 companions) ·
`ios` (routes native iOS tasks).

**Foundations:** `design-tokens` · `typography-system` · `color-and-elevation` ·
`grid-and-spacing` · `iconography-and-imagery`

**Structure:** `atomic-design` · `layout-and-composition` · `components-and-states` ·
`design-system-governance` · `design-system-frameworks` (Material 3, Apple HIG,
**Windows 11 Fluent**, Carbon, Polaris, Primer, Ant, Spectrum; Tailwind, shadcn/ui,
Radix — adopt-vs-adapt decisions)

**Interaction:** `interaction-and-motion` (duration/easing tokens, choreography,
view transitions, reduced-motion) · `forms-and-data-entry` ·
`responsive-and-multi-device` · **`platform-conventions`** (iOS/Android/macOS/
**Windows 11 Fluent** conventions with concrete numbers — the most PC-relevant skill)

**UX & inclusion:** `usability-heuristics` (Nielsen/Norman/Shneiderman/Rams) ·
`laws-of-ux-and-psychology` · `ux-writing-and-content` ·
`accessibility-and-inclusive-design` · `inclusive-design` ·
`information-architecture-and-navigation` · `data-visualization` ·
`ethical-design-and-dark-patterns` · `performance-and-perceived-speed` ·
`onboarding-and-empty-states` · `multimodal-voice-and-haptics` ·
`internationalization-and-localization` · `brand-identity-and-design-principles`

**Niche / off-desktop (installed as part of the library, rarely relevant here):**
`dense-no-scroll-layout` · `macro-food-app-ui` · the 9 `ios*` skills
(`ios`, `ios-color-and-materials`, `ios-components`, `ios-flows-and-patterns`,
`ios-layout-and-grid`, `ios-liquid-glass-swiftui`, `ios-sf-symbols-and-icons`,
`ios-typography`, `ios26-hig-patterns`).

---

## 5. UI/UX + animation trio — `mblode/agent-skills` (3)

Install source: <https://github.com/mblode/agent-skills>

| Skill ID | When to use |
|----------|-------------|
| `ui-design` | Visual direction, design-system extraction, Tailwind builds, screenshot→markup, dark mode, responsive, UX audits with a ship verdict |
| `ui-animation` | Springs, gestures, easing, scroll effects, curve-fitting from a screen recording, interface sound |
| `ui-verification` | Browser probes for focus, hit targets, overflow, themes, failed requests; before/after evidence |

---

## 6. Wireframing (1)

| Skill ID | Source | What it does |
|----------|--------|--------------|
| `wireframe` | [Magdoub/claude-wireframe-skill](https://github.com/Magdoub/claude-wireframe-skill) | Phase 1: 5 B&W wireframe options (1 safe + 4 exploratory) instantly; Phase 2: Clean + Polished color variants via parallel agents. Triggers: "wireframe", "prototype", "UX options", "layout exploration" |

Also available: `build-design` (§2, Figma/image → code) and `technical-drawing` (§2).

---

## 7. Desktop / PC application frameworks (72)

### Tauri v2 — `full-stack-skills/tauri-skills` (52)

Deep per-topic skills for this project's framework. **Router:** `tauri` (indexes
the rest). Core topics: `tauri-concept`, `tauri-ipc`, `tauri-config`,
`tauri-security`, `tauri-framework-security`, `tauri-window`,
`tauri-app-window-menu`, `tauri-app-system-tray`, `tauri-app-global-shortcut`,
`tauri-app-dialog`, `tauri-app-file-system`, `tauri-app-store`, `tauri-app-sql`,
`tauri-app-notification`, `tauri-app-updater`, `tauri-app-shell`, `tauri-build`,
`tauri-scaffold`, `tauri-setup`, `tauri-app-develop`, plus ~30 more plugin-specific
skills (`tauri-app-*`: clipboard, positioner, single-instance, splashscreen,
sidecar, deep-linking, autostart, …).

> Note: the generic `tauri-v2` skill (earlier install) still exists; use either —
> `tauri` routes to the deep set for specifics.

### Electron — `full-stack-skills/electron-skills` (3)

`electron` (main/renderer/IPC/window) · `electron-egg` · `upgrade-link`

### Framework survey — `j4flmao/agent-skills` desktop bundle (10)

Renamed `desktop-*` to avoid ID collisions: `desktop-electron`, `desktop-tauri`,
`desktop-qt`, `desktop-gtk`, `desktop-wpf`, `desktop-uwp`, `desktop-winforms`,
`desktop-swiftui`, `desktop-appkit`, `desktop-gnome`
(`desktop-kde` and `desktop-winui3` are empty upstream and were skipped —
WinUI 3 is covered by Microsoft's skills below).

### WinUI 3 — `microsoft/winappCli` `winui` plugin (7)

Official Microsoft skills: `winui-design` (Fluent Design, XAML, x:Bind),
`winui-dev-workflow`, `winui-setup`, `winui-packaging` (MSIX/Store),
`winui-code-review`, `winui-ui-testing`, `winui-wpf-migration`.

---

## 8. Music & DJ skills (9) — added 2026-10-19, second batch

Directly relevant to DJ Assistant's domain (player, library, tags, beatgrid, analysis).

**Music analysis**

| Skill ID | Source | When to use |
|----------|--------|-------------|
| `music-analyzer` | [rtfirst/music-analyzer](https://github.com/rtfirst/music-analyzer) | Analyze audio files: genre, mood, instruments, **BPM, key**, lyrics. Pipeline: HDEMUCS vocal separation → Whisper transcription → librosa features, AI interprets raw data. *Python deps in `requirements.txt` (librosa, torch, whisper) — heavy; install only when invoked* |

**Library & tags**

| Skill ID | Source | When to use |
|----------|--------|-------------|
| `beets-music-library-manager-tagger` | [agentskillexchange/skills](https://github.com/agentskillexchange/skills) | Auto-tag with **beets + MusicBrainz**: import, organize, dedupe, query |
| `music-library-organizer` | [pvnkmnk/AgenticSelfHostSkills](https://github.com/pvnkmnk/AgenticSelfHostSkills) | Import/tag/organize files using beets; consistent folders + MusicBrainz metadata |
| `dj-library-curator` | same repo | Curate/tag DJ library: BPM analysis, key detection, genre tagging, crate/playlist creation |

**DJ workflows** (rekordbox/Serato/beatgrid)

| Skill ID | Source | When to use |
|----------|--------|-------------|
| `rekordbox` | [adamanz/rekordbox-skill](https://github.com/adamanz/rekordbox-skill) | Rekordbox library checks via pyrekordbox: USB exports missing **BPM/key/analysis**, recent tracks, playlist → CSV. *Needs Python + `pyrekordbox`* |
| `dj-library-organizer` | [gist @djhallaaaa](https://gist.github.com/djhallaaaa/cd68f7f3458384f43aea920c3793d2e5) | Organize rekordbox/Serato libraries by learning existing playlists/crates; parses ID3 (`TBPM`, `TKEY`, `TCON`), sorts by genre/BPM/vibe |
| `dj-set-architect` | pvnkmnk repo | Sequence sets: harmonic mixing, BPM flow, energy-curve planning → set plans/tracklists |
| `dj-mix-documentarian` | pvnkmnk repo | Document completed mixes: tracklists, timestamps, notes → Obsidian |

**Spectrum / waveform rendering**

| Skill ID | Source | When to use |
|----------|--------|-------------|
| `ffmpeg-waveforms-visualization` | [JosiahSiegel/claude-plugin-marketplace](https://github.com/JosiahSiegel/claude-plugin-marketplace) | ffmpeg-based **static/animated waveforms** (`showwaves`/`showwavespic`), **spectrum analyzers** (`showspectrum`), frequency bars (`showfreqs`), vectorscope, SoundCloud-style waveforms — images/videos, *not* realtime rendering |

**Known gaps (no skill exists — use code + references):**
- *Realtime spectrum in the app* → Web Audio `AnalyserNode` + canvas/WebGL; reference lib: [`harmonics-audio/fft-visualizer`](https://github.com/harmonics-audio/fft-visualizer) (single-shader WebGL FFT for React, 120 fps).
- *Music-player UI craft* → covered by `ui-design`, `ui-animation`, `better-ui`, `taste-skill` (§2/§3/§5).
- *Beatgrid computation engine* → tools, not skills: [`bvandrc/serato-tools`](https://github.com/bvandrc/serato-tools) (dynamic beatgrid read/write), [`8rian6/r2s-beatgrid`](https://github.com/8rian6/r2s-beatgrid) (Rekordbox→Serato grid transfer).

**Requirements note:** `music-analyzer`, `beets-*`, `music-library-organizer`, `rekordbox` shell out to Python tooling — each installs its own dependencies on first use. `dj-library-organizer` and `dj-mix-documentarian` are self-contained (the latter targets an Obsidian vault, only useful if one exists).

---

## 9. Application stack & technology (74) — added 2026-10-19, third batch

General software-stack coverage. Only the Rust/TypeScript/React items matter for
DJ Assistant itself; the rest are for side projects and server work.

**Docker — official `docker/skills` (5)**
`docker-project-foundations` (Dockerfile/compose/.dockerignore bootstrap) ·
`docker-build-strategies` (multi-stage, layer caching, image size, hardening) ·
`docker-compose-patterns` (services, health checks, volumes, dev overrides) ·
`docker-destructive-guardrails` (confirmation before prune/rm/wipe) ·
`docker-docs` (answers from current official docs)

**Database — `neondatabase/postgres-skills` (1)**
`postgres-best-practices` — schema design, indexing, query optimization,
migrations, pitfalls. Curated by Postgres core-team contributors.

**App development — `wshobson/agents` (13)**
`typescript-advanced-types` · `nodejs-backend-patterns` · `javascript-testing-patterns` ·
`modern-javascript-patterns` · `e2e-testing-patterns` (Playwright/Cypress) ·
`auth-implementation-patterns` (JWT/OAuth2/RBAC) · `debugging-strategies` ·
`git-advanced-workflows` · `error-handling-patterns` · `sql-optimization-patterns` ·
`code-review-excellence` · `monorepo-management` (Turborepo/Nx/pnpm) ·
`api-design-principles` (REST/GraphQL)

**React/Next ecosystem — `thongdn-it/react-agent-skills` (18)**
`react-best-practices`* · `nextjs` (App Router/caching) · `typescript` ·
`tailwind` (v4) · `shadcn` · `tanstack-query` · `zod` · `react-hook-form` ·
`nuqs` · `feature-arch` · `vercel-react-best-practices` ·
`vercel-composition-patterns` · `web-ui-design`* · `web-design-guidelines` ·
`playwright` · `vitest` · `msw` · `tdd`

\*Renamed to avoid overwriting existing skills: upstream `react` → `react-best-practices`
(your `react` is the json-render renderer), upstream `ui-design` → `web-ui-design`
(your `ui-design` is mblode's). The repo advertises 19 skills but ships 18
directories.

**Systems — `wshobson/agents` (3)**
`rust-async-patterns` (Tokio, async traits) ⭐ · `memory-safety-patterns` (RAII/
ownership across Rust/C++/C) · `go-concurrency-patterns`

**Python — `wshobson/agents` (17)**
`async-python-patterns` · `python-anti-patterns` · `python-background-jobs` ·
`python-code-style` · `python-configuration` · `python-design-patterns` ·
`python-error-handling` · `python-observability` · `python-packaging` ·
`python-performance-optimization` · `python-project-structure` ·
`python-resilience` · `python-resource-management` · `python-testing-patterns` ·
`python-type-safety` · `uv-package-manager` · `fastapi-templates`

**CI/CD + Kubernetes — `wshobson/agents` (8)**
`deployment-pipeline-design` · `github-actions-templates` · `gitlab-ci-patterns` ·
`secrets-management` · `k8s-manifest-generator` · `helm-chart-scaffolding` ·
`gitops-workflow` (ArgoCD/Flux) · `k8s-security-policies`

**AWS — `aws-samples/sample-agent-skills-for-builders` (9)**
`aws-mcp-setup` · `aws-cdk-development` · `create-install-scripts` ·
`cost-estimator` · `security-scan` · `api-gateway-authorizer-security` ·
`aws-cost-operations` · `aws-agentic-ai` (Bedrock AgentCore) · `end-to-end-testing`

> Overlap note: `e2e-testing-patterns` (wshobson), `playwright` (React set) and the
> existing `playwright-cli` all touch E2E testing — prefer `playwright-cli` for
> actually driving a browser, the others for test-design guidance.

---

## 10. Standalone design-system skills (2)

| Skill ID | Source | When to use |
|----------|--------|-------------|
| `carbon` | [iamursky/carbon-skill](https://github.com/iamursky/carbon-skill) | IBM Carbon Design System in depth: `@carbon/react`, web components, Sass theming, 2x Grid, v11 migration |
| `material-3` | [hamen/material-3-skill](https://github.com/hamen/material-3-skill) | Material Design 3 in depth: Jetpack Compose primary, Flutter and `@material/web` secondary |

Neither system is used by DJ Assistant (it has its own token set in
`docs/ui/01-DESIGN-SYSTEM.md`); these are for reference, comparison, or
non-project tasks. `design-system-frameworks` (§4) covers the survey level.

---

## 11. Previously installed global skills (18)

Already present in the same directory before 2026-10-19:

`3d-web-experience`, `ai-image-generation`, `brainstorming`, `devtools`,
`harness-writing`, `impeccable`, `nextjs-developer`, `prisma-client-api`,
`prisma-database-setup`, `prisma-orm-setup`, `react`, `rust-best-practices`,
`rust-call-graph`, `rust-code-navigator`, `rust-deps-visualizer`, `supabase`,
`upstash-redis-js`, `using-superpowers`.

Most relevant to this repo: `rust-best-practices` (Rust core/analysis crates),
`react` (desktop frontend), `impeccable` (UI polish passes), and `brainstorming`.

---

## 12. Maintenance

- Skills are plain `SKILL.md` directories; updating = re-copying the directory
  from the upstream repo. Installs are **not** automated; the inventory and audit
  are.
- A local mirror under `.opencode/skills/` **overrides** the global skill of the
  same ID (`scripts/skills/lib.mjs` defines the source order, and `skills:audit`
  treats that expected shadowing as a mirror rather than a collision). Because it
  is gitignored, it is invisible to every other machine. To add or remove a
  skill, edit the global directory — and if edits there appear to be ignored,
  check for a stale `.opencode/skills/` copy shadowing them.
- If a skill stops appearing, check its frontmatter `description`, its
  `metadata.opencode/autoinvoke` flag, and the agent's `skill` permission first.
- The project keeps a routing policy in `skills.policy.json` and a generated
  summary in [`SKILL_ROUTING.md`](./SKILL_ROUTING.md). The tooling lives in
  `scripts/skills/` and is exposed as `pnpm skills:*`.

| Command | What it does |
|---------|--------------|
| `pnpm skills:inventory` | Rebuild `.opencode/skill-manifest.json` and `SKILL_ROUTING.md` from what is installed. |
| `pnpm skills:match "<task>"` | Score a prompt against every skill; `--cold-only`, `--json`, `--top N`. |
| `pnpm skills:audit` | Integrity, duplicate, and curation report (exits non-zero on hard problems). |
| `pnpm skills:policy` | Dry-run report of the hot/cold split (informational). |
| `pnpm skills:policy:restore` | Remove any `autoinvoke` flags the policy manages. |

- **Prompt-weight:** all 240 skills are advertised on every step. Hiding is not
  used because a hidden skill is **not loadable** in this environment (see §13),
  so the full library's descriptions are always in play. Prune installed skills
  if that context cost becomes a problem.

---

## 13. Routing & automation

The library is large, so the project keeps a curated priority set and matches the
rest to the task on demand.

**Everything stays advertised.** Every installed skill is visible to the model.
This environment will **not** load a skill that has been hidden from the list —
`metadata.opencode/autoinvoke: false` makes a skill unloadable, not merely
unlisted — so nothing is hidden. `skills.policy.json` `hot` is the **priority**
set (workflow, UI craft, Rust, Tauri, React/TS, API, Python tooling, the DJ
domain, CI): the skills to reach for first and the bias for the matcher. It is a
ranking, not a visibility filter. **Never run `pnpm skills:policy --apply`** — it
is guarded and refuses without `--force`.

**Routing.** Before a non-trivial task, match it and load the winners:

```bash
node scripts/skills/match.mjs --top 3 "<task summary>"
```

The matcher combines hand-curated `triggers` (project vocabulary → skills) with a
BM25-flavoured lexical score over every skill description.

**Entry points.**

| Thing | Use |
|-------|-----|
| `/skills <task>` | Match the task and load the best-matching skills, then do it. |
| `/skills-audit` | Run the `skill-maintainer` subagent: inventory + audit report. |
| `skill-router` subagent | Return the skill IDs a task should load (without doing the task). |
| `skill-maintainer` subagent | Regenerate the inventory and audit the library. |
| `AGENTS.md` | Project instructions; contains the routing workflow every session sees. |

> Project-local plugins under `.opencode/plugins/` are **not** used: a plugin in
> that directory currently causes OpenCode to drop the discovered skills from the
> model list. Routing therefore runs through instructions, commands, and
> subagents instead.
