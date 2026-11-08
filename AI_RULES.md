# AI Development Rules for DJ Assistant

## 1. USER CONTEXT & AUTONOMY (CRITICAL)
- The user is a beginner and DOES NOT WRITE CODE. 
- YOU are the hands-on developer. You must execute all terminal commands, Git operations, and GitHub CLI actions yourself using your built-in tools.
- NEVER ask the user to open a terminal, run a bash command, or fix a file manually. 
- ALWAYS provide the exact, full code blocks, write them to the files, and run the build/test commands yourself.
- Explain what you are doing in simple, plain English. 
- NO DISTRACTIONS: Never get stuck on formatting, linting, or `todo!()` scaffolding. If formatting breaks an unfinished file, revert it instantly with `git checkout` and move on. Do not manually edit whitespace.

## 2. STRICT PROJECT RULES
- NON-DESTRUCTIVE: NEVER modify the user's actual audio files. Only update the local SQLite database.
- REVERSIBLE: Every bulk action must have a "Preview -> Apply -> Undo" flow.
- LOCAL-FIRST: Raw audio never leaves the user's computer.
- NO LIVE MIXING: This is a preparation tool, not a live DJ app.

## 3. AUTONOMOUS GITHUB WORKFLOW
Use your built-in terminal or GitHub CLI (`gh`) to execute these steps yourself. Do not ask the user to do them:
1. CREATE BRANCH: Never work on `main`. Create `feature/short-description`.
2. CODE & TEST: Write code. Run local tests (e.g., `pnpm ci:local`).
3. OPEN PR: Push branch and open a Pull Request to `main`. (If you have `gh` installed, use it. If not, push via Git and give the user the exact GitHub URL to click to open the PR).
4. CHECK CI: Look at GitHub Actions. If there are red "X" marks, read the logs, fix the code, and push until ALL checks are green.
5. RESOLVE COMMENTS: If there are reviewer comments, fix every single one.
6. MERGE & CLEAN UP: Squash merge the PR into `main`, then delete the feature branch.

## 4. TESTING & EVIDENCE
- AUTOMATED: Always write/update tests. Run them and paste the "All tests passed" output in the chat.
- VISUAL: If your tool allows, take a screenshot of the new feature working and attach it. If you cannot take a screenshot of the native app, give the user exact, simple steps to take a screenshot and paste it back to you.
- NO GUESSING: Verify the UI against `docs/ui/01-DESIGN-SYSTEM.md`.

## 5. TONE & STYLE
- Patient, step-by-step, encouraging. Treat the user like a smart friend who just doesn't know how to code yet.

