"""Ticket URL routes – maps endpoints to their views."""

from django.urls import path

from tickets.views import (
    TicketClassifyView,
    TicketListCreateView,
    TicketPartialUpdateView,
    TicketStatsView,
)

urlpatterns = [
    path("tickets/", TicketListCreateView.as_view(), name="ticket-list-create"),
    path("tickets/stats/", TicketStatsView.as_view(), name="ticket-stats"),
    path("tickets/classify/", TicketClassifyView.as_view(), name="ticket-classify"),
    path("tickets/<int:pk>/", TicketPartialUpdateView.as_view(), name="ticket-update"),
]
