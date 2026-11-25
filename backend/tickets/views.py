"""
Ticket API views – thin HTTP layer that delegates business logic
to serializers (validation) and services (stats aggregation).
"""

import logging

from django.db.models import Q
from rest_framework import generics, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from tickets.models import Ticket
from tickets.serializers import TicketSerializer, TicketUpdateSerializer
from tickets.services.stats_service import get_ticket_stats

logger = logging.getLogger(__name__)


class TicketListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/tickets/  – list tickets with optional filtering & search.
    POST /api/tickets/  – create a new ticket.
    """

    serializer_class = TicketSerializer

    def get_queryset(self):
        """Build a filtered queryset from query parameters.

        Supports ?category=, ?priority=, ?status= for exact match
        and ?search= for case-insensitive partial match across
        title and description.
        """
        queryset = Ticket.objects.all()
        params = self.request.query_params

        category = params.get("category")
        if category:
            queryset = queryset.filter(category=category)

        priority = params.get("priority")
        if priority:
            queryset = queryset.filter(priority=priority)

        ticket_status = params.get("status")
        if ticket_status:
            queryset = queryset.filter(status=ticket_status)

        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )

        return queryset

    def perform_create(self, serializer: TicketSerializer) -> None:
        """Log ticket creation after save."""
        ticket = serializer.save()
        logger.info("Ticket created: id=%s title=%r", ticket.id, ticket.title)


class TicketPartialUpdateView(generics.UpdateAPIView):
    """PATCH /api/tickets/<id>/ – update mutable ticket fields."""

    queryset = Ticket.objects.all()
    serializer_class = TicketUpdateSerializer

    def patch(self, request: Request, *args, **kwargs) -> Response:
        """Delegate to partial_update and log the change."""
        response = self.partial_update(request, *args, **kwargs)
        logger.info("Ticket updated: id=%s fields=%s", kwargs.get("pk"), list(request.data.keys()))
        return response


class TicketStatsView(APIView):
    """GET /api/tickets/stats/ – aggregated dashboard statistics."""

    def get(self, request: Request) -> Response:
        """Return stats computed entirely via database aggregation."""
        stats = get_ticket_stats()
        return Response(stats, status=status.HTTP_200_OK)
