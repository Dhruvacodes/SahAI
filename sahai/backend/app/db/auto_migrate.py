"""Tiny idempotent column-addition helpers for dev environments.

`Base.metadata.create_all()` creates *missing tables* but never alters existing
tables. When a new column is added to an ORM model in a long-running dev
database (SQLite or Postgres), the table goes out of sync and queries that
reference the new column blow up with `OperationalError: no such column`.

Production should use Alembic. This module is a small safety net for dev: at
startup we inspect each tracked model and ALTER TABLE ADD COLUMN where a
column is declared on the ORM but missing from the database. It's idempotent
and silent on already-applied changes.
"""

from __future__ import annotations

import logging
from typing import Iterable

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

log = logging.getLogger(__name__)


def _column_sql_type(engine: Engine, column) -> str:
    """Render a SQL type string suitable for a CREATE-style ALTER on `engine`."""
    # SQLAlchemy types know how to render themselves per dialect.
    return column.type.compile(engine.dialect)


def ensure_columns(engine: Engine, table_name: str, columns: Iterable) -> None:
    """ALTER TABLE ADD COLUMN for each declared column missing from `table_name`.

    Skips silently if the table itself doesn't exist (it'll be created by
    `Base.metadata.create_all`).
    """
    inspector = inspect(engine)
    if not inspector.has_table(table_name):
        return

    # Postgres folds unquoted identifiers to lower case, so a column declared
    # as ``nameLatin`` in the ORM ends up stored as ``namelatin``. Compare
    # case-insensitively to avoid trying to ADD COLUMN on an existing column.
    existing_raw = [col["name"] for col in inspector.get_columns(table_name)]
    existing = {name.lower() for name in existing_raw}
    for column in columns:
        if column.name.lower() in existing:
            continue
        col_type = _column_sql_type(engine, column)
        nullable = "" if column.nullable else " NOT NULL"
        # Plain ADD COLUMN works on both SQLite and Postgres for nullable cols.
        # We never auto-add NOT NULL columns (we'd need a default and a
        # backfill), so model authors must keep new columns nullable.
        if not column.nullable:
            log.warning(
                "auto_migrate: refusing to add NOT NULL column %s.%s; mark it nullable for dev or write an Alembic migration",
                table_name,
                column.name,
            )
            continue
        # Quote both identifiers so Postgres preserves the camelCase casing
        # used by the ORM (otherwise it lowercases unquoted identifiers and
        # subsequent SELECTs that use the quoted form blow up with
        # `column "firedRules" does not exist`).
        quoted_table = engine.dialect.identifier_preparer.quote(table_name)
        quoted_col = engine.dialect.identifier_preparer.quote(column.name)
        stmt = text(f"ALTER TABLE {quoted_table} ADD COLUMN {quoted_col} {col_type}{nullable}")
        with engine.begin() as conn:
            conn.execute(stmt)
        log.info("auto_migrate: added %s.%s (%s)", table_name, column.name, col_type)


def run_auto_migrations(engine: Engine, base) -> None:
    """Apply ensure_columns to every mapped table in `base`.

    Call this *after* `base.metadata.create_all(...)` at app startup.
    """
    for table in base.metadata.sorted_tables:
        ensure_columns(engine, table.name, list(table.columns))
