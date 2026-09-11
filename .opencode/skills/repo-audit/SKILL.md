---
name: repo-audit
description: Audit, fix, and verify a cloned GitHub repository end to end. Use when the user shares a GitHub URL and says check/review/fix/audit a repo, wants a third-party project cloned and reviewed, or wants a security/quality pass plus verified fixes on any codebase.
---

# Repo Audit & Fix Workflow

Run a full clone → review → fix → verify cycle on a repository the user has
never vetted, producing a concise findings report and optional, verified
fixes. This encodes how the youtube-automation-agent audit was done.

## Workflow

### 1. Fetch the repo overview first
- Fetch the GitHub URL (e.g. `https://github.com/owner/repo`).
- Report in 3-6 lines: what it is, license, star/fork counts, and the "what's
  new" highlights. Then ask what the user wants: clone it, clone+run setup,
  review only, or all of it. Offer the choice with the `question` tool.

### 2. Clone and install
- Clone into the current workspace: `git clone <url>`.
- Confirm the clone with `git log --oneline -5` and `git status`.
- Install dependencies. On Windows PowerShell:
  - `npm` may fail with "running scripts is disabled" → use `npm.cmd` instead.
  - npm 11's `allow-scripts` feature silently skips postinstall scripts for
    packages like `sqlite3`, `sharp`, `ffmpeg-static`, `@google/genai`,
    `protobufjs`. After install, CHECK native bindings exist; if missing, run
    the package's install script manually (e.g. in `node_modules/sqlite3`:
    `node ..\prebuild-install\bin.js -r napi`, and in `sharp`:
    `node install/check`). ffmpeg-static's own `node install.js` downloads the
    binary.
- Verify native modules load: `node -e "require('<mod>')"` for each (sqlite3,
  sharp, ffmpeg-static). Do NOT assume `npm install` output means it works.
- Note `npm audit` findings in the report (counts + severity).

### 3. Deep review (parallelize)
- Launch an `explore` subagent for a thorough code review while you read the
  entry points yourself (`package.json`, `index.js`/main file, configs).
- Ask the review for: architecture/pipeline flow, code-quality bugs, security
  concerns (hardcoded secrets, injection, unsafe paths, auth holes, OAuth
  handling), what `npm test` actually covers and whether it passes, runtime
  red flags, and DB/schema handling.
- Independently verify suspicious claims with grep/read — review agents can
  misattribute line numbers.
- Read `.env.example`, `.gitignore`, CI workflows, and config files to catch
  dead code, fake model names, and broken references.

### 4. Report findings
- Give a tight, prioritized summary grouped by: Architecture (solid parts),
  Real issues (bugs, crashes), Security, Runtime red flags.
- Do NOT start editing yet. Ask which fixes to apply with the `question` tool
  (multi-select). Offer a "fix all" path.

### 5. Apply fixes
- Follow repo conventions: match existing code style, don't add comments
  unless the file already uses them, never add new dependencies unless
  required.
- Keep changes minimal and targeted. When deleting dead files (e.g. unused
  OAuth servers, broken MCP configs), grep first to confirm nothing imports
  them.
- Prefer localized, self-healing fixes (e.g. make the logger create its own
  `logs/` dir and swallow transport errors instead of patching callers).
- For security: constant-time secret comparisons must guard buffer-length
  mismatch before `timingSafeEqual`, or tests that send a wrong-length key
  will throw.

### 6. Verify (never skip)
- Syntax/load check: `node -e "require('<each edited module>')"`.
- Lint: `npm.cmd run lint` (or the project's command); fix what it catches.
- Tests: `npm.cmd test` (or the project's test command) — run the FULL suite,
  not a subset. Iterate until green.
- Boot check: start the server (`Start-Process node index.js`), poll its
  health endpoint, exercise a protected route with and without credentials
  when applicable, then kill it. Use `-WorkingDirectory` for Start-Process.
- Report exact commands run and their results.

### 7. Commit only when asked
- Never commit unless the user explicitly says so.
- When committing: review `git status`/`git diff`, stage only intended files,
  match the repo's commit message style, never commit secrets.
