"""Read-only adapter for the existing Salon ERP API.

The ERP stays the source of truth.  This module deliberately exposes a small,
sanitised snapshot to the AI rather than granting an LLM database access.
"""
import json
import os
import re
from datetime import date
from typing import Any, Dict, List, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ERP_API_URL = os.getenv("ERP_API_URL", "http://localhost/renu-api/index.php")
TIMEOUT_SECONDS = 4


def _fetch(resource: str) -> List[Dict[str, Any]]:
    """Fetch one existing ERP collection without changing ERP state."""
    url = f"{ERP_API_URL}?{urlencode({'type': resource})}"
    try:
        with urlopen(url, timeout=TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
        return []
    return payload if isinstance(payload, list) else []


def create_appointment(booking: Dict[str, Any]) -> bool:
    """Create the confirmed AI request in the existing ERP appointment store."""
    services = json.dumps([{"name": booking.get("service", "")}])
    payload = {
        "customer": booking.get("customer_name", ""),
        "phone": booking.get("phone", ""),
        "email": booking.get("customer_email", "") or "",
        "address": "",
        "source": "SalonMate AI",
        "staffId": "",
        "date": booking.get("preferred_date", ""),
        "time": booking.get("preferred_time", ""),
        "status": "Confirmed",
        "services_json": services,
    }
    request = Request(
        f"{ERP_API_URL}?{urlencode({'type': 'appointments'})}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            result = json.loads(response.read().decode("utf-8"))
        return isinstance(result, dict) and result.get("success") is True
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError):
        return False


def appointment_exists(booking: Dict[str, Any]) -> bool:
    """Return whether this AI request is already present in the ERP."""
    for appointment in _fetch("appointments"):
        if (
            str(appointment.get("phone", "")) == str(booking.get("phone", ""))
            and str(appointment.get("date", "")) == str(booking.get("preferred_date", ""))
            and str(appointment.get("time", "")) == str(booking.get("preferred_time", ""))
        ):
            return True
    return False


def _asks_for(question: str, *terms: str) -> bool:
    return any(re.search(rf"\b{re.escape(term)}\b", question, re.I) for term in terms)


def _safe_services(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {key: row.get(key) for key in ("name", "category", "price", "duration")}
        for row in rows[:50]
    ]


def _safe_staff(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{key: row.get(key) for key in ("name", "role")} for row in rows[:50]]


def _safe_appointments(rows: List[Dict[str, Any]], requested_date: str = "") -> List[Dict[str, Any]]:
    result = []
    for row in rows:
        if requested_date and str(row.get("date", "")) != requested_date:
            continue
        # Do not send customer name, phone, email or address to the LLM.
        result.append({key: row.get(key) for key in ("date", "time", "staffId", "status", "services_json")})
    return result[:60]


def _safe_inventory(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{key: row.get(key) for key in ("name", "qty", "price")} for row in rows[:50]]


def _sales_summary(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    today = date.today().isoformat()
    today_rows = [row for row in rows if str(row.get("date", "")) == today]
    total = sum(float(row.get("total") or 0) for row in today_rows)
    return {"date": today, "invoice_count": len(today_rows), "revenue": round(total, 2)}


def live_context_for(question: str) -> Tuple[Dict[str, Any], List[str]]:
    """Return only data relevant to a chat question and its source labels.

    The frontend can keep using its PHP API.  FastAPI calls the same API at
    request time, so the answer is based on the current ERP state.
    """
    normalized = question.lower()
    context: Dict[str, Any] = {}
    sources: List[str] = []
    date_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", normalized)
    requested_date = date_match.group(1) if date_match else ""

    if _asks_for(
        normalized,
        "price", "prices", "cost", "costs", "rate", "rates", "service", "services",
        "salon", "treatment", "treatments", "beauty", "care", "offer", "offers",
        "recommend", "recommendation", "facial", "haircut", "hair", "spa", "manicure", "pedicure",
    ):
        services = _safe_services(_fetch("services"))
        if services:
            context["services"] = services
            sources.append("live_erp_services")

    if _asks_for(normalized, "book", "booking", "appointment", "appointments", "slot", "slots", "available", "availability", "free", "schedule", "time"):
        appointments = _safe_appointments(_fetch("appointments"), requested_date)
        context["appointments"] = appointments
        context["requested_date"] = requested_date or None
        sources.append("live_erp_appointments")

    if _asks_for(normalized, "staff", "therapist", "stylist", "artist", "who"):
        staff = _safe_staff(_fetch("staff"))
        if staff:
            context["staff"] = staff
            sources.append("live_erp_staff")

    if _asks_for(normalized, "stock", "inventory", "product", "products", "available product"):
        inventory = _safe_inventory(_fetch("inventory"))
        if inventory:
            context["inventory"] = inventory
            sources.append("live_erp_inventory")

    if _asks_for(normalized, "revenue", "sales", "sale", "earning", "earnings", "income", "today"):
        invoices = _fetch("invoices")
        if invoices:
            context["sales_summary"] = _sales_summary(invoices)
            sources.append("live_erp_invoices")

    return context, sources
