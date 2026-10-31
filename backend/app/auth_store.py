"""Minimal local customer authentication for the SalonMate customer portal."""
import hashlib
import hmac
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Dict, Optional

from .booking_store import DATABASE_PATH


def _connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """CREATE TABLE IF NOT EXISTS customers_ai (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )"""
    )
    connection.execute(
        """CREATE TABLE IF NOT EXISTS customer_sessions (
            token TEXT PRIMARY KEY,
            customer_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers_ai(id)
        )"""
    )
    connection.commit()
    return connection


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 210_000)
    return f"{salt.hex()}:{digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split(":", 1)
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 210_000)
    return hmac.compare_digest(candidate.hex(), digest_hex)


def _public_customer(row: sqlite3.Row) -> Dict[str, str]:
    return {"id": row["id"], "name": row["name"], "phone": row["phone"], "email": row["email"]}


def _create_session(connection: sqlite3.Connection, customer_id: int) -> str:
    token = secrets.token_urlsafe(32)
    connection.execute(
        "INSERT INTO customer_sessions (token, customer_id, created_at) VALUES (?, ?, ?)",
        (token, customer_id, datetime.now(timezone.utc).isoformat()),
    )
    connection.commit()
    return token


def register_customer(name: str, phone: str, email: str, password: str) -> Dict[str, object]:
    with _connection() as connection:
        cursor = connection.execute(
            "INSERT INTO customers_ai (name, phone, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (name, phone, email.lower(), _hash_password(password), datetime.now(timezone.utc).isoformat()),
        )
        customer = connection.execute("SELECT * FROM customers_ai WHERE id = ?", (cursor.lastrowid,)).fetchone()
        token = _create_session(connection, cursor.lastrowid)
    return {"customer": _public_customer(customer), "token": token}


def login_customer(email: str, password: str) -> Optional[Dict[str, object]]:
    with _connection() as connection:
        customer = connection.execute("SELECT * FROM customers_ai WHERE email = ?", (email.lower(),)).fetchone()
        if not customer or not _verify_password(password, customer["password_hash"]):
            return None
        token = _create_session(connection, customer["id"])
    return {"customer": _public_customer(customer), "token": token}


def customer_from_token(token: str) -> Optional[Dict[str, str]]:
    with _connection() as connection:
        row = connection.execute(
            """SELECT c.* FROM customer_sessions s
               JOIN customers_ai c ON c.id = s.customer_id WHERE s.token = ?""", (token,)
        ).fetchone()
    return _public_customer(row) if row else None
