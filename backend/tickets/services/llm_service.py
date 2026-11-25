"""
LLM classification service – uses Google Gemini to auto-suggest ticket
category and priority from a free-text description.

Separated from views so the classification logic can be tested, retried,
or swapped to a different provider without touching HTTP concerns.
"""

import json
import logging
import os
from typing import Any

from google import genai
from google.genai import types

from tickets.models import Ticket

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt – kept as a module-level constant so reviewers can audit it and
# changes are tracked in version control.
# ---------------------------------------------------------------------------

CLASSIFICATION_SYSTEM_PROMPT = """\
You are a support-ticket classifier. Given a customer's problem description,
return a JSON object with exactly two keys:

  "suggested_category" — one of the following:
    • "billing"   — invoices, payments, refunds, charges, pricing, subscriptions
    • "technical" — bugs, errors, crashes, API issues, performance, outages,
                    integrations, feature malfunctions
    • "account"   — login, password, MFA, permissions, profile settings,
                    account creation or deletion
    • "general"   — anything that does not clearly fit the above categories

  "suggested_priority" — one of the following:
    • "critical" — production outage, security breach, data loss, or complete
                   blocker affecting many users with no workaround
    • "high"     — major feature broken with no reasonable workaround,
                   significant business impact
    • "medium"   — standard bug or inquiry where a workaround exists,
                   moderate user impact
    • "low"      — minor cosmetic issue, general question, feature request,
                   or informational inquiry

Respond ONLY with the JSON object. Do not include any other text.
"""

# Structured-output schema enforced at the API level so the model is
# constrained to return valid JSON matching this shape.
_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "suggested_category": types.Schema(
            type=types.Type.STRING,
            enum=["billing", "technical", "account", "general"],
        ),
        "suggested_priority": types.Schema(
            type=types.Type.STRING,
            enum=["low", "medium", "high", "critical"],
        ),
    },
    required=["suggested_category", "suggested_priority"],
)

_FALLBACK: dict[str, None] = {
    "suggested_category": None,
    "suggested_priority": None,
}

_VALID_CATEGORIES = {c.value for c in Ticket.Category}
_VALID_PRIORITIES = {p.value for p in Ticket.Priority}


def _validate_classification(data: dict[str, Any]) -> dict[str, str | None]:
    """Ensure LLM output strictly matches allowed enum values.

    Returns the validated dict, or replaces out-of-range values with None
    so the caller always gets a safe, predictable shape.
    """
    category = data.get("suggested_category")
    priority = data.get("suggested_priority")

    return {
        "suggested_category": category if category in _VALID_CATEGORIES else None,
        "suggested_priority": priority if priority in _VALID_PRIORITIES else None,
    }


def classify_ticket(description: str) -> dict[str, str | None]:
    """Classify a ticket description via Google Gemini.

    Returns ``{"suggested_category": ..., "suggested_priority": ...}``
    with validated string values on success, or None values on any
    failure so ticket submission is never blocked by LLM issues.
    """
    api_key = os.getenv("LLM_API_KEY", "")
    if not api_key:
        logger.warning("LLM_API_KEY is not set; skipping classification")
        return dict(_FALLBACK)

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=description,
            config=types.GenerateContentConfig(
                system_instruction=CLASSIFICATION_SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=_RESPONSE_SCHEMA,
                temperature=0.0,
                http_options=types.HttpOptions(timeout=8_000),
            ),
        )

        if not response.text:
            logger.warning("LLM returned empty response text")
            return dict(_FALLBACK)

        raw: dict[str, Any] = json.loads(response.text)
        result = _validate_classification(raw)

        logger.info(
            "LLM classification result: category=%s priority=%s",
            result["suggested_category"],
            result["suggested_priority"],
        )
        return result

    except Exception:
        logger.exception("LLM classification failed; returning fallback")
        return dict(_FALLBACK)
