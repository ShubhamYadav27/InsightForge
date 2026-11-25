"""
Ticket model – the central entity of the support system.

Database-level check constraints enforce data integrity for category,
priority, and status independently of application-layer validation.
"""

from django.db import models


class Ticket(models.Model):
    """A customer support ticket with classification metadata."""

    class Category(models.TextChoices):
        BILLING = "billing", "Billing"
        TECHNICAL = "technical", "Technical"
        ACCOUNT = "account", "Account"
        GENERAL = "general", "General"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=Category.choices)
    priority = models.CharField(max_length=20, choices=Priority.choices)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"], name="idx_ticket_created_at"),
            models.Index(fields=["status"], name="idx_ticket_status"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(category__in=["billing", "technical", "account", "general"]),
                name="chk_ticket_category",
            ),
            models.CheckConstraint(
                condition=models.Q(priority__in=["low", "medium", "high", "critical"]),
                name="chk_ticket_priority",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=["open", "in_progress", "resolved", "closed"]),
                name="chk_ticket_status",
            ),
        ]

    def __str__(self) -> str:
        return f"[{self.id}] {self.title}"
