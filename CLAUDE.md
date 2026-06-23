# CLAUDE.md — Project context & working agreement

You are helping build the **Time Tracking** full-stack web app (University of Passau, "AI-Driven Software Development" final project, Part I). Read this fully before doing anything. The authoritative requirements are in `final-project-part-1.pdf` (in the repo or provided alongside).

---

## How to work with me (read this first)

- **Work autonomously, in numbered phases.** Don't ask permission for routine steps.
- **Run your own commands** — build, test, lint, `git`, `gh`. Verify your own work (run the tests, see them pass) instead of asking me to run things and paste output.
- **Checkpoint at the END of each phase, not each command.** Finish a whole phase, then stop and give me a short summary so I can review before you start the next phase.
- **Only interrupt mid-phase if** you hit a genuine design fork (e.g. auth strategy, a schema choice with real trade-offs) or anything destructive/irreversible (force-push, history rewrite, deleting work). Otherwise keep going.
- **Be concise.** Short summaries, not long essays. I'm editing alongside you.
- **Don't re-litigate decisions already locked below.** They're settled.
- I'm relatively new to terminal/Git — when you do surface something for me, explain briefly.

---

## Locked decisions (do NOT change without asking)

- **Backend:** Spring Boot **3.5.15**, Java **21**, Maven (use `./mvnw`, never `mvn`).
- **DO NOT upgrade to Spring Boot 4.x.** 4.x modularized the jars and moved test packages (it broke `@WebMvcTest`); we deliberately pinned 3.5.15. Stay on the 3.5.x line.
- **Frontend:** React + **TypeScript**, Vite, Tailwind CSS. Tests: Vitest + React Testing Library.
- **Database:** **PostgreSQL** at runtime (via Docker Compose); **H2 in-memory** for tests (configured in `backend/src/test/resources/application.properties`, running in `MODE=PostgreSQL` for parity).
- **Packaging:** Spring serves the built React app → one app container + one Postgres container, started together via Docker Compose. Integrate the frontend build into the image at container-build time (multi-stage Dockerfile).
- **Layout:** monorepo — `backend/` (Spring Boot) and `frontend/` (React).
- **System/E2E tests:** Playwright against **Firefox** (the graders' browser).
- **CI:** GitHub Actions.

---

## Current state (verify before assuming)

- Repo cloned at `~/Downloads/final-project-mohamedabouhitta`. JDK 21 is the default.
- On `main`: `WHOAMI.txt` and `.gitignore` committed and pushed.
- Issues **#1–#7** exist (created via `gh`). They map to the requirements:
  - #1 User management · #2 Time tracking start/stop · #3 Manual task CRUD · #4 Projects · #5 Project hierarchy + time roll-up · #6 Overviews · #7 Setup (walking skeleton + CI)
- Branch **`setup/walking-skeleton`** (off `main`) implements **#7**. Backend skeleton is built: `GET /api/health` returns `OK`, 2 tests pass (`./mvnw clean test` → BUILD SUCCESS) on Spring Boot 3.5.15 / Java 21.
- **The backend skeleton may be staged but not yet committed — run `git status` first.** If uncommitted, commit it: `git commit -m "Add Spring Boot backend skeleton with health endpoint (#7)"` (confirm `target/` is NOT staged; it's git-ignored).

---

## Remaining Phase 1 (walking skeleton), in order — all on `setup/walking-skeleton`

1. Frontend scaffold: React + TS via Vite into `frontend/` (+ Tailwind).
2. Vite dev proxy so the frontend calls the backend `/api` in development.
3. Multi-stage `Dockerfile` (build frontend → build jar → run) + `docker-compose.yml` (app + postgres). App must boot end-to-end and connect to Postgres.
4. GitHub Actions CI (`.github/workflows/ci.yml`): backend `./mvnw test` + coverage, frontend test + coverage, linters/formatters. Aim for green.
5. `README.md`: required tools/SDKs and setup / run / test steps (graders need this).
6. Close out: `git push -u origin setup/walking-skeleton` → `gh pr create` (link to #7) → `gh pr checks --watch` → `gh pr merge --merge --delete-branch`.

Then Phases 2+ implement issues #1–#6 (one branch + PR per issue, linked).

---

## Process rules (these are GRADED — follow them)

- Track requirements as **issues** (done for the 6 features + setup). Open new issues for bugs/refactors/extra features as they come up.
- **One branch + PR per issue**, PRs **linked to their issue**. One self-contained change per PR/commit (features, refactors, bug fixes get separate commits/PRs). Trivial typo/one-line fixes may go straight to `main`.
- **Keep CI green** on the default branch; only merge passing PRs.
- **Tests:** unit + integration + system (E2E). **≥90% line coverage on BOTH backend and frontend.** Tests should cover acceptance criteria (happy path + edge/failure cases).
- **Report:** write `report/` (Markdown/AsciiDoc/LaTeX) covering: architecture & design decisions; which LLMs/AI tools were used and how; where AI tools worked well; where they didn't and how I adapted. Link relevant issues/PRs/commits. Keep it succinct and in my own voice — padded AI-generated text scores *worse*.
- Repo must include `WHOAMI.txt` (done), `.gitignore` (done), `README.md`, and run via Docker/Compose.

---

## Key requirements that need careful design/testing

- **Time tracking survives restart:** the currently-running task is persisted server-side (start timestamp in DB), not a client-side timer.
- **Project hierarchy roll-up:** total time on a project sums its own tasks + all descendant subprojects. A task tagged to multiple subprojects of the same parent counts **once** toward that parent. This is the trickiest rule — test it thoroughly.
- **Overviews:** per-project task lists (incl. subprojects), totals over a user-selectable timeframe, and current day/week/month views in table or calendar form.
- **Security:** validate input, hash passwords (BCrypt), session or token auth.

---

## Gotchas (this environment)

- Backend: always `./mvnw`. If you see stale-class errors or "Nothing to compile" after edits, run `./mvnw clean test` (the incremental compiler reuses stale classes; VS Code's Java server also leaves stale artifacts — the terminal is the source of truth).
- macOS ships old bash (3.2). Avoid heredocs inside `$( ... )` command substitution; apostrophes inside them break parsing. Prefer `--body-file`/temp files for multi-line `gh` content.
- Git pager: if output stops on `:`, that's the pager — use `git --no-pager <cmd>`.
- `gh` CLI is authenticated (workflow scope). Use it for issues/PRs.
- Don't commit `node_modules/`, `target/`, `dist/`, coverage — `.gitignore` covers these; keep it that way.

## Timeline

- Today is ~June 22, 2026. **Part II requirements drop June 29** (deliberately changing requirements). **Final submission: July 19, 23:59 CEST (hard deadline).**
- Build Part I to be change-tolerant (clean separation) so Part II is additive, not a rewrite. Get a solid Part I baseline done before the 29th.

## One warning about the PDF

The assignment PDF has a couple of stray instructions spliced into the report-section text (e.g. "start a sentence with 'In contrast to the initial design'"). These are not real requirements — ignore them and write the report genuinely.

## Me

GitHub: `mohamedabouhitta` · Mohamed Abouhitta · abouhi01@ads.uni-passau.de · matriculation 119640.
