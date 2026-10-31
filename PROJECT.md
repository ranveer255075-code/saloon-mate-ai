ntic RAG-Based Salon Management and Appointment Assistant**
# SalonMate AI
an appointment is booked before admin review.
- It does not invent prices, offers, staff, or availability.
- API secrets are stored only in `backend/.env`, which is excluded from Git.

## Future scope

- Connect confirmed AI requests to the existing ERP appointment database.
- WhatsApp/SMS reminders and follow-ups.
- Multilingual Hindi/English voice assistant.
- Analytics for frequently asked salon questions and conversion to booking
## Major project title

**SalonMate AI: An Age
## Problem statement

Salon customers repeatedly ask about services, policies and appointments, while salon staff must manually collect booking details and verify availability. SalonMate AI uses a Large Language Model (LLM), Retrieval-Augmented Generation (RAG), and a controlled booking agent to provide salon-specific answers and create reviewable booking requests.

## Architecture

```text
Customer chat -> React Salon ERP -> FastAPI AI backend
                                      |-> RAG knowledge retrieval
                                      |-> Gemini LLM response
                                      |-> Booking agent / confirmation gate
                                      |-> SQLite booking-request queue
Admin AI Bookings screen <- React ERP <- review / approve request
```

## AI technologies used

- **Gemini LLM**: natural-language customer assistance.
- **RAG**: salon Markdown knowledge is chunked and retrieved before the LLM is called.
- **AI agent workflow**: the booking agent extracts customer details, checks that all required fields exist, and requires explicit confirmation before creating a request.
- **FastAPI**: secure API layer; the Gemini key remains on the server.
- **Vector database ready**: ChromaDB is used where supported; a lightweight local retrieval fallback keeps the project runnable on Windows SQLite installations.
- **SQLite**: persistent queue for AI-created booking requests.

## Demo flow

1. Ask SalonMate about a service or salon policy.
2. Say that you want to book an appointment.
3. Share name, 10-digit mobile number, service, date (`YYYY-MM-DD`) and time (`HH:MM`).
4. Reply **confirm**.
5. Open **AI Bookings** in the ERP; the administrator confirms or declines the request after checking real availability.

## Safety rules

- The assistant never claims s.
