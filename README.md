# InsightForge — Support Ticket System

InsightForge is a full-stack support ticket triage system built with **Django**, **Django REST Framework**, **PostgreSQL**, **React**, and **Google Gemini** (`gemini-3.6-flash`), containerized with **Docker Compose**. Users can submit support tickets with real-time AI-assisted category and priority suggestions (which remain fully overridable), search and filter tickets, update ticket statuses inline, and monitor aggregated metrics on a live dashboard.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Quick Start](#quick-start)
- [Backend & API Reference](#backend--api-reference)
- [Gemini LLM Integration](#gemini-llm-integration)
- [Frontend Features](#frontend-features)
- [Architecture & Design Decisions](#architecture--design-decisions)
- [Testing & Verification](#testing--verification)
- [Environment Variables & Security](#environment-variables--security)

---

## Project Overview

### Main Features & User Workflow

1. **Submit with AI Triage:** As a user writes a ticket description in the React form, the frontend calls `POST /api/tickets/classify/` (debounced after typing pauses or on field blur) to request a suggested `category` and `priority` from Google Gemini.
2. **Review & Override:** Suggested values pre-fill the Category and Priority dropdowns with an `AI Suggested` badge. The user can keep or override either value before submitting. If `LLM_API_KEY` is missing or the LLM call fails, the form falls back smoothly to manual selection.
3. **Browse, Search & Filter:** Submitted tickets appear newest-first in the ticket list with combined filtering (`category`, `priority`, `status`) and case-insensitive search across `title` and `description`.
4. **Inline Status Updates & Live Metrics:** Changing a ticket's status dropdown sends `PATCH /api/tickets/<id>/` and refreshes the aggregated statistics dashboard (`GET /api/tickets/stats/`) without reloading the page.

---

## Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Backend** | Python 3.12 (`python:3.12-slim`), Django, Django REST Framework, `django-cors-headers`, `psycopg2-binary`, `python-dotenv` |
| **LLM Integration** | Google GenAI SDK (`google-genai`), model `gemini-3.6-flash` |
| **Database** | PostgreSQL (`postgres:15-alpine`) |
| **Frontend** | React 19, Vite 6 (`@vitejs/plugin-react`), Tailwind CSS (CDN), Nginx (`nginx:alpine`) |
| **Containerization** | Docker, Docker Compose |

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose (`docker-compose` or `docker compose`)
- *(Optional)* A Google Gemini API key for AI auto-classification (`LLM_API_KEY`). If omitted, all ticket CRUD, filtering, and stats features continue to work normally without AI pre-fill.

### 1. Configure Environment Variables

You can either pass `LLM_API_KEY` inline at startup or create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and set `LLM_API_KEY` to your Gemini API key (`.env` is listed in `.gitignore` and excluded from Git).

### 2. Start the Application

**Windows (PowerShell):**
```powershell
$env:LLM_API_KEY="your_gemini_api_key_here"; docker-compose up --build
```

**macOS / Linux:**
```bash
LLM_API_KEY=your_gemini_api_key_here docker-compose up --build
```

Or, if using a `.env` file in the project root:
```bash
docker-compose up --build
```

On startup, the `db` service passes its `pg_isready` healthcheck, the `backend` entrypoint waits for PostgreSQL, verifies migrations, runs `python manage.py migrate --noinput`, and starts Django on port `8000`, while `frontend` serves the built React bundle via Nginx on port `3000`.

### 3. Access URLs

| Service | URL |
| :--- | :--- |
| **Frontend UI (React / Nginx)** | http://localhost:3000 |
| **Backend API Root (Django / DRF)** | http://localhost:8000/api |
| **Tickets Endpoint** | http://localhost:8000/api/tickets/ |
| **Stats Endpoint** | http://localhost:8000/api/tickets/stats/ |

### 4. Stop the Application (Preserving Database Data)

To stop and remove containers while keeping the `postgres_data` volume intact:
```bash
docker-compose down
```

*(Only add `-v` if you intentionally want to wipe the persisted PostgreSQL database volume.)*

---

## Backend & API Reference

### `Ticket` Data Model (`backend/tickets/models.py`)

| Field | Type | Constraints / Choices |
| :--- | :--- | :--- |
| `title` | `CharField(max_length=200)` | Required, non-blank (validated in serializer) |
| `description` | `TextField` | Required, non-blank (validated in serializer) |
| `category` | `CharField(max_length=20)` | `billing`, `technical`, `account`, `general` |
| `priority` | `CharField(max_length=20)` | `low`, `medium`, `high`, `critical` |
| `status` | `CharField(max_length=20)` | `open`, `in_progress`, `resolved`, `closed` (defaults to `open`) |
| `created_at` | `DateTimeField(auto_now_add=True)` | Auto-populated on creation |

**Database-Level Integrity & Indexes (`Ticket.Meta` & `0001_initial.py`):**
- PostgreSQL `CheckConstraint`s enforce valid enum values at the database level independently of application validation: `chk_ticket_category`, `chk_ticket_priority`, and `chk_ticket_status`.
- Indexes on `-created_at` (`idx_ticket_created_at`) and `status` (`idx_ticket_status`), with default model ordering `ordering = ["-created_at"]`.

### API Endpoints

| Method | Endpoint | Description | Success Status |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/tickets/` | Create a new ticket | `201 Created` |
| `GET` | `/api/tickets/` | List tickets newest-first with optional combined filters & search | `200 OK` |
| `PATCH` | `/api/tickets/<id>/` | Partially update `status`, `category`, and/or `priority` | `200 OK` |
| `GET` | `/api/tickets/stats/` | Return database-aggregated ticket metrics | `200 OK` |
| `POST` | `/api/tickets/classify/` | Suggest `category` and `priority` from `description` via Gemini | `200 OK` |

#### `POST /api/tickets/`
Request body:
```json
{
  "title": "Unable to access account after password reset",
  "description": "Every login attempt fails with an invalid session token error.",
  "category": "account",
  "priority": "high"
}
```
Response (`201 Created`):
```json
{
  "id": 1,
  "title": "Unable to access account after password reset",
  "description": "Every login attempt fails with an invalid session token error.",
  "category": "account",
  "priority": "high",
  "status": "open",
  "created_at": "2026-11-25T12:20:00Z"
}
```

#### `GET /api/tickets/`
Supports combining any subset of:
- `?category=` (`billing` | `technical` | `account` | `general`)
- `?priority=` (`low` | `medium` | `high` | `critical`)
- `?status=` (`open` | `in_progress` | `resolved` | `closed`)
- `?search=` (case-insensitive partial match across `title` and `description` via Django `Q(title__icontains=search) | Q(description__icontains=search)`)

Example:
```text
GET /api/tickets/?category=technical&priority=critical&status=open&search=checkout
```

#### `PATCH /api/tickets/<id>/`
Restricts updates via `TicketUpdateSerializer` to `status`, `category`, and `priority`.

Request body:
```json
{
  "status": "resolved"
}
```
Response (`200 OK`):
```json
{
  "status": "resolved",
  "category": "technical",
  "priority": "critical"
}
```

#### `GET /api/tickets/stats/`
Implemented in `backend/tickets/services/stats_service.py` using Django ORM database-level `aggregate()` and `annotate()` queries (no Python loops over ticket records):
- `total_tickets` and `open_tickets` via `Count("id")` and `Count("id", filter=Q(status=Ticket.Status.OPEN))`
- `avg_tickets_per_day` via `TruncDate("created_at")`, `.values("day").annotate(day_count=Count("id"))`, and `.aggregate(avg=Avg("day_count"))`, rounded to 1 decimal place and defaulting to `0.0` when empty
- `priority_breakdown` and `category_breakdown` via `.values(...).annotate(count=Count("id"))`

Response (`200 OK`):
```json
{
  "total_tickets": 2,
  "open_tickets": 1,
  "avg_tickets_per_day": 2.0,
  "priority_breakdown": {
    "low": 0,
    "medium": 0,
    "high": 1,
    "critical": 1
  },
  "category_breakdown": {
    "billing": 0,
    "technical": 1,
    "account": 1,
    "general": 0
  }
}
```

#### `POST /api/tickets/classify/`
Validates a non-blank `description` (`400 Bad Request` if missing or blank-only).

Request body:
```json
{
  "description": "I am completely locked out of my account after resetting my password and enabling two-factor authentication. Every login attempt fails with an invalid session token error."
}
```
Response (`200 OK`):
```json
{
  "suggested_category": "account",
  "suggested_priority": "high"
}
```
When `LLM_API_KEY` is unset or an upstream error occurs, it returns `200 OK` with:
```json
{
  "suggested_category": null,
  "suggested_priority": null
}
```

---

## Gemini LLM Integration

Implemented in [`backend/tickets/services/llm_service.py`](backend/tickets/services/llm_service.py) using the official `google-genai` SDK:

- **Model & Parameters:** Calls `client.models.generate_content` with `model="gemini-3.6-flash"`, `temperature=0.0` for deterministic classification, and `types.HttpOptions(timeout=30_000)` (30,000 ms deadline).
- **Prompt Design:** `CLASSIFICATION_SYSTEM_PROMPT` is stored as a module-level constant in `llm_service.py`, defining explicit classification rules for each category (`billing`, `technical`, `account`, `general`) and severity criteria for each priority (`critical`, `high`, `medium`, `low`).
- **Structured JSON Output:** Uses `types.GenerateContentConfig` with `response_mime_type="application/json"` and `_RESPONSE_SCHEMA` (`types.Schema` requiring `suggested_category` and `suggested_priority` constrained to their exact enum lists).
- **Strict Validation & Graceful Fallback:**
  1. If `LLM_API_KEY` is missing or empty, `classify_ticket()` logs a warning and immediately returns `{"suggested_category": None, "suggested_priority": None}`.
  2. Any SDK, network, JSON parse, or timeout exception is caught, logged via Python `logging`, and mapped to the same fallback dictionary.
  3. Empty `response.text` triggers a warning and fallback.
  4. `_validate_classification()` verifies parsed values against `Ticket.Category` and `Ticket.Priority` enums, replacing any unexpected value with `None`.

---

## Frontend Features

Built under `frontend/src/` with modular components and a dedicated API client:

- **API Client (`src/api/ticketsApi.js`):** Configurable via `import.meta.env.VITE_API_URL || "http://localhost:8000/api"`, exposing `fetchTickets`, `createTicket`, `updateTicket`, `fetchTicketStats`, and `classifyTicket`, with normalized error extraction from DRF responses.
- **Ticket Submission Form (`src/components/TicketForm.jsx`):**
  - Required `title` (`maxLength={200}` with live character counter) and `description` inputs.
  - Triggers `classifyTicket` automatically 700ms after typing pauses (when trimmed length >= 10 characters) and on `onBlur` if that description has not already been classified.
  - Displays an `"AI analyzing description..."` indicator while the classify request is in flight.
  - Pre-fills Category and Priority dropdowns with `"✨ AI Suggested"` badges while tracking manual user selections (`manualCategoryRef`, `manualPriorityRef`) and request sequence IDs (`classifySeqRef`) so manual overrides are never overwritten by delayed responses.
  - Handles errors and null suggestions gracefully without blocking manual selection or submission, clears the form on success, and triggers an immediate refresh of the ticket list and stats dashboard.
- **Ticket List (`src/components/TicketList.jsx`):**
  - Displays tickets newest-first with title, color-coded category and priority badges, formatted `created_at` timestamp, and truncated descriptions (140-character preview with click-to-expand `Read more` / `Show less`).
  - Provides combined Search (`?search=`), Category, Priority, and Status filter controls plus a `"Clear Filters"` button.
  - Each ticket includes an inline status `<select>` (`open`, `in_progress`, `resolved`, `closed`) that immediately sends `PATCH /api/tickets/<id>/` and refreshes dashboard metrics.
- **Statistics Dashboard (`src/components/StatsDashboard.jsx`):**
  - Renders summary cards for `Total Tickets`, `Open Tickets`, and `Avg Tickets / Day`, plus percentage breakdown bars for `Priority Breakdown` and `Category Breakdown`.
  - Automatically refreshes whenever a ticket is created or updated (`App.jsx`).

---

## Architecture & Design Decisions

### Project Structure

```text
support-ticket-system/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── README.md
├── backend/
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── tickets/
│       ├── apps.py
│       ├── models.py
│       ├── serializers.py
│       ├── tests.py
│       ├── urls.py
│       ├── views.py
│       ├── migrations/
│       │   └── 0001_initial.py
│       └── services/
│           ├── llm_service.py
│           └── stats_service.py
└── frontend/
    ├── .dockerignore
    ├── Dockerfile
    ├── index.html
    ├── nginx.conf
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── api/
        │   └── ticketsApi.js
        ├── components/
        │   ├── StatsDashboard.jsx
        │   ├── TicketForm.jsx
        │   └── TicketList.jsx
        └── constants/
            └── ticketOptions.js
```

### Key Design Choices

- **Separation of Concerns:** Backend views (`views.py`) handle only HTTP routing, query parameter binding, and status codes; validation lives in `serializers.py`, SQL analytics in `services/stats_service.py`, and Gemini integration in `services/llm_service.py`. On the frontend, `src/api/ticketsApi.js` isolates HTTP transport from React state and presentation components, and `src/constants/ticketOptions.js` centralizes shared enum options and badge classes.
- **Database Integrity & Query Efficiency:** Enforcing valid choices via PostgreSQL `CheckConstraint`s guarantees data integrity even outside DRF serializers, while ORM `aggregate()`/`annotate()` keeps `/api/tickets/stats/` execution inside PostgreSQL without loading ticket rows into Python memory.
- **Docker Service Architecture & Auto-Migrations:**
  - `db`: `postgres:15-alpine` with named volume `postgres_data` and `pg_isready` healthcheck.
  - `backend`: `python:3.12-slim` waiting on `db` (`condition: service_healthy`). `backend/Dockerfile` strips any CRLF line endings from `entrypoint.sh`, which checks PostgreSQL TCP reachability, runs `python manage.py makemigrations --check --dry-run` and `python manage.py migrate --noinput`, and starts the Django server on `0.0.0.0:8000`.
  - `frontend`: Multi-stage build using `node:20-alpine` (`npm ci` + `npm run build` with `VITE_API_URL=http://localhost:8000/api`) served by `nginx:alpine` on port `80` (mapped to `3000:80` in `docker-compose.yml`) with SPA fallback routing in `nginx.conf`.

---

## Testing & Verification

The following checks have been executed and verified locally:

- **Backend Automated Tests (`13/13` passing):**
  `backend/tickets/tests.py` verifies `_validate_classification`, `classify_ticket`, and `POST /api/tickets/classify/` across missing `LLM_API_KEY`, mocked valid Gemini JSON responses, invalid enum fallback, empty response fallback, SDK exceptions, and `400 Bad Request` validation for missing/blank descriptions.
  To run the test suite inside the running backend container:
  ```bash
  docker-compose exec backend python manage.py test
  ```
- **Docker Compose & Frontend Container Build:**
  - `docker-compose.yml` configuration passed validation (`docker compose config --quiet`).
  - Backend Docker image built and started with automatic Django migrations (`entrypoint.sh`).
  - `frontend/Dockerfile` succeeded in building the Vite production bundle (`npm run build`) and starting the Nginx container on port `3000`.
- **Live Gemini Classification Endpoint (`POST /api/tickets/classify/`):**
  - Verified live `POST /api/tickets/classify/` against the rebuilt backend with `LLM_API_KEY` configured using `gemini-3.6-flash` (`timeout=30_000`), returning `HTTP 200` with `suggested_category="account"` and `suggested_priority="high"`.
  - Verified graceful `HTTP 200` fallback (`{"suggested_category": null, "suggested_priority": null}`) when `LLM_API_KEY` is absent or unavailable.

---

## Environment Variables & Security

Never hardcode API keys or commit `.env` files to version control. Configure secrets via environment variables or a local `.env` file (ignored by `.gitignore`).

| Variable | Used By | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `LLM_API_KEY` | `backend` (`llm_service.py`) | `""` | Google Gemini API key; falls back gracefully when empty |
| `DB_NAME` | `db`, `backend` | `ticket_db` | PostgreSQL database name |
| `DB_USER` | `db`, `backend` | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | `db`, `backend` | `postgres` | PostgreSQL password |
| `DB_HOST` | `backend` (`settings.py`, `entrypoint.sh`) | `db` | PostgreSQL host name |
| `DB_PORT` | `backend` (`settings.py`, `entrypoint.sh`) | `5432` | PostgreSQL port |
| `DJANGO_SECRET_KEY` | `backend` (`settings.py`) | Dev fallback in `settings.py` / `docker-compose.yml` | Django cryptographic signing key (override in production) |
| `DEBUG` | `backend` (`settings.py`) | `True` | Enables debug mode and `CORS_ALLOW_ALL_ORIGINS` in local dev |
| `ALLOWED_HOSTS` | `backend` (`settings.py`) | `*` | Comma-separated allowed host headers |
| `CORS_ALLOWED_ORIGINS` | `backend` (`settings.py`) | `http://localhost:3000,http://localhost:5173` | Comma-separated allowed frontend origins |
| `VITE_API_URL` | `frontend` (`Dockerfile`, `ticketsApi.js`) | `http://localhost:8000/api` | Base URL baked into the Vite frontend bundle at build time |
