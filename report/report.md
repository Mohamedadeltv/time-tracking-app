# Part I Report — Time Tracking App

**Mohamed Abouhitta · 119640 · abouhi01@ads.uni-passau.de**

---

## Architecture and Design Decisions

The app is a standard monorepo with a Spring Boot backend and a React/Vite/Tailwind frontend. Spring serves the built frontend as static files, so there is one deployable unit (one app container + one Postgres container via Docker Compose). This keeps deployment simple and avoids a separate reverse proxy.

**Authentication** is session-based (Spring Security + BCrypt). I chose sessions over JWT because they are simpler to implement securely without a token refresh mechanism, and the graders run the app locally where session stickiness is not a concern.

**Time tracking persistence.** The running task's start timestamp is stored in the database, not held in memory or the client. If the server restarts mid-session the timer survives. The current-task endpoint reads the DB directly (PR [#10](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/10)).

**Project hierarchy and roll-up.** Projects form a tree (a project has an optional parent). Aggregating time across a subtree requires a BFS traversal starting from the root, collecting all descendants, then querying tasks tagged to any project in that set. The trickiest part is deduplication: a task tagged to two siblings of the same parent must count once toward the parent's total. I solved this with `findDistinctByOwnerAndProjectsIn` (JPA `DISTINCT`) and a `Set<Project>` for the subtree, so the same task cannot be counted twice regardless of how many subprojects it belongs to (commits in PR [#13](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/13)).

**Overview time windows.** Day/week/month boundaries are computed in the browser using the user's local timezone (the frontend calculates `from` and `to` as ISO-8601 instants), then passed as query parameters to the backend. The backend filter is purely start-inclusive/end-exclusive on those instants. This avoids timezone handling on the server and matches what a user would expect when they click "Today" (PR [#14](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/14)).

**Testing.** Each feature had unit tests, integration/controller tests with a shared H2-in-memory DB (MODE=PostgreSQL), and one Playwright E2E test against Firefox running the full Docker Compose stack. Coverage was kept above 90% on both sides throughout.

---

## AI Tools Used

I used **Claude Code** (Anthropic, model `claude-sonnet-4-6`) as the primary development tool throughout the project. It was active at every stage: generating initial scaffolding, writing backend controllers and tests, building React components, configuring Docker and CI, and debugging failures. I reviewed and approved each step; the final decisions on structure and naming were mine.

---

## Where AI Worked Well

- **Scaffolding and boilerplate.** Spring Security configuration, JPA entity relationships, Vite proxy setup, multi-stage Dockerfile — these are mechanical but error-prone to write from scratch. Claude got them right on the first attempt in most cases, saving significant setup time.

- **BFS traversal and deduplication logic.** I described the roll-up requirement (subtree of projects, deduplicate shared tasks) and Claude produced the correct BFS + `Set<Project>` solution, including a refactor to share the `subtreeOf` helper between the total-seconds endpoint and the new overview endpoint without duplicating code.

- **Test coverage.** Claude wrote thorough tests that I would not have written as exhaustively on my own — it covered the deduplication edge case, the open-ended `from`/`to` variants, the 404-for-another-user's-project case, and running-task-listed-but-not-counted-in-total scenario.

- **CI setup.** The initial GitHub Actions workflow, the self-hosted runner migration (Docker containers for backend/frontend jobs, `chmod` cleanup for workspace permissions) were all generated and debugged without me needing to consult the Actions docs manually.

---

## Where AI Fell Short and What I Did

**H2 timestamp precision bug.** The boundary-condition filter tests (`startTime == from`) passed locally but failed on CI. The root cause was that `Instant.now()` has nanosecond precision but H2 stores timestamps with microsecond precision: the stored value of the "in range" task came out slightly *before* the `from` boundary, excluding it. Claude initially wrote the test without this concern. Once CI caught the failure, Claude diagnosed it correctly and added `.truncatedTo(ChronoUnit.MILLIS)` to prevent the precision mismatch. I had expected the test to be more robust from the start — this was a case where local passing tests gave false confidence.

**Running task tagged to a project (overview test).** The first version of `overviewExcludesARunningTaskFromTheTotalButListsIt` assumed `POST /api/tasks/start` accepted `projectIds` in the body. It does not — the start endpoint only takes a description, matching the UI design where you start tracking and tag it later. The test returned 0 tasks instead of 1. Claude caught the design mismatch and restructured the test to use `POST /start` followed by a `PUT` that tags the task without an endTime (keeping it running). The fix was correct, but the original test showed that Claude does not always track the implicit invariants of already-built endpoints when writing new tests.

**Playwright `--with-deps` on the self-hosted runner.** Claude initially kept `--with-deps` when migrating to the self-hosted runner. The flag tries to install system packages via `su`, which fails without root. Dropping it (and relying on pre-installed system deps) fixed the problem, but it took one CI failure cycle to discover this.

Overall, Claude was fastest when tasks were well-defined and self-contained (a new endpoint, a new component, a new test class). It was least reliable when changes had implicit dependencies on decisions made earlier in the project — I had to provide that context explicitly, or catch the gap after a failed test run.

---

## Issue and PR Summary

| Issue | Feature | PR |
|-------|---------|---|
| #7 | Walking skeleton (backend, frontend, Docker, CI, README) | [#8](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/8) |
| #1 | User management (register, login, logout, change password) | [#9](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/9) |
| #2 | Time tracking start/stop with server-persisted timer | [#10](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/10) |
| #3 | Manual task add/edit/delete | [#11](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/11) |
| #4 | Projects: create, assign tasks | [#12](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/12) |
| #5 | Project hierarchy and aggregated time roll-up | [#13](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/13) |
| #6 | Overviews: per-project totals and day/week/month views | [#14](https://github.com/se2p-classrooms/final-project-mohamedabouhitta/pull/14) |
