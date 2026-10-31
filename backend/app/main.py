"""FastAPI backend for SalonMate AI.

This first version provides RAG chat. Appointment actions are deliberately kept
as a confirmation-required intent until they are connected to the ERP database.
"""
import os
import json
import re
import hmac
import base64
from difflib import get_close_matches
from datetime import datetime
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, List, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .knowledge_base import SalonKnowledgeBase
from .booking_store import create_booking_request, get_booking_request, list_booking_requests, list_customer_booking_requests, update_booking_status
from .auth_store import customer_from_token, login_customer, register_customer
from .erp_client import appointment_exists, create_appointment, live_context_for
from .n8n_service import dispatch_invoice_receipt
from .receipt_store import get_delivery, list_delivery_statuses, update_delivery_status

load_dotenv()
knowledge_base = SalonKnowledgeBase()
KEY_FILE = Path(__file__).resolve().parents[1] / "gemini-config.txt"


def get_gemini_api_key() -> str:
    """Read a normal text-file fallback for beginners who cannot save .env files on Windows."""
    environment_key = os.getenv("GEMINI_API_KEY", "").strip()
    if environment_key:
        return environment_key
    if KEY_FILE.exists():
        return KEY_FILE.read_text(encoding="utf-8").strip()
    return ""


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=50)


class ChatResponse(BaseModel):
    reply: str
    sources: List[str] = Field(default_factory=list)
    booking_draft: dict = Field(default_factory=dict)
    agent_action: str = "answered_with_rag"


class BookingStatusUpdate(BaseModel):
    status: str = Field(pattern="^(Pending review|Confirmed|Declined)$")


class CustomerCredentials(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=128)


class CustomerRegistration(CustomerCredentials):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(pattern="^[6-9][0-9]{9}$")


class ReceiptServiceLine(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(ge=0)
    quantity: int = Field(default=1, ge=1, le=100)


class ReceiptCustomer(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(default="", max_length=320)
    phone: str = Field(default="", max_length=30)


class ReceiptSalon(BaseModel):
    name: str = Field(default="Salon Management System", max_length=200)
    phone: str = Field(default="", max_length=40)
    email: str = Field(default="", max_length=320)
    address: str = Field(default="", max_length=500)


class InvoiceReceiptEvent(BaseModel):
    invoice_id: str = Field(min_length=1, max_length=100)
    invoice_number: str = Field(min_length=1, max_length=100)
    customer: ReceiptCustomer
    salon: ReceiptSalon = Field(default_factory=ReceiptSalon)
    services: List[ReceiptServiceLine] = Field(min_length=1, max_length=100)
    subtotal: float = Field(ge=0)
    discount: float = Field(default=0, ge=0)
    tax: float = Field(default=0, ge=0)
    final_amount: float = Field(ge=0)
    payment_method: str = Field(min_length=1, max_length=80)
    payment_status: str = Field(pattern="^CONFIRMED$")
    invoice_datetime: str = Field(min_length=1, max_length=80)


class InvoiceEmailStatusUpdate(BaseModel):
    invoice_id: str = Field(min_length=1, max_length=100)
    status: str = Field(pattern="^(PENDING|SENT|FAILED)$")
    error: str = Field(default="", max_length=1000)
    execution_id: str = Field(default="", max_length=200)


MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2,
    "mar": 3, "march": 3, "apr": 4, "april": 4,
    "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "octuber": 10, "octtuber": 10,
    "nov": 11, "november": 11, "novemeber": 11, "novmber": 11,
    "dec": 12, "december": 12,
}

SERVICE_ALIASES = {
    "haircut": "Haircut",
    "hair cut": "Haircut",
    "hair spa": "Hair Spa",
    "facial": "Facial",
    "manicure": "Manicure",
    "pedicure": "Pedicure",
}


def _normalised_dates(text: str) -> List[tuple[int, str]]:
    """Return user-entered dates in ISO format, preserving their text order."""
    matches: List[tuple[int, str]] = []
    patterns = [
        (r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", lambda m: (int(m.group(1)), int(m.group(2)), int(m.group(3)))),
        (r"\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b", lambda m: (int(m.group(1)), int(m.group(2)), int(m.group(3)))),
        (r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b", lambda m: (int(m.group(3)), int(m.group(2)), int(m.group(1)))),
        (r"\b(\d{1,2})(?:st|nd|rd|th)?[ \t]+([a-z]+)[ \t]+(20\d{2})\b", lambda m: (int(m.group(3)), MONTHS.get(m.group(2).lower(), 0), int(m.group(1)))),
        (r"\b([a-z]+)[ \t]+(\d{1,2})(?:st|nd|rd|th)?(?:,)?[ \t]+(20\d{2})\b", lambda m: (int(m.group(3)), MONTHS.get(m.group(1).lower(), 0), int(m.group(2)))),
        (r"\b(\d{1,2})(?:st|nd|rd|th)?[ \t]*([a-z]+)\b", lambda m: (datetime.now().year, MONTHS.get(m.group(2).lower(), 0), int(m.group(1)))),
        (r"\b(\d{1,2})(?:st|nd|rd|th)?[ \t]+([a-z]+)\b", lambda m: (datetime.now().year, MONTHS.get(m.group(2).lower(), 0), int(m.group(1)))),
        (r"\b([a-z]+)[ \t]+(\d{1,2})(?:st|nd|rd|th)?\b", lambda m: (datetime.now().year, MONTHS.get(m.group(1).lower(), 0), int(m.group(2)))),
    ]
    for pattern, values in patterns:
        for match in re.finditer(pattern, text, re.I):
            year, month, day = values(match)
            try:
                parsed = datetime(year, month, day).date().isoformat()
            except ValueError:
                continue
            matches.append((match.start(), parsed))
    return sorted(matches)


def _normalised_times(text: str) -> List[tuple[int, str]]:
    """Return user-entered times as HH:MM, supporting 24-hour and AM/PM input."""
    matches: List[tuple[int, str]] = []
    for match in re.finditer(r"\b(?:[01]?\d|2[0-3]):[0-5]\d\b", text):
        matches.append((match.start(), match.group(0)))
    for match in re.finditer(r"\b(1[0-2]|0?[1-9])(?:[:.](\d{2}))?\s*(am|pm|a\.m\.?|p\.m\.?)\b", text, re.I):
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        period = match.group(3).lower().replace(".", "")
        if period == "pm" and hour != 12:
            hour += 12
        if period == "am" and hour == 12:
            hour = 0
        matches.append((match.start(), f"{hour:02d}:{minute:02d}"))
    return sorted(matches, key=lambda item: item[0])


def _extract_service(text: str) -> str:
    """Extract a service while tolerating small spelling mistakes."""
    normalized = re.sub(r"[^a-z ]", " ", text.lower())
    if re.search(r"\b(facial|facal)\s+gol+d?\b", normalized):
        return "Facial Gold"
    for phrase, label in sorted(SERVICE_ALIASES.items(), key=lambda item: -len(item[0])):
        if phrase in normalized:
            return label
    for word in normalized.split():
        close = get_close_matches(word, ["haircut", "facial", "manicure", "pedicure", "spa"], n=1, cutoff=0.72)
        if close:
            return {"haircut": "Haircut", "facial": "Facial", "manicure": "Manicure", "pedicure": "Pedicure", "spa": "Hair Spa"}[close[0]]
    return ""


def authenticated_customer(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return customer_from_token(authorization.removeprefix("Bearer ").strip())


def booking_details_from_conversation(request: ChatRequest) -> dict:
    """Extract a draft for the booking tool; it is never an automatic appointment."""
    # Only user messages are booking data. Assistant messages can contain the
    # example date/time (and example name/phone) shown in the missing-fields
    # prompt; including them makes those example values look like real input.
    user_messages = [item.content for item in request.history if item.role == "user"]
    user_messages.append(request.message)
    transcript = "\n".join(user_messages)
    details = {"name": "", "phone": "", "service": "", "date": "", "time": ""}
    phone_matches = re.findall(r"(?<!\d)(?:\+91[- ]?)?([6-9](?:[\s-]?\d){9})(?!\d)", transcript)
    phone_match = re.sub(r"\D", "", phone_matches[-1]) if phone_matches else ""
    if phone_match:
        details["phone"] = phone_match
    name_matches = re.findall(r"(?:my name(?: is)?|i am|i'm|name is)\s+([A-Za-z][A-Za-z .'-]{1,50})", transcript, re.I)
    # Customers often type short forms/typos such as "sanam is my nae".
    reverse_name = re.findall(r"\b([A-Za-z][A-Za-z'-]{1,40})\s+is\s+my\s+n(?:ame|ae)\b", transcript, re.I)
    name_matches += reverse_name
    comma_names = re.findall(
        r"(?:^|\n)\s*([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2})\s*,",
        transcript,
        re.I,
    )
    name_matches += comma_names
    if name_matches:
        details["name"] = name_matches[-1].strip(" .")
    if not details["name"]:
        ignored_names = {"confirm", "yes", "haan", "han", "book appointment", "book it"}
        ignored_name_words = {
            "ok", "okay", "hi", "hello", "hey", "book", "booking", "appointment", "apointment",
            "reserve", "schedule", "tell", "me", "service", "services", "facial", "gold", "want", "need",
        }
        for candidate_message in reversed(user_messages):
            candidate = candidate_message.strip()
            candidate_words = set(candidate.lower().split())
            if (re.fullmatch(r"[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){0,2}", candidate)
                    and candidate.lower() not in ignored_names
                    and not candidate_words.intersection(ignored_name_words)):
                details["name"] = candidate
                break
    service = "Facial Gold" if re.search(r"\bfacial\s+gol(?:d)?\b", transcript, re.I) else _extract_service(transcript)
    if service:
        details["service"] = service
    date_matches = _normalised_dates(transcript)
    if date_matches:
        details["date"] = date_matches[-1][1]
    time_matches = _normalised_times(transcript)
    if time_matches:
        details["time"] = time_matches[-1][1]
    return details


def has_booking_confirmation(message: str) -> bool:
    return bool(re.search(r"\b(confirm|yes,? confirm|book it|go ahead|haan|han)\b", message, re.I))


def is_booking_conversation(request: ChatRequest) -> bool:
    """Start booking only when the customer actually asks to book.

    A service name by itself (for example, "What is the Facial price?") is an
    information request, not permission to start asking for booking fields.
    """
    if (
        re.search(r"\b(policy|policies|rules|process|how does)\b", request.message, re.I)
        and not re.search(r"\b(i want|i would like|book me|reserve me|schedule me)\b", request.message, re.I)
    ):
        return False
    if (
        re.search(r"\b(want|would like|need)\b", request.message, re.I)
        and _extract_service(request.message)
        and (re.search(r"\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+)\b", request.message, re.I)
             or re.search(r"\b[6-9]\d{9}\b", request.message))
    ):
        return True
    if re.search(r"\b(book|booking|appointment|reserve|schedule)\b", request.message, re.I):
        return True
    prior_assistant_text = "\n".join(
        item.content for item in request.history if item.role == "assistant"
    )
    return bool(re.search(
        r"prepare your booking request|booking details|preferred time|share these booking details|reply ['\"]?confirm|sent to the salon for review",
        prior_assistant_text,
        re.I,
    ))


def fallback_chat_reply(question: str, context_chunks: List[str], live_context: dict) -> str:
    """Give a grounded answer when Gemini is temporarily unreachable."""
    if re.match(r"^\s*(hi|hello|hey)\b", question, re.I):
        return "Hello! I can help with salon services, prices, hair and facial care, bookings, and appointment requests."

    services = live_context.get("services", [])
    if services:
        question_lower = question.lower()
        service_terms = [
            "facial", "hair spa", "haircut", "hair cut", "hair colour", "hair color",
            "manicure", "pedicure", "spa",
        ]
        requested_terms = [term for term in service_terms if term in question_lower]
        if requested_terms:
            selected_services = [
                service for service in services
                if any(term in str(service.get("name", "")).lower() for term in requested_terms)
            ]
        else:
            selected_services = services
        selected_services = selected_services or services
        lines = []
        for service in selected_services:
            parts = [str(service.get("name") or "Unnamed service")]
            if service.get("price") is not None:
                parts.append(f"Price: ₹{service['price']}")
            if service.get("duration") is not None:
                parts.append(f"Duration: {service['duration']}")
            lines.append("- " + " — ".join(parts))
        heading = "Here are the matching salon services:" if requested_terms else "Here are all current salon services:"
        return heading + "\n" + "\n".join(lines)

    knowledge = "\n".join(context_chunks)
    if re.search(r"price|cost|rate", question, re.I):
        return "I could not load the current salon prices right now. Please try again after the live ERP connection is available."

    if context_chunks and re.search(
        r"service|services|treatment|treatments|offer|offers|facial|hair|spa|manicure|pedicure",
        question,
        re.I,
    ):
        service_items = re.findall(r"(?m)^-\s+(.+)$", knowledge)
        if service_items:
            return "Our salon knowledge lists these services:\n" + "\n".join(
                f"- {item}" for item in service_items[:4]
            )

    if context_chunks and re.search(r"book|booking|appointment|reserve|schedule|policy|confirm", question, re.I):
        return (
            "For a booking, please share your name, mobile number, preferred service, date and time. "
            "The salon administrator must confirm final availability, and I will ask for your confirmation "
            "before sending the request for review."
        )

    return (
        "I can help with salon services, prices, hair and facial care, booking policies, and appointment requests. "
        "Please ask a specific salon question."
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    knowledge_base.seed()
    yield


app = FastAPI(title="SalonMate AI API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    # Vite selects the next free port when 5173 is occupied.  Accept any
    # local development port so the customer portal can still call this API.
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "knowledge_chunks": knowledge_base.count(), "booking_requests": len(list_booking_requests())}


def _require_n8n_status_key(provided_key: Optional[str]) -> None:
    """Only n8n may write delivery status back into the backend."""
    expected_key = os.getenv("N8N_STATUS_API_KEY", "").strip()
    if not expected_key or not provided_key or not hmac.compare_digest(provided_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid receipt status API key.")


@app.post("/api/automation/invoice-receipt", status_code=202)
def queue_invoice_receipt(payload: InvoiceReceiptEvent):
    """Notify n8n after ERP payment/invoice success.

    This endpoint intentionally returns 202 even when n8n is unavailable: the
    invoice/payment has already succeeded and delivery can be retried later.
    """
    result = dispatch_invoice_receipt(payload.dict())
    return {
        "accepted": True,
        "invoice_id": payload.invoice_id,
        "email_status": result.get("status", "FAILED"),
        "duplicate": result.get("duplicate", False),
        "error": result.get("last_error", ""),
    }


@app.post("/api/automation/invoice-receipt/{invoice_id}/resend", status_code=202)
def resend_invoice_receipt(invoice_id: str):
    delivery = get_delivery(invoice_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Receipt delivery record not found.")
    payload = json.loads(delivery["payload_json"])
    result = dispatch_invoice_receipt(payload, force=True)
    return {
        "accepted": True,
        "invoice_id": invoice_id,
        "email_status": result.get("status", "FAILED"),
        "error": result.get("last_error", ""),
    }


@app.get("/api/automation/invoice-receipt/{invoice_id}/pdf")
def download_invoice_receipt(invoice_id: str):
    """Return the persisted receipt PDF for viewing or downloading."""
    delivery = get_delivery(invoice_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Receipt delivery record not found.")

    try:
        payload = json.loads(delivery["payload_json"])
        pdf_data = base64.b64decode(payload.get("receipt_pdf_base64", ""), validate=True)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        pdf_data = b""

    if not pdf_data:
        raise HTTPException(status_code=404, detail="Saved receipt PDF is not available.")

    filename = payload.get("receipt_pdf_filename") or f"{delivery['invoice_number']}.pdf"
    safe_filename = Path(str(filename)).name
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe_filename}"'},
    )


@app.get("/api/automation/invoice-receipt/{invoice_id}")
def invoice_receipt_status(invoice_id: str):
    delivery = get_delivery(invoice_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="Receipt delivery record not found.")
    delivery.pop("payload_json", None)
    return delivery


@app.get("/api/automation/invoice-statuses")
def invoice_receipt_statuses():
    return list_delivery_statuses()


@app.post("/api/automation/invoice-email-status")
def update_invoice_email_status(
    update: InvoiceEmailStatusUpdate,
    status_key: Optional[str] = Header(default=None, alias="X-Receipt-Status-Key"),
):
    _require_n8n_status_key(status_key)
    delivery = update_delivery_status(
        update.invoice_id, update.status, update.error, update.execution_id
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Receipt delivery record not found.")
    return {
        "success": True,
        "invoice_id": update.invoice_id,
        "email_status": delivery["status"],
    }


@app.post("/api/customer-auth/register")
def customer_register(payload: CustomerRegistration):
    try:
        return register_customer(payload.name.strip(), payload.phone, payload.email.strip(), payload.password)
    except Exception as error:
        if "UNIQUE constraint failed" in str(error):
            raise HTTPException(status_code=409, detail="An account already exists with this email or phone number.") from error
        raise


@app.post("/api/customer-auth/login")
def customer_login(payload: CustomerCredentials):
    result = login_customer(payload.email.strip(), payload.password)
    if not result:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return result


@app.get("/api/customer/me")
def customer_me(authorization: Optional[str] = Header(default=None)):
    customer = authenticated_customer(authorization)
    if not customer:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return customer


@app.get("/api/customer/bookings")
def customer_bookings(authorization: Optional[str] = Header(default=None)):
    customer = authenticated_customer(authorization)
    if not customer:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return list_customer_booking_requests(customer["id"])


@app.get("/api/booking-requests")
def get_booking_requests():
    """Admin-only screen consumes this queue; it does not create ERP appointments itself."""
    return list_booking_requests()


@app.post("/api/booking-requests/{request_id}/status")
def set_booking_request_status(request_id: int, update: BookingStatusUpdate):
    booking = get_booking_request(request_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking request not found.")
    if update.status == "Confirmed" and not appointment_exists(booking):
        if not create_appointment(booking):
            raise HTTPException(
                status_code=502,
                detail="Could not create the appointment in the ERP. The AI booking remains pending.",
            )
    if not update_booking_status(request_id, update.status):
        raise HTTPException(status_code=404, detail="Booking request not found.")
    return {"success": True, "id": request_id, "status": update.status}


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest, authorization: Optional[str] = Header(default=None)):
    customer = authenticated_customer(authorization)
    booking_draft = booking_details_from_conversation(request)
    if customer:
        booking_draft["name"] = customer["name"]
        booking_draft["phone"] = customer["phone"]
    missing_booking_fields = [label for key, label in {
        "name": "name", "phone": "mobile number", "service": "service", "date": "date", "time": "preferred time"
    }.items() if not booking_draft[key]]
    # A service mention alone must still receive a normal factual answer.
    # "slot" alone is also commonly an availability question, so both are
    # handled by the live ERP context unless the user explicitly starts booking.
    booking_language = is_booking_conversation(request)
    if booking_language and not missing_booking_fields and has_booking_confirmation(request.message):
        saved = create_booking_request(booking_draft, customer)
        return ChatResponse(
            reply=("Your booking request has been sent to the salon for review. "
                   "The administrator will confirm availability before an appointment is created."),
            booking_draft=saved,
            agent_action="booking_request_created",
        )

    if booking_language and missing_booking_fields:
        if len(missing_booking_fields) == 1:
            examples = {
                "name": "Priyanka",
                "mobile number": "9876543210",
                "service": "Facial",
                "date": "31 Oct 2026",
                "preferred time": "2 PM",
            }
            example = examples.get(missing_booking_fields[0], "your details")
            missing_reply = f"Please share your {missing_booking_fields[0]} (for example, {example})."
        else:
            missing_reply = "Please share these booking details: " + ", ".join(missing_booking_fields) + "."
        return ChatResponse(
            reply=missing_reply,
            booking_draft=booking_draft,
            agent_action="booking_details_needed",
        )
    if booking_language:
        return ChatResponse(
            reply=(f"I have your request for {booking_draft['service']} on {booking_draft['date']} at "
                   f"{booking_draft['time']}. Should I send it to the salon for admin review? "
                   "Reply Confirm or Yes. An administrator will check availability first."),
            booking_draft=booking_draft,
            agent_action="booking_confirmation_needed",
        )

    # The ERP is queried for every relevant message, so prices, staff, slots,
    # inventory and sales summaries are not stale RAG content.
    live_context, live_sources = live_context_for(request.message)
    api_key = get_gemini_api_key()
    if not api_key or api_key == "replace_with_your_key" or api_key == "PASTE_YOUR_KEY_HERE":
        if live_context:
            return ChatResponse(
                reply=("I found live ERP data, but natural-language AI is not configured yet. "
                       "Add GEMINI_API_KEY to backend/.env and restart the backend to receive a specific answer."),
                sources=live_sources,
                booking_draft=booking_draft,
                agent_action="live_data_found_ai_not_configured",
            )
        raise HTTPException(
            status_code=503,
            detail="AI is not configured. Add your Gemini API key to backend/.env and restart the backend.",
        )

    context_chunks = knowledge_base.search(request.message)
    context = "\n\n---\n\n".join(context_chunks) or "No salon knowledge was found."
    live_context_text = json.dumps(live_context, ensure_ascii=False, default=str) or "No matching live ERP data was found."
    conversation = "\n".join(f"{item.role.title()}: {item.content}" for item in request.history)
    prompt = f"""You are SalonMate AI, a helpful assistant for a salon.

Use only the salon knowledge below for facts about prices, offers, staff and availability.
The LIVE ERP DATA was fetched just now and takes priority over salon knowledge.
When the customer asks generally about salon services or treatments, list all
matching current services with their price and duration when available.
Use it for precise answers. It is a privacy-safe operational snapshot, so never
ask for or infer other customers' identity or contact details. If a date has
appointments, describe them as occupied slots; do not say a time is available
unless it is explicitly supported by the data and salon working hours are known.
If information is missing, say that clearly. Do not claim an appointment is booked;
collect name, phone, service, date and time, then ask the customer to confirm.
For health conditions, do not diagnose and advise a qualified professional.

SALON KNOWLEDGE:
{context}

LIVE ERP DATA:
{live_context_text}

CONVERSATION:
{conversation}

CUSTOMER: {request.message}
ASSISTANT:"""
    try:
        model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
        api_request = Request(endpoint, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(api_request, timeout=45) as api_response:
            result = json.loads(api_response.read().decode("utf-8"))
        reply = result["candidates"][0]["content"]["parts"][0]["text"]
    except HTTPError as error:
        # Show a useful provider error without ever exposing the API key.
        try:
            error_message = json.loads(error.read().decode("utf-8")).get("error", {}).get("message", "")
        except (json.JSONDecodeError, UnicodeDecodeError):
            error_message = ""
        detail = f"Gemini request failed (HTTP {error.code})"
        if error_message:
            detail = f"{detail}: {error_message}"
        fallback = fallback_chat_reply(request.message, context_chunks, live_context)
        return ChatResponse(
            reply=fallback,
            sources=(['salon_information.md'] if context_chunks else []) + live_sources,
            booking_draft=booking_draft,
            agent_action="answered_with_rag_fallback",
        )
    except (URLError, KeyError, IndexError, json.JSONDecodeError) as error:
        fallback = fallback_chat_reply(request.message, context_chunks, live_context)
        return ChatResponse(
            reply=fallback,
            sources=(['salon_information.md'] if context_chunks else []) + live_sources,
            booking_draft=booking_draft,
            agent_action="answered_with_rag_fallback",
        )
    return ChatResponse(
        reply=reply,
        sources=(["salon_information.md"] if context_chunks else []) + live_sources,
        booking_draft=booking_draft,
        agent_action="answered_with_rag",
    )
