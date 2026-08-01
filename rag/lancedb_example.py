"""
GSA Phase 2 — local LanceDB sketch (laptop / low volume).

Install (optional): pip install lancedb pyarrow numpy
Not a dependency of the GSA CLI by default.
"""

from __future__ import annotations

from typing import List, Optional, Sequence


def open_table(path: str = "./.grok/lancedb", table: str = "agent_chunks"):
    """Open or create a local LanceDB table with 384-d vectors."""
    import lancedb  # type: ignore
    import pyarrow as pa  # type: ignore

    db = lancedb.connect(path)
    schema = pa.schema(
        [
            pa.field("id", pa.string()),
            pa.field("source", pa.string()),
            pa.field("worker_id", pa.string()),
            pa.field("content", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), 384)),
        ]
    )
    try:
        return db.open_table(table)
    except Exception:
        return db.create_table(table, schema=schema)


def upsert_chunks(
    rows: List[dict],
    path: str = "./.grok/lancedb",
) -> int:
    """
    rows: {id, source, worker_id, content, vector: list[float] len 384}
    """
    tbl = open_table(path)
    tbl.add(rows)
    return len(rows)


def search(
    query_vector: Sequence[float],
    *,
    top_k: int = 6,
    path: str = "./.grok/lancedb",
    source: Optional[str] = None,
) -> list:
    tbl = open_table(path)
    q = tbl.search(list(query_vector)).limit(top_k)
    if source:
        q = q.where(f"source = '{source}'")
    return q.to_list()


if __name__ == "__main__":
    print("lancedb_example.py — local vector store sketch")
    print("pip install lancedb pyarrow  # optional")
