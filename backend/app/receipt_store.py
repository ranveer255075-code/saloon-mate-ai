"""Persistent delivery state for invoice receipt emails.

The ERP remains the source of truth for invoices.  This small local table only
tracks the asynchronous n8n delivery, making retries and duplicate prevention
safe without changing the existing PHP ERP schema.
"""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from .booking_store import DATABASE_PATH


def _connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """CREATE TABLE IF NOT EXISTS receipt_deliveries (
            invoice_id TEXT PRIMARY KEY,
            invoice_number TEXT NOT NULL,
            customer_email TEXT,
            status TEXT NOT NULL CHECK(status IN ('PENDING', 'SENT', 'FAILED')),
            attempts INTEGER NOT NULL DEFAULT 0,
            payload_json TEXT NOT NULL,
            last_error TEXT,
            n8n_execution_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )"""
    )
    connection.commit()
    return connection


def get_delivery(invoice_id: str) -> Optional[Dict[str, Any]]:
    with _connection() as connection:
        row = connection.execute(
            "SELECT * FROM receipt_deliveries WHERE invoice_id = ?", (invoice_id,)
        ).fetchone()
    return dict(row) if row else None


def create_pending_delivery(payload: Dict[str, Any], force: bool = False) -> Dict[str, Any]:
    invoice_id = str(payload["invoice_id"])
    now = datetime.now(timezone.utc).isoformat()
    encoded_payload = json.dumps(payload, ensure_ascii=False, default=str)
    with _connection() as connection:
        existing = connection.execute(
            "SELECT * FROM receipt_deliveries WHERE invoice_id = ?", (invoice_id,)
        ).fetchone()
        if existing and not force:
            return dict(existing)
        if existing:
            connection.execute(
                """UPDATE receipt_deliveries
                   SET invoice_number = ?, customer_email = ?, status = 'PENDING',
                       attempts = attempts + 1, payload_json = ?, last_error = NULL,
                       updated_at = ? WHERE invoice_id = ?""",
                (
                    payload["invoice_number"], payload.get("customer", {}).get("email"),
                    encoded_payload, now, invoice_id,
                ),
            )
        else:
            connection.execute(
                """INSERT INTO receipt_deliveries
                   (invoice_id, invoice_number, customer_email, status, attempts,
                    payload_json, created_at, updated_at)
                   VALUES (?, ?, ?, 'PENDING', 1, ?, ?, ?)""",
                (
                    invoice_id, payload["invoice_number"],
                    payload.get("customer", {}).get("email"), encoded_payload, now, now,
                ),
            )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM receipt_deliveries WHERE invoice_id = ?", (invoice_id,)
        ).fetchone()
    return dict(row)


def update_delivery_status(
    invoice_id: str,
    status: str,
    error: str = "",
    execution_id: str = "",
) -> Optional[Dict[str, Any]]:
    if status not in {"PENDING", "SENT", "FAILED"}:
        raise ValueError("Unsupported receipt delivery status")
    now = datetime.now(timezone.utc).isoformat()
    with _connection() as connection:
        connection.execute(
            """UPDATE receipt_deliveries
               SET status = ?, last_error = ?, n8n_execution_id = ?, updated_at = ?
               WHERE invoice_id = ?""",
            (status, error[:1000], execution_id[:200], now, invoice_id),
        )
        connection.commit()
        row = connection.execute(
            "SELECT * FROM receipt_deliveries WHERE invoice_id = ?", (invoice_id,)
        ).fetchone()
    return dict(row) if row else None


def list_delivery_statuses() -> list[Dict[str, Any]]:
    with _connection() as connection:
        rows = connection.execute(
            "SELECT invoice_id, invoice_number, customer_email, status, attempts, last_error, updated_at "
            "FROM receipt_deliveries ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(row) for row in rows]
