# SalonMate AI backend

## n8n invoice receipt automation

After the existing ERP payment endpoint confirms an invoice, the React app sends
the complete invoice payload to FastAPI at `/api/automation/invoice-receipt`.
FastAPI stores a delivery record and calls n8n server-side. n8n builds the HTML
receipt, receives the backend-generated PDF, sends it using SMTP, and
updates the delivery status to `SENT` or `FAILED`. A delivery failure never
rolls back the already-successful ERP payment.

### Setup

1. Copy `backend/.env.example` to `backend/.env` and set the n8n webhook URL,
   two different random secrets, `ERP_AUTOMATION_API_URL`, and the sender email.
2. Import `automation/n8n_invoice_receipt.json` into n8n. The backend creates
   the PDF locally with ReportLab, so Docker/Gotenberg is not required.
3. Create an n8n Header Auth credential named `Salon ERP Webhook Header Auth`
   with header `X-N8N-Webhook-Secret` and the same value as
   `N8N_WEBHOOK_SECRET`. Assign it to the webhook node.
4. Create an SMTP credential named `Salon SMTP`, set `RECEIPT_FROM_EMAIL` in
   the n8n environment, and set `N8N_STATUS_API_KEY` to the same value used by
   FastAPI. Activate the workflow and copy its production webhook URL into
   `N8N_INVOICE_WEBHOOK_URL`.
5. Restart FastAPI and the Vite app. Generate a paid invoice with a customer
   email, then inspect the n8n execution and the invoice email status.

The backend keeps `PENDING`, `SENT`, and `FAILED` delivery state in the existing
SQLite database. Duplicate events for the same `invoice_id` are ignored, and
`POST /api/automation/invoice-receipt/{invoice_id}/resend` provides a manual
resend path. n8n status callbacks require `X-Receipt-Status-Key` and the key is
never sent to the browser.

### Local test request

With FastAPI and n8n running, send a confirmed test event:

```powershell
$event = @{ invoice_id = 'test-001'; invoice_number = 'INV-TEST-001'; customer = @{ name = 'Test Customer'; email = 'customer@example.com'; phone = '9876543210' }; salon = @{ name = 'Salon Management System'; phone = '07674-234567'; email = 'contact@salon.com'; address = 'Shop No. 12, Main Market, Maihar, MP - 485771' }; services = @(@{ name = 'Haircut'; price = 500; quantity = 1 }); subtotal = 500; discount = 0; tax = 90; final_amount = 590; payment_method = 'Cash'; payment_status = 'CONFIRMED'; invoice_datetime = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/automation/invoice-receipt -Method Post -ContentType 'application/json' -Body $event
```

This backend adds a Retrieval-Augmented Generation (RAG) chatbot to the salon ERP.
It searches local salon documents in ChromaDB, then sends only relevant context to Gemini.

## Run it

1. Open a terminal in this `backend` folder.
2. Create a virtual environment: `python -m venv .venv`
3. Activate it in PowerShell: `.\.venv\Scripts\Activate.ps1`
4. Install packages: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` and add a free Gemini API key.
6. Start the API: `uvicorn app.main:app --reload --port 8000`

Open `http://127.0.0.1:8000/docs` to see and test the API.

## Live ERP answers

SalonMate reads the existing ERP API at `http://localhost/renu-api/index.php`
when a customer asks about services/prices, appointments, staff, inventory or
today's sales. This is read-only and happens for each relevant chat message.
If your PHP API uses another URL, add this to `backend/.env`:

`ERP_API_URL=http://localhost/renu-api/index.php`

Only a privacy-safe subset of operational data is sent to Gemini: appointment
dates/times and service details, never customer names, mobile numbers, emails
or addresses.

## Add your salon information

Replace the sample content in `knowledge/salon_information.md` with real services, prices, offers and policies. Delete `chroma_db` only when you want to rebuild the search index after changing those documents.

## Current safety boundary

The assistant can answer questions and collect booking details. It does not create appointments yet. The next stage will securely connect a confirmed booking to the existing ERP API.
