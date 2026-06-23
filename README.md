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

Then open http://localhost:8080. Data persists in a named Docker volume across
restarts (`docker compose down` keeps it; add `-v` to also remove it).

## Local development (without Docker)

Run Postgres via Compose, but the backend and frontend natively for hot-reload:

```sh
docker compose up -d db                # Postgres only, published on localhost:5433

cd backend
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/timetracking ./mvnw spring-boot:run

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
