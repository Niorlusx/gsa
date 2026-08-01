"""
GSA Phase 2 — pgvector retrieval (reference, not wired into CLI).

Flow:
  query text → embed (384-d) → match_agent_chunks RPC → top-k snippets

Env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_SECRET_KEY if your stack maps it)
  Optional: IVFFLAT_PROBES, EMBEDDING_URL (OpenAI-compatible embeddings)

Embedding dims MUST match column: vector(384).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, List, Optional, Sequence


@dataclass
class RetrievedChunk:
    id: str
    source: str
    worker_id: Optional[str]
    content: str
    similarity: float
    metadata: dict


def _env(*names: str, default: str = "") -> str:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v
    return default


def embed_texts(
    texts: Sequence[str],
    *,
    model: str = "text-embedding-3-small",
    dimensions: int = 384,
) -> List[List[float]]:
    """
    Call an OpenAI-compatible embeddings API.
    For true MiniLM-384 local models, swap this function — dims must stay 384.
    """
    api_key = _env("OPENAI_API_KEY", "GROK_API_KEY", "XAI_API_KEY")
    base = _env(
        "EMBEDDING_API_BASE",
        "OPENAI_API_BASE",
        default="https://api.openai.com/v1",
    ).rstrip("/")
    if not api_key:
        raise RuntimeError("Set OPENAI_API_KEY (or compatible) for embeddings")

    body = json.dumps(
        {"model": model, "input": list(texts), "dimensions": dimensions}
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base}/embeddings",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    data = sorted(payload["data"], key=lambda x: x["index"])
    return [row["embedding"] for row in data]


def match_agent_chunks(
    query_embedding: Sequence[float],
    *,
    match_count: int = 6,
    filter_source: Optional[str] = None,
    filter_worker_id: Optional[str] = None,
) -> List[RetrievedChunk]:
    url = _env("SUPABASE_URL").rstrip("/")
    key = _env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")

    # Optional IVFFlat probes (session GUC via PostgREST not always available)
    body: dict[str, Any] = {
        "query_embedding": list(query_embedding),
        "match_count": match_count,
        "filter_source": filter_source,
        "filter_worker_id": filter_worker_id,
    }
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/match_agent_chunks",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"match_agent_chunks HTTP {e.code}: {detail}") from e

    out: List[RetrievedChunk] = []
    for r in rows or []:
        out.append(
            RetrievedChunk(
                id=str(r.get("id")),
                source=r.get("source") or "",
                worker_id=r.get("worker_id"),
                content=r.get("content") or "",
                similarity=float(r.get("similarity") or 0.0),
                metadata=r.get("metadata") or {},
            )
        )
    return out


def retrieve_for_prompt(
    query: str,
    *,
    top_k: int = 6,
    max_context_chars: int = 3000,
    filter_source: Optional[str] = None,
) -> str:
    """Embed query, fetch top-k, pack into a context block for system prompt."""
    emb = embed_texts([query])[0]
    if len(emb) != 384:
        raise RuntimeError(f"expected 384-d embedding, got {len(emb)}")
    hits = match_agent_chunks(
        emb, match_count=top_k, filter_source=filter_source
    )
    parts: List[str] = []
    used = 0
    for h in hits:
        block = f"[{h.source} sim={h.similarity:.3f}]\n{h.content.strip()}\n"
        if used + len(block) > max_context_chars:
            break
        parts.append(block)
        used += len(block)
    return "\n".join(parts).strip()


def insert_chunk_with_embedding(
    content: str,
    embedding: Sequence[float],
    *,
    source: str = "memory",
    worker_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> dict:
    url = _env("SUPABASE_URL").rstrip("/")
    key = _env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")
    row = {
        "source": source,
        "worker_id": worker_id,
        "content": content,
        "embedding": list(embedding),
        "metadata": metadata or {},
    }
    req = urllib.request.Request(
        f"{url}/rest/v1/agent_chunks",
        data=json.dumps(row).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data[0] if isinstance(data, list) and data else data


if __name__ == "__main__":
    print("pgvector_retrieve.py — import retrieve_for_prompt / match_agent_chunks")
    print("Requires SUPABASE_* env and embeddings API for live calls.")
