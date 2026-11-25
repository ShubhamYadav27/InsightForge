"""
Unit tests for the LLM classification service and /api/tickets/classify/ endpoint.

All tests run offline – the Gemini API is never called. We test:
  a) Missing LLM_API_KEY → safe fallback with 200 OK
  b) Valid mocked LLM JSON → validated category & priority
  c) Malformed / invalid LLM values → safe null fallback
"""

from unittest.mock import MagicMock, patch

from django.test import TestCase
from rest_framework.test import APIClient

from tickets.services.llm_service import _validate_classification, classify_ticket


class ValidateClassificationTest(TestCase):
    """Direct tests for the validation helper."""

    def test_valid_values_pass_through(self) -> None:
        """Known-good enum values are returned unchanged."""
        data = {"suggested_category": "technical", "suggested_priority": "high"}
        result = _validate_classification(data)
        self.assertEqual(result["suggested_category"], "technical")
        self.assertEqual(result["suggested_priority"], "high")

    def test_invalid_category_becomes_none(self) -> None:
        """An out-of-range category is replaced with None."""
        data = {"suggested_category": "INVALID", "suggested_priority": "low"}
        result = _validate_classification(data)
        self.assertIsNone(result["suggested_category"])
        self.assertEqual(result["suggested_priority"], "low")

    def test_invalid_priority_becomes_none(self) -> None:
        """An out-of-range priority is replaced with None."""
        data = {"suggested_category": "billing", "suggested_priority": "URGENT"}
        result = _validate_classification(data)
        self.assertEqual(result["suggested_category"], "billing")
        self.assertIsNone(result["suggested_priority"])

    def test_missing_keys_become_none(self) -> None:
        """Completely absent keys default to None."""
        result = _validate_classification({})
        self.assertIsNone(result["suggested_category"])
        self.assertIsNone(result["suggested_priority"])


class ClassifyTicketServiceTest(TestCase):
    """Tests for the classify_ticket function itself."""

    @patch.dict("os.environ", {"LLM_API_KEY": ""}, clear=False)
    def test_missing_api_key_returns_fallback(self) -> None:
        """When LLM_API_KEY is empty the service returns None values without error."""
        result = classify_ticket("My server is on fire")
        self.assertIsNone(result["suggested_category"])
        self.assertIsNone(result["suggested_priority"])

    @patch.dict("os.environ", {"LLM_API_KEY": "test-key-123"}, clear=False)
    @patch("tickets.services.llm_service.genai.Client")
    def test_valid_llm_response(self, mock_client_cls: MagicMock) -> None:
        """A well-formed LLM response is validated and returned."""
        mock_response = MagicMock()
        mock_response.text = '{"suggested_category": "billing", "suggested_priority": "medium"}'
        mock_client_cls.return_value.models.generate_content.return_value = mock_response

        result = classify_ticket("I was double-charged on my invoice")
        self.assertEqual(result["suggested_category"], "billing")
        self.assertEqual(result["suggested_priority"], "medium")

    @patch.dict("os.environ", {"LLM_API_KEY": "test-key-123"}, clear=False)
    @patch("tickets.services.llm_service.genai.Client")
    def test_invalid_llm_values_fallback(self, mock_client_cls: MagicMock) -> None:
        """Out-of-range LLM values are replaced with None."""
        mock_response = MagicMock()
        mock_response.text = '{"suggested_category": "GARBAGE", "suggested_priority": "NONSENSE"}'
        mock_client_cls.return_value.models.generate_content.return_value = mock_response

        result = classify_ticket("some description")
        self.assertIsNone(result["suggested_category"])
        self.assertIsNone(result["suggested_priority"])

    @patch.dict("os.environ", {"LLM_API_KEY": "test-key-123"}, clear=False)
    @patch("tickets.services.llm_service.genai.Client")
    def test_llm_exception_returns_fallback(self, mock_client_cls: MagicMock) -> None:
        """Network errors or SDK exceptions are caught and return None values."""
        mock_client_cls.return_value.models.generate_content.side_effect = RuntimeError("timeout")

        result = classify_ticket("something broke")
        self.assertIsNone(result["suggested_category"])
        self.assertIsNone(result["suggested_priority"])

    @patch.dict("os.environ", {"LLM_API_KEY": "test-key-123"}, clear=False)
    @patch("tickets.services.llm_service.genai.Client")
    def test_empty_response_text_returns_fallback(self, mock_client_cls: MagicMock) -> None:
        """An empty response body from the LLM returns None values."""
        mock_response = MagicMock()
        mock_response.text = ""
        mock_client_cls.return_value.models.generate_content.return_value = mock_response

        result = classify_ticket("help")
        self.assertIsNone(result["suggested_category"])
        self.assertIsNone(result["suggested_priority"])


class ClassifyEndpointTest(TestCase):
    """Integration tests for POST /api/tickets/classify/."""

    def setUp(self) -> None:
        self.client = APIClient()

    @patch.dict("os.environ", {"LLM_API_KEY": ""}, clear=False)
    def test_missing_api_key_returns_200_with_nulls(self) -> None:
        """Endpoint returns 200 with null suggestions when API key is absent."""
        response = self.client.post(
            "/api/tickets/classify/",
            {"description": "Cannot access my account"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["suggested_category"])
        self.assertIsNone(response.json()["suggested_priority"])

    def test_missing_description_returns_400(self) -> None:
        """Endpoint rejects requests with no description."""
        response = self.client.post("/api/tickets/classify/", {}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_blank_description_returns_400(self) -> None:
        """Endpoint rejects blank-only description."""
        response = self.client.post(
            "/api/tickets/classify/",
            {"description": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    @patch.dict("os.environ", {"LLM_API_KEY": "test-key-123"}, clear=False)
    @patch("tickets.services.llm_service.genai.Client")
    def test_valid_response_returns_200(self, mock_client_cls: MagicMock) -> None:
        """Endpoint returns 200 with valid suggestions from mocked LLM."""
        mock_response = MagicMock()
        mock_response.text = '{"suggested_category": "account", "suggested_priority": "critical"}'
        mock_client_cls.return_value.models.generate_content.return_value = mock_response

        response = self.client.post(
            "/api/tickets/classify/",
            {"description": "I cannot log in and I am locked out of everything"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["suggested_category"], "account")
        self.assertEqual(response.json()["suggested_priority"], "critical")
