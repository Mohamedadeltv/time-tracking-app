[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/TuXr0YKT)

# Time Tracking

A full-stack time tracking app: track time spent on tasks, organise tasks under
hierarchical projects, and review totals over day/week/month or a custom range.

## Tech stack

- **Backend:** Spring Boot 3.5 (Java 21), Spring Data JPA, PostgreSQL
- **Frontend:** React + TypeScript, Vite, Tailwind CSS
- **Tests:** JUnit/MockMvc + Jacoco (backend), Vitest + React Testing Library (frontend),
  Playwright against Firefox (system/E2E)
- **Packaging:** multi-stage Docker build (Spring serves the built React app); Docker
  Compose runs the app together with Postgres

## URLs

| Service | URL |
|---|---|
| App (Docker Compose) | http://localhost:8080 |
| API base | http://localhost:8080/api |
| Health check | http://localhost:8080/api/health |
| Frontend dev server (local dev only) | http://localhost:5173 |
| Postgres (Docker Compose, from the host) | `jdbc:postgresql://localhost:5433/timetracking` |
| Postgres (from inside the `app` container) | `jdbc:postgresql://db:5432/timetracking` |

- **App** — frontend and API on the same origin; Spring serves the built React app directly, no separate frontend port.
- **API base** — e.g. `POST /api/auth/register`, `GET /api/tasks`.
- **Health check** — returns `OK` once the app is ready.
- **Frontend dev server** — Vite, hot-reload; proxies `/api` to `:8080`. See [Local development](#local-development-without-docker).
- **Postgres** — user/password/database are all `timetracking` (see `docker-compose.yml`). The
  host port is `5433`, not `5432`, to avoid clashing with a locally installed Postgres; inside
  the Compose network, the `app` container reaches it as `db:5432`.
- **Postgres** — published on the host for local psql/GUI access; not `5432`, to avoid clashing with a locally installed Postgres.

## Prerequisites

- JDK 21
- Node.js 24+ and npm
- Docker and Docker Compose

## Quick start (Docker Compose)

Builds the frontend, builds the backend jar with the frontend bundled in, and starts
the app together with Postgres:

```sh
docker compose up --build
```

Then open **http://localhost:8080**. Data persists in a named Docker volume across
restarts.

### Common Docker Compose commands

```sh
docker compose up --build          # build + start, logs in this terminal
docker compose up --build -d       # same, but detached (runs in the background)
docker compose ps                  # check container status
docker compose logs -f app         # tail the backend/app logs
docker compose logs -f db          # tail the Postgres logs
docker compose down                # stop + remove containers, keep the data volume
docker compose down -v             # stop + remove containers AND wipe the database
```

## Local development (without Docker)

Run Postgres via Compose, but the backend and frontend natively for hot-reload:

```sh
docker compose up -d db                # Postgres only, published on localhost:5433

cd backend
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/timetracking ./mvnw spring-boot:run
# backend + API now on http://localhost:8080

cd frontend
npm install
npm run dev                            # http://localhost:5173, proxies /api to :8080
```

## Running tests

```sh
cd backend && ./mvnw clean verify      # tests + Jacoco coverage + Spotless format check
cd frontend && npm ci && npm run test:coverage && npm run lint && npm run build
```

Coverage reports: `backend/target/site/jacoco/index.html` and `frontend/coverage/index.html`.

System/E2E tests run against the full Docker Compose stack (requires Firefox):

```sh
docker compose up -d --build
cd e2e && npm ci && npx playwright install firefox && npm test
docker compose down
```

## Common commands (cheat sheet)

```sh
# Backend
cd backend
./mvnw spring-boot:run              # run locally (needs Postgres reachable, see above)
./mvnw clean test                   # tests only
./mvnw clean verify                 # tests + coverage + format check (what CI runs)

# Frontend
cd frontend
npm run dev                         # dev server with hot-reload, :5173
npm run build                       # production build (also type-checks)
npm run lint                        # ESLint
npm run test:coverage               # Vitest with coverage

# E2E
cd e2e
npm test                            # Playwright against whatever's running on :8080

# Docker Compose (from repo root)
docker compose up --build           # build + run everything
docker compose down                 # stop
docker compose logs -f app          # tail backend logs
```

## Project structure

```
backend/                  Spring Boot REST API + JPA + Postgres
frontend/                 React + TypeScript + Vite + Tailwind
e2e/                      Playwright system tests (Firefox) against the Docker Compose stack
Dockerfile                multi-stage build: frontend -> backend jar -> runtime image
docker-compose.yml        app + Postgres, for local/grading deployment
.github/workflows/ci.yml  CI: backend test+coverage+format, frontend lint+build+test+coverage, E2E
```

## CI

GitHub Actions runs on every push to `main` and every pull request: backend
`./mvnw clean verify` (tests, coverage, format check), frontend lint, build
(type-check), and tests with coverage, and a Playwright system-test job against the
built Docker Compose stack.
