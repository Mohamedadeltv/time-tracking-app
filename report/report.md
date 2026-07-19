# Time Tracking Application — Project Report

**Author:** Mohamed Abouhitta
**Matriculation Number:** 119640

This is a time-tracking web application built with React 19, Spring Boot 3.5 on Java 21,
PostgreSQL 16, Docker, and GitHub Actions. The report below is a genuine look back at building
it with an AI-driven workflow: what went smoothly, where I had to step in, and what I'd have
missed without doing so. Every feature and fix mentioned links to its issue and pull request in
the appendix.

## 1. System Architecture and Design Decisions

**Overall shape.** The app is a monorepo: a React single-page frontend, a Spring Boot REST API
under `/api`, and PostgreSQL for storage. In production, Spring serves the pre-built frontend
directly out of its static resources, so the browser only ever talks to one origin — after
`docker compose up --build`, the whole app (frontend and API together) is reachable at
`http://localhost:8080`, with no separate frontend port or proxy container to run. The whole
thing ships as one app container plus one Postgres container via Docker Compose, wired together
with a healthcheck so the app doesn't start accepting traffic before the database is ready.

**Backend layering.** REST controllers per domain (`user`, `task`, `project`), Spring Data JPA
repositories, and a deliberately thin, mostly service-free style: controllers talk to
repositories directly for straightforward CRUD, and a helper class only gets pulled out where
there's real logic to isolate — `TimeRange`, for example, parses and validates the `from`/`to`
query parameters shared by both the overview and export endpoints, so that logic exists exactly
once.

**Alternatives considered and turned down.**

- **Database: PostgreSQL, not staying on H2 alone or reaching for MongoDB.** The data here is
  clearly relational — users, a self-referencing project hierarchy, tasks, and a many-to-many
  link between tasks and projects — which SQL and JPA model directly, so a document store never
  made sense. Postgres runs the real deployment because it's what production actually looks
  like; H2 (in `MODE=PostgreSQL`, for parity) stays in the test suite purely for speed, so tests
  don't need a real database process to run.
- **Auth: server-side sessions with BCrypt, not JWTs.** The app has no mobile client and no
  cross-origin API consumer, so a stateful session avoids token-refresh and client-side storage
  concerns for no real benefit. Spring Security's session handling plus BCrypt hashing covers
  the assignment's "safe authentication method" requirement directly.
- **Export: both CSV and JSON, not picking one.** The assignment left the concrete format open.
  Rather than commit to a single one, the export endpoint takes a `format` parameter and builds
  either from the same row model, since generating both from one internal representation cost
  almost nothing extra and covers more real-world spreadsheet-vs-scripting use cases. `.xlsx`
  was skipped — it needs a spreadsheet-writing dependency for a feature whose whole point is
  plain interoperability.
- **Spring Boot 3.5.x, not 4.x.** 4.x modularized the jars and moved test packages in a way that
  broke `@WebMvcTest`. Pinning 3.5.15 for the whole project avoided fighting that mid-build for
  no functional gain.

**Timestamps are stored in UTC and shown per viewer.** Every task's start/end time is a UTC
`Instant` in the database. A user's preferred IANA timezone is purely a display and input
concern, applied only when parsing a `datetime-local` form value or formatting a timestamp for
display — isolated in `frontend/src/utils/timezone.ts` as pure functions rather than scattered
through components. The same idea is meant to carry through to the CSV/JSON export, resolving
each row's timestamp in the exporting user's zone — this boundary is exactly where two real bugs
slipped through, covered in §6.

**Project hierarchy and roll-up.** A project's total is the tracked time of its own tasks plus
all descendant subprojects, with a task counted once even if it's tagged to two subprojects of
the same parent. This is implemented by resolving a project's full subtree into a
`Set<Project>` and querying tasks with `findDistinctByProjectsIn(subtree)` — the `Set` and
`DISTINCT` make the dedup automatic rather than something that had to be special-cased in
application code.

**Testing strategy.** Testing runs at three levels, matching the tools locked in `CLAUDE.md`:
JUnit 5 with MockMvc and Spring Boot Test against the H2 in-memory database for backend
unit/integration tests, Vitest with React Testing Library for frontend component tests, and
Playwright 1.5x driving actual **Firefox** — the graders' browser — against the fully
Docker-Composed stack for system tests, not a dev server. JaCoCo gates backend coverage;
current line coverage sits at ~98% backend, ~96.5% frontend, both above the assignment's 90%
line-coverage floor. Eleven Playwright spec files cover every mandatory feature plus all three
custom features. Two decisions here weren't obvious upfront: the timezone E2E tests had to be
rewritten to pin Playwright's simulated browser OS timezone away from the user's app-preferred
timezone (`test.use({ timezoneId: 'America/New_York' })`), specifically so a regression can't
hide behind the CI host happening to already run in UTC; and CI itself runs on a self-hosted
runner rather than `ubuntu-latest`, not by choice but because this GitHub Classroom org's
billing blocks GitHub-hosted Actions minutes entirely (§6).

## 2. The Application, Feature by Feature

The base application is a full time-tracking system, built one requirement at a time; the
appendix lists the issue and PR behind each. Grouped by area:

- **Accounts and sessions** (issue #1) — registration, login, logout, change password, BCrypt
  hashing, server-side sessions.
- **Time tracking** (issue #2) — starting a task writes its start `Instant` to the database
  immediately; the client never runs its own timer. Elapsed time is always
  `now - startTime`, recomputed wherever it's displayed, so the running task's state was never
  anywhere but the database and there's nothing to "recover" after a restart.
- **Manual task CRUD** (issue #3) — add, edit, and delete tasks with explicit start/end times,
  for the case where the user forgot to start tracking live.
- **Projects and hierarchy** (issues #4, #5) — projects nested arbitrarily deep, a task
  associable with one or more projects, and the subtree-dedup roll-up described in §1.
- **Overviews** (issue #6) — per-project task lists including subprojects, totals over a
  user-selectable range, and current day/week/month views, backed by the same `TimeRange`
  helper the export endpoint reuses.

**The required Part II features.**

- **Project sharing** (issue #17) — a `ProjectMember` join entity (`OWNER`/`MEMBER` role); only
  members can see or add tasks to a project; the owner invites and removes members by email.
- **Task overview for shared projects** (issue #18, completed via issue #30) — the overview
  endpoint accepts an optional `userId` filter so totals can be scoped to one collaborator
  instead of everyone on the project, without leaving the mandatory "everyone combined" view.
- **Export** (issue #19) — CSV/JSON download of a project's tasks (and its subprojects'),
  scoped to a specific month or the whole project, each row listing start/end time, the
  associated (sub-)projects, and the owning user.
- **Preferred time zone** (issue #20) — every user can set an IANA timezone; new tasks default
  to it, and it governs how existing tasks are displayed.

## 3. Custom Features

As a Master's submission the project adds three extra functional features, each fitted into
the existing model rather than bolted on:

- **Time budget goals per project** (issue #21, PR #25) — a project can carry an optional
  `budgetHours` target, and the overview shows progress against it. Budgets roll up through the
  exact same subtree-dedup query as the mandatory time totals (§1), so a project's progress can
  never drift out of sync with how its time is actually aggregated.
- **Task tags/labels** (issue #26, PR #28) — free-form, comma-separated tags on tasks, filterable
  in the task list and included in exports. A small, low-risk way to let users organize tasks
  orthogonally to the project hierarchy without touching the core time-tracking model.
- **Personal daily/weekly time goals** (issue #27, PR #29) — a user-level goal, separate from any
  project's budget, so someone tracking time across several unrelated projects can still see
  whether they're hitting a personal target that no single project's budget would capture.

## 4. Used LLMs and AI-based Tools

The only AI tool used was **Claude Code** (Anthropic), run as an agentic pair programmer
directly in the terminal for effectively the entire development lifecycle. The underlying model
changed as the project ran over roughly a month — earlier sessions used Claude Sonnet 4.6, later
sessions (all of Part II, and this report) used Claude Sonnet 5, both visible in the
`Co-Authored-By` trailers across the git history.

**How it was prompted.** Almost nothing was prompted line-by-line. Each requirement went in as a
plain-language instruction — a feature to build, a bug to chase, or, most often, a deliberately
open-ended check like "is everything working, is anything missing" with no further detail. That
last style turned out to be the most useful prompt in the whole project: a narrow "did you build
X" question only ever gets a narrow answer, while an unscoped audit forces the agent to re-derive
the actual state of the repository against the requirement text instead of reciting what it
remembers building — which is exactly what surfaced both real bugs in §6. The agent had direct
tool access (a shell, file edit/read, and the `git`/`gh` CLIs) rather than being limited to
suggesting code for me to paste in, so a single prompt could run all the way to a merged,
CI-verified pull request without a human relay step in between.

**A repository context file, and why it mattered.** Every new session starts the agent cold,
with no memory of the previous one. Left alone, that's how a project drifts into inconsistency
— a fresh session re-deriving its own slightly different structure each time. To avoid that I
kept a `CLAUDE.md` at the root of the repo: the locked technical decisions (framework versions,
"never `mvn`, always `./mvnw`"), the process rules that are actually graded (one issue per
requirement, one branch and PR per issue, ≥90% coverage), the project timeline, and a standing
instruction to work autonomously in numbered phases and only stop for a genuine design fork or a
destructive action. That file is my own authorship, written and revised across the project, and
it's what kept a month of sessions spanning two requirement updates consistent instead of
reinventing conventions each time.

**This was not a hands-off process.** The agent drove implementation and ran its own build,
test, and `git`/`gh` commands, but the debugging loop had me in it at points that mattered more
than any single commit:

- **I ran the app myself, and found real bugs the agent's own review missed.** The timezone
  preference field being a free-text input instead of a dropdown ("hard to write and pick")
  only became obvious by trying to actually use it. The CSV/JSON export silently ignoring the
  preferred timezone entirely was something I noticed by exporting my own data and looking at
  the timestamps, not something any automated check had flagged. Both became their own issue
  and PR (#34/#35, #36/#37) only because I reported the concrete symptom first.
- **I hit and diagnosed real environment problems the agent had no way to see coming.** A
  Postgres port clash with a native Postgres.app install already running on my machine, and
  later the Docker daemon simply not running when I tried to start the stack myself — both
  needed me to report the exact error before either could be fixed.
- **I was the one who could actually fix CI when it mattered.** When the self-hosted runner went
  offline, the agent's first fix — switching to GitHub-hosted runners — was wrong for a reason
  only visible from outside the repository: this org's billing blocks GitHub-hosted Actions
  minutes entirely. Restarting the actual runner meant going to infrastructure the agent has no
  access to at all.
- **I reviewed every PR before merging** and decided, case by case, whether a finding was worth
  a full issue/PR cycle or a direct fix, including the scope and content of this report through
  several rounds of edits.

## 5. Where the AI Tools Worked Well

**Whole vertical slices in one pass, including the edge case that mattered.** For the project
hierarchy roll-up, the agent picked the "task in two subprojects of the same parent counts
once" rule directly out of the spec text and wrote a test for exactly that case without it being
pointed out separately — it treated the requirement's own worked example as a test case, not
just prose to satisfy.

**Open-ended audits that actually found things.** More than once I just asked "is everything
working, is anything missing," with no specifics. Rather than summarizing what it remembered
building, the agent re-read the actual requirement PDFs against the running code and turned up
genuine, previously unnoticed gaps. Re-deriving from the source text instead of trusting its own
prior "done" status is what actually caught them.

**Refusing to trust its own green tests as proof of anything.** Before calling a PR finished,
the agent would build and run the full stack locally with `docker compose up` and exercise the
feature through the real Firefox E2E suite, not just unit tests. The export timezone fix was
verified by literally `curl`-ing the running container and inspecting the response bytes, not
by re-reading the code that had just been written.

**Consistent process discipline at real scale.** Every one of the roughly twenty issues in this
project went through the same issue → branch → implement → test → PR → CI → merge cycle, with
PR descriptions and commit messages that explained the *why* rather than restating the diff.
That consistency held whether the change was a full feature or a one-line config fix, which is
exactly what made the git history usable for writing this report at all.

## 6. Where the AI Tools Did Not Work as Intended

Two kinds of failure kept showing up. The first was code that passed its own tests but had
problems that only surfaced once the real application ran. The second was a fix scoped too
narrowly — solving one instance of a bug without checking whether the same mistake existed
elsewhere. The fix that consistently worked for both was the same: stop trusting green tests,
and drive the actual running stack.

- **The timezone default bug hid behind the tests written to catch it.** "Creating a new task
  should use this timezone by default" technically ran and passed every test on the first
  attempt, but parsed and formatted `datetime-local` inputs using the *browser's* OS timezone
  instead of the user's saved app preference. It passed because the E2E tests themselves filled
  in the form using that same wrong browser-zone helper, so the bug was invisible to the exact
  suite meant to catch it. It only surfaced when I asked for a full requirements audit and the
  agent re-read the spec word-for-word against the code instead of trusting the existing green
  pipeline. The fix had to rewrite the E2E tests to pin Playwright's simulated browser timezone
  *away* from the app-preferred one, specifically so they could no longer pass by coincidence
  (issue #32, PR #33).
- **The same mistake reappeared where the first audit hadn't looked — and I found it, not the
  agent.** The export endpoint formatted every timestamp with a plain `Instant.toString()` —
  always UTC, never touching the user's preferred zone at all. I found this myself by exporting
  my own tasks and noticing the timestamps were wrong. The earlier audit had reasoned about the
  *display* code paths and never checked the separate export code path for the identical
  mistake (issue #36, PR #37).
- **It reached for the textbook fix before checking why the odd choice existed in the first
  place.** When the self-hosted CI runner went offline and jobs sat queued for 15+ minutes, the
  agent's first move was switching CI to GitHub-hosted `ubuntu-latest` runners — the normal
  fix. That failed immediately for an unrelated reason: this org's billing blocks GitHub-hosted
  Actions minutes entirely, which is *why* the project was on a self-hosted runner to begin with
  (visible in an old commit message earlier in the project's history). It had to recognize the
  new failure, trace it back to that earlier decision, revert its own change, and fall back to
  asking me to restart the actual runner instead of re-solving an already-solved problem
  (issue #38).
- **Flakiness that took two full runs to even confirm as real.** Two frontend tests
  intermittently exceeded Vitest's default five-second timeout, but only inside the full
  coverage suite, never standalone. It took repeating the full run before treating it as a
  reproducible bug rather than a one-off, before fixing it by raising the global test timeout.
- **Small environment gotchas that cost real time.** macOS's default bash (3.2) breaks on
  heredocs inside `$(...)` command substitution once the content has an apostrophe in it, which
  bit multi-line `gh pr create` bodies more than once before settling on always writing the body
  to a temp file and passing `--body-file`. Separately, Maven's incremental compiler
  occasionally reused stale `.class` files after an edit, silently succeeding against old code
  until `./mvnw clean test` replaced `./mvnw test` as the default.

## Appendix: Traceability (Issues and Pull Requests)

Every requirement and bug fix was tracked as a GitHub issue and delivered by at least one linked
pull request.

**Part I, base application**

| Title | Issue | PR(s) |
|---|---|---|
| User management: register, log in, log out, change password | [#1](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/1) | [#9](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/9) |
| Time tracking: start and stop tracking a task | [#2](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/2) | [#10](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/10) |
| Tasks: add, edit, and delete tracked tasks manually | [#3](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/3) | [#11](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/11), [#12](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/12) |
| Projects: create projects and assign tasks to one or more | [#4](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/4) | [#12](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/12) |
| Project hierarchy: subprojects and aggregated time roll-up | [#5](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/5) | [#13](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/13) |
| Overviews: per-project task lists and day/week/month views | [#6](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/6) | [#14](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/14) |
| Setup: walking skeleton (backend, frontend, Postgres) and CI pipeline | [#7](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/7) | [#8](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/8) |

**Part II, additional features (required)**

| Title | Issue | PR(s) |
|---|---|---|
| Project sharing: invite users to collaborate on a project | [#17](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/17) | [#22](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/22) |
| Shared project overview: cross-user totals and per-user filter | [#18](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/18) | [#22](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/22), [#31](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/31) |
| Export: download project tasks as JSON/CSV | [#19](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/19) | [#23](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/23) |
| Time zones: per-user preferred timezone | [#20](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/20) | [#24](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/24) |

**Custom features**

| Title | Issue | PR(s) |
|---|---|---|
| Time budget goals per project | [#21](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/21) | [#25](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/25) |
| Task tags/labels | [#26](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/26) | [#28](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/28) |
| Personal daily/weekly time goals | [#27](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/27) | [#29](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/29) |

**Bugs and later fixes (filed and fixed during development)**

| Title | Issue | PR(s) |
|---|---|---|
| Overview: per-user filter UI missing; no system tests for sharing/export/timezones | [#30](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/30) | [#31](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/31) |
| Task creation/editing uses browser timezone instead of user's preferred timezone | [#32](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/32) | [#33](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/33) |
| Timezone preference: replace free-text input with a dropdown | [#34](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/34) | [#35](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/35) |
| Export: task timestamps are not formatted in the user's preferred timezone | [#36](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/36) | [#37](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/37) |
| CI: self-hosted runner unreliable/offline | [#38](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/issues/38) | none in code — this org's billing blocks GitHub-hosted Actions runners entirely, so the only real fix was restarting the self-hosted runner; an attempted switch to hosted runners ([#39](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/39)) was reverted once that became clear |
