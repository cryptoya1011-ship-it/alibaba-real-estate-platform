"""Portable column types: BIGINT on PostgreSQL, INTEGER on SQLite (autoincrement)."""
from __future__ import annotations

from sqlalchemy import BigInteger, Integer

BigInt = BigInteger().with_variant(Integer, "sqlite")
