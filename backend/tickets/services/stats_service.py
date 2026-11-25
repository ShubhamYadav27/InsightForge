"""
Stats service – computes dashboard statistics purely at the database level.

Every metric uses Django ORM aggregate / annotate calls so the database
does the heavy lifting rather than Python loops over queryset records.
"""

import logging
from decimal import Decimal
from typing import Any

from django.db.models import Avg, Count, Q
from django.db.models.functions import TruncDate

from tickets.models import Ticket

logger = logging.getLogger(__name__)


def get_ticket_stats() -> dict[str, Any]:
    """Return aggregated ticket statistics in a single dict.

    Uses database-level grouping to keep memory footprint constant
    regardless of ticket volume.
    """
    queryset = Ticket.objects.all()

    # --- Scalar aggregates ---------------------------------------------------
    totals = queryset.aggregate(
        total_tickets=Count("id"),
        open_tickets=Count("id", filter=Q(status=Ticket.Status.OPEN)),
    )

    # --- Average tickets per active day --------------------------------------
    daily_counts = (
        queryset
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(day_count=Count("id"))
    )
    avg_per_day_result = daily_counts.aggregate(avg=Avg("day_count"))
    raw_avg: Decimal | None = avg_per_day_result.get("avg")
    avg_tickets_per_day = round(float(raw_avg), 1) if raw_avg is not None else 0.0

    # --- Breakdowns by category and priority ---------------------------------
    priority_rows = queryset.values("priority").annotate(count=Count("id"))
    priority_breakdown = {p.value: 0 for p in Ticket.Priority}
    for row in priority_rows:
        priority_breakdown[row["priority"]] = row["count"]

    category_rows = queryset.values("category").annotate(count=Count("id"))
    category_breakdown = {c.value: 0 for c in Ticket.Category}
    for row in category_rows:
        category_breakdown[row["category"]] = row["count"]

    stats = {
        "total_tickets": totals["total_tickets"],
        "open_tickets": totals["open_tickets"],
        "avg_tickets_per_day": avg_tickets_per_day,
        "priority_breakdown": priority_breakdown,
        "category_breakdown": category_breakdown,
    }

    logger.debug("Computed ticket stats: %s", stats)
    return stats
