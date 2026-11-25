# InsightForge — Support Ticket System

A full-stack support ticket triage application built with **Django + Django REST Framework**, **PostgreSQL**, **React (Vite + Tailwind CSS)**, and **Google Gemini** for real-time ticket auto-classification, containerized with **Docker Compose**.

---

## Quick Start

### 1. Run with Docker Compose (Recommended)

Start PostgreSQL, Django (with automatic migrations), and the React UI in one command:

**macOS / Linux:**
```bash
LLM_API_KEY=your_gemini_api_key_here docker-compose up --build
```

**Windows (PowerShell):**
```powershell
$env:LLM_API_KEY="your_gemini_api_key_here"; docker-compose up --build
```

Alternatively, copy `.env.example` to `.env`, set `LLM_API_KEY`, and run:
```bash
docker-compose up --build
```

### 2. Access URLs

| Service | URL |
| :--- | :--- |
| **Web UI (React)** | http://localhost:3000 |
| **Backend API (Django)** | http://localhost:8000/api |
| **Ticket Stats Endpoint** | http://localhost:8000/api/tickets/stats/ |

### Graceful Behavior Without `LLM_API_KEY`

If `LLM_API_KEY` is omitted or empty, the application still runs end-to-end without failing:
- `POST /api/tickets/classify/` logs a warning and returns `200 OK` with `{"suggested_category": null, "suggested_priority": null}`.
- The React form leaves the Category and Priority dropdowns manually selectable so users can submit tickets without interruption.

---

## LLM Choice & Prompt Design Rationale

### Model Selection: `gemini-2.5-flash` (`google-genai` SDK)

- **Low latency for interactive UX:** The frontend triggers classification as soon as the user finishes typing (~700ms debounce or `onBlur`). `gemini-2.5-flash` delivers sub-second responses suitable for real-time form pre-filling.
- **Native structured JSON enforcement:** Using `GenerateContentConfig(response_mime_type="application/json", response_schema=...)` constrains output at the token/schema level to valid JSON containing only the allowed `category` and `priority` enum strings (`temperature=0.0` for deterministic classification).

### Prompt Design (`CLASSIFICATION_SYSTEM_PROMPT`)

The system instruction in [`backend/tickets/services/llm_service.py`](backend/tickets/services/llm_service.py) explicitly defines decision boundaries for every enum value so reviewers can audit and tune behavior in version control:

- **Categories:** `billing` (invoices, payments, refunds, subscriptions), `technical` (bugs, crashes, API errors, outages), `account` (login, MFA, permissions, profile), `general` (catch-all).
- **Priorities:** `critical` (outage, security breach, data loss, complete blocker), `high` (major feature broken with no workaround), `medium` (standard bug/inquiry with workaround), `low` (cosmetic issue, general question, feature request).

### Multi-Layer Graceful Fallback

1. **Missing API key:** Short-circuits immediately before constructing a client.
2. **Bounded timeout:** Requests enforce an 8-second timeout (`HttpOptions(timeout=8_000)`).
3. **Exception & parse protection:** Network errors, SDK exceptions, or empty/malformed JSON responses are caught, logged via Python `logging`, and mapped to `{"suggested_category": null, "suggested_priority": null}`.
4. **Strict enum validation:** `_validate_classification()` verifies returned values against `Ticket.Category` and `Ticket.Priority` before returning them to the client.
5. **Frontend override safety:** On the React side, manual user changes to Category or Priority set override refs so delayed AI responses never overwrite user selections.

---

## Architecture & Key Design Decisions

### Project Structure

```text
support-ticket-system/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh               # Waits for Postgres, checks & applies migrations
│   ├── requirements.txt
│   ├── config/                     # Django settings, root URL routing, WSGI/ASGI
│   └── tickets/
│       ├── models.py               # Ticket model + DB CheckConstraints + indexes
│       ├── serializers.py          # Request/response validation
│       ├── views.py                # Thin HTTP layer
│       ├── urls.py                 # API routes
│       ├── tests.py                # Offline unit & endpoint tests
│       └── services/
│           ├── stats_service.py    # Pure ORM aggregate/annotate metrics
│           └── llm_service.py      # Gemini classification + fallback
└── frontend/
    ├── Dockerfile                  # Multi-stage Vite build -> nginx:alpine
    ├── nginx.conf
    └── src/
        ├── api/ticketsApi.js       # Fetch wrapper & error normalization
        ├── constants/ticketOptions.js
        └── components/
            ├── StatsDashboard.jsx
            ├── TicketForm.jsx
            └── TicketList.jsx
```

### Database-Level Integrity & Query Efficiency

- **PostgreSQL `CheckConstraint`s:** `Ticket.Meta.constraints` enforces valid `category`, `priority`, and `status` choices directly at the PostgreSQL level (`chk_ticket_category`, `chk_ticket_priority`, `chk_ticket_status`), independent of application validation.
- **Indexes:** Explicit indexes on `-created_at` (`idx_ticket_created_at`) and `status` (`idx_ticket_status`) support default newest-first listing and status filtering.
- **Pure ORM Stats Pipeline (`stats_service.py`):** `get_ticket_stats()` computes `total_tickets`, `open_tickets` (`Count` with `Q` filter), `avg_tickets_per_day` (`TruncDate` + `annotate` + `Avg`), and category/priority breakdowns (`values().annotate(Count)`) entirely in SQL without iterating over ticket records in Python.
- **Separation of Concerns:** Views handle only HTTP serialization/status codes, delegating aggregation and external LLM calls to `tickets/services/`. Frontend components delegate HTTP calls to `src/api/ticketsApi.js`.

---

## API Reference

| Method | Endpoint | Query Params / Body | Response Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/tickets/` | JSON: `title`, `description`, `category`, `priority` | `201 Created` / `400` | Create a new support ticket (defaults `status` to `open`). |
| `GET` | `/api/tickets/` | `?category=`, `?priority=`, `?status=`, `?search=` | `200 OK` | List tickets ordered newest-first (`-created_at`). All filters combine; `search` performs case-insensitive partial match across `title` and `description`. |
| `PATCH` | `/api/tickets/<id>/` | JSON: any subset of `status`, `category`, `priority` | `200 OK` / `400` / `404` | Partially update ticket status or override classification. |
| `GET` | `/api/tickets/stats/` | — | `200 OK` | Return `total_tickets`, `open_tickets`, `avg_tickets_per_day`, `priority_breakdown`, and `category_breakdown`. |
| `POST` | `/api/tickets/classify/` | JSON: `{"description": "..."}` | `200 OK` / `400` | Suggest `suggested_category` and `suggested_priority` using Gemini (returns `null` values on fallback). |
