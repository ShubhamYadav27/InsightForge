"""
Ticket serializers – translate between Ticket model instances and JSON.

Validation rules live here so views stay thin and focused on HTTP concerns.
"""

from rest_framework import serializers

from tickets.models import Ticket


class TicketSerializer(serializers.ModelSerializer):
    """Full serializer for creating and listing tickets."""

    class Meta:
        model = Ticket
        fields = [
            "id",
            "title",
            "description",
            "category",
            "priority",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_title(self, value: str) -> str:
        """Reject blank-only titles that pass max_length but carry no content."""
        if not value.strip():
            raise serializers.ValidationError("Title must not be blank.")
        return value

    def validate_description(self, value: str) -> str:
        """Reject blank-only descriptions."""
        if not value.strip():
            raise serializers.ValidationError("Description must not be blank.")
        return value


class TicketUpdateSerializer(serializers.ModelSerializer):
    """Partial-update serializer – restricts writable fields to mutable metadata."""

    class Meta:
        model = Ticket
        fields = ["status", "category", "priority"]


class TicketClassifyRequestSerializer(serializers.Serializer):
    """Validates the classify request – only a non-blank description is needed."""

    description = serializers.CharField()

    def validate_description(self, value: str) -> str:
        """Reject blank-only descriptions that carry no classifiable content."""
        if not value.strip():
            raise serializers.ValidationError("Description must not be blank.")
        return value
