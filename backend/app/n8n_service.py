"""Server-side n8n webhook integration for invoice receipt delivery."""
import json
import logging
import os
import time
import base64
from typing import Any, Dict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

from .receipt_store import create_pending_delivery, get_delivery, update_delivery_status
from .receipt_pdf import build_receipt_pdf


load_dotenv()
LOGGER = logging.getLogger(__name__)
N8N_WEBHOOK_URL = os.getenv("N8N_INVOICE_WEBHOOK_URL", "").strip()
N8N_WEBHOOK_SECRET = os.getenv("N8N_WEBHOOK_SECRET", "").strip()
N8N_TIMEOUT_SECONDS = float(os.getenv("N8N_REQUEST_TIMEOUT_SECONDS", "8"))
N8N_MAX_RETRIES = max(0, int(os.getenv("N8N_MAX_RETRIES", "2")))


def _post_to_n8n(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not N8N_WEBHOOK_URL:
        raise RuntimeError("N8N_INVOICE_WEBHOOK_URL is not configured")
    if not N8N_WEBHOOK_SECRET:
        raise RuntimeError("N8N_WEBHOOK_SECRET is not configured")
    request = Request(
        N8N_WEBHOOK_URL,
        data=json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-N8N-Webhook-Secret": N8N_WEBHOOK_SECRET,
        },
        method="POST",
    )
    with urlopen(request, timeout=N8N_TIMEOUT_SECONDS) as response:
        response_body = response.read().decode("utf-8")
    try:
        return json.loads(response_body) if response_body else {"accepted": True}
    except json.JSONDecodeError:
        return {"accepted": True, "raw_response": response_body[:500]}


def dispatch_invoice_receipt(payload: Dict[str, Any], force: bool = False) -> Dict[str, Any]:
    """Queue a receipt delivery and attempt n8n without failing the invoice call."""
    invoice_id = str(payload["invoice_id"])
    existing = get_delivery(invoice_id)
    if existing and existing["status"] == "SENT" and not force:
        return {**existing, "duplicate": True}
    if existing and existing["status"] == "PENDING" and not force:
        return {**existing, "duplicate": True}

    customer_email = str(payload.get("customer", {}).get("email", "")).strip()
    enriched_payload = dict(payload)
    if not enriched_payload.get("receipt_pdf_base64"):
        enriched_payload["receipt_pdf_base64"] = base64.b64encode(build_receipt_pdf(payload)).decode("ascii")
    enriched_payload["receipt_pdf_filename"] = f"{payload['invoice_number']}.pdf"
    delivery = create_pending_delivery(enriched_payload, force=force)
    if not customer_email:
        failed = update_delivery_status(invoice_id, "FAILED", "Customer email is missing") or delivery
        return {**failed, "duplicate": False}
    try:
        response = None
        for attempt in range(N8N_MAX_RETRIES + 1):
            try:
                response = _post_to_n8n(enriched_payload)
                break
            except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
                if attempt >= N8N_MAX_RETRIES:
                    raise
                LOGGER.warning("n8n receipt attempt %s failed for %s: %s", attempt + 1, invoice_id, error)
                time.sleep(0.25 * (2 ** attempt))
        return {
            **delivery,
            "status": "PENDING",
            "n8n_response": response or {},
            "duplicate": False,
        }
    except Exception as error:  # Delivery must never roll back payment/invoice creation.
        LOGGER.exception("Could not dispatch receipt %s to n8n", invoice_id)
        failed = update_delivery_status(invoice_id, "FAILED", str(error)) or delivery
        return {**failed, "duplicate": False}
