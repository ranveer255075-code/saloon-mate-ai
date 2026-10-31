"""Local persistence for requests created by the SalonMate AI agent."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


DATABASE_PATH = Path(__file__).resolve().parents[1] / "salonmate_ai.db"


def _connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """CREATE TABLE IF NOT EXISTS booking_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            service TEXT NOT NULL,
            preferred_date TEXT NOT NULL,
            preferred_time TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Pending review',
            source TEXT NOT NULL DEFAULT 'SalonMate AI',
            created_at TEXT NOT NULL
        )"""
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(booking_requests)").fetchall()}
    if "customer_id" not in columns:
        connection.execute("ALTER TABLE booking_requests ADD COLUMN customer_id INTEGER")
    if "customer_email" not in columns:
        connection.execute("ALTER TABLE booking_requests ADD COLUMN customer_email TEXT")
    connection.commit()
    return connection


def create_booking_request(details: Dict[str, str], customer: Dict[str, str] = None) -> Dict[str, str]:
    with _connection() as connection:
        cursor = connection.execute(
            """INSERT INTO booking_requests
            (customer_name, phone, service, preferred_date, preferred_time, customer_id, customer_email, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                details["name"], details["phone"], details["service"],
                details["date"], details["time"], customer.get("id") if customer else None,
                customer.get("email") if customer else None, datetime.now(timezone.utc).isoformat(),
            ),
        )
        request_id = cursor.lastrowid
    return {"id": request_id, **details, "status": "Pending review"}


def list_booking_requests() -> List[Dict[str, str]]:
    with _connection() as connection:
        rows = connection.execute("SELECT * FROM booking_requests ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]


def get_booking_request(request_id: int) -> Dict[str, str]:
    with _connection() as connection:
        row = connection.execute(
            "SELECT * FROM booking_requests WHERE id = ?", (request_id,)
        ).fetchone()
    return dict(row) if row else None


def list_customer_booking_requests(customer_id: int) -> List[Dict[str, str]]:
    with _connection() as connection:
        rows = connection.execute(
            "SELECT * FROM booking_requests WHERE customer_id = ? ORDER BY id DESC", (customer_id,)
        ).fetchall()
    return [dict(row) for row in rows]


def update_booking_status(request_id: int, status: str) -> bool:
    with _connection() as connection:
        cursor = connection.execute("UPDATE booking_requests SET status = ? WHERE id = ?", (status, request_id))
    return cursor.rowcount > 0
