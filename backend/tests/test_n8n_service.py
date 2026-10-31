import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError

from app import n8n_service, receipt_store


def event(email="customer@example.com"):
    return {
        "invoice_id": "test-001",
        "invoice_number": "INV-TEST-001",
        "customer": {"name": "Test Customer", "email": email, "phone": "9876543210"},
        "services": [{"name": "Haircut", "price": 500, "quantity": 1}],
        "final_amount": 590,
    }


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps({"accepted": True}).encode("utf-8")


class N8nReceiptTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        receipt_store.DATABASE_PATH = Path(self.temp_dir.name) / "receipts.db"
        n8n_service.N8N_WEBHOOK_URL = "https://n8n.example.test/webhook/receipt"
        n8n_service.N8N_WEBHOOK_SECRET = "test-secret"
        n8n_service.N8N_MAX_RETRIES = 0

    def tearDown(self):
        self.temp_dir.cleanup()

    @patch("app.n8n_service.urlopen", return_value=FakeResponse())
    def test_successful_delivery_is_pending_until_n8n_callback(self, post):
        result = n8n_service.dispatch_invoice_receipt(event())
        self.assertEqual(result["status"], "PENDING")
        self.assertEqual(post.call_count, 1)

    @patch("app.n8n_service.urlopen", side_effect=URLError("offline"))
    def test_failed_delivery_is_recorded_without_raising(self, _post):
        result = n8n_service.dispatch_invoice_receipt(event())
        self.assertEqual(result["status"], "FAILED")
        self.assertIn("offline", result["last_error"])

    @patch("app.n8n_service.urlopen")
    def test_missing_email_does_not_call_n8n(self, post):
        result = n8n_service.dispatch_invoice_receipt(event(email=""))
        self.assertEqual(result["status"], "FAILED")
        self.assertIn("email", result["last_error"].lower())
        post.assert_not_called()

    @patch("app.n8n_service.urlopen", return_value=FakeResponse())
    def test_duplicate_event_is_not_sent_twice(self, post):
        first = n8n_service.dispatch_invoice_receipt(event())
        second = n8n_service.dispatch_invoice_receipt(event())
        self.assertFalse(first["duplicate"])
        self.assertTrue(second["duplicate"])
        self.assertEqual(post.call_count, 1)


if __name__ == "__main__":
    unittest.main()
