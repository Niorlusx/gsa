"""
GSA Phase 2 — semantic cache (exact hash + cosine near-hit).

Use in front of expensive embed+retrieve or LLM calls.
In-memory only; swap store for Redis/KV in production.
"""

from __future__ import annotations

import hashlib
import math
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass
class CacheEntry:
    key_hash: str
    embedding: List[float]
    value: str
    created_at: float = field(default_factory=time.time)
    hits: int = 0


class SemanticCache:
    def __init__(
        self,
        *,
        cosine_threshold: float = 0.92,
        max_entries: int = 256,
        ttl_seconds: Optional[float] = 3600.0,
    ) -> None:
        self.cosine_threshold = cosine_threshold
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds
        self._by_hash: Dict[str, CacheEntry] = {}
        self._entries: List[CacheEntry] = []

    def _expired(self, e: CacheEntry) -> bool:
        if self.ttl_seconds is None:
            return False
        return (time.time() - e.created_at) > self.ttl_seconds

    def get_exact(self, text: str) -> Optional[str]:
        h = text_hash(text)
        e = self._by_hash.get(h)
        if not e or self._expired(e):
            return None
        e.hits += 1
        return e.value

    def get_near(
        self, embedding: Sequence[float]
    ) -> Optional[Tuple[str, float]]:
        best: Optional[CacheEntry] = None
        best_sim = -1.0
        for e in self._entries:
            if self._expired(e):
                continue
            sim = _cosine(embedding, e.embedding)
            if sim > best_sim:
                best_sim = sim
                best = e
        if best and best_sim >= self.cosine_threshold:
            best.hits += 1
            return best.value, best_sim
        return None

    def put(
        self,
        text: str,
        embedding: Sequence[float],
        value: str,
    ) -> None:
        h = text_hash(text)
        entry = CacheEntry(
            key_hash=h, embedding=list(embedding), value=value
        )
        self._by_hash[h] = entry
        self._entries.append(entry)
        while len(self._entries) > self.max_entries:
            old = self._entries.pop(0)
            if self._by_hash.get(old.key_hash) is old:
                del self._by_hash[old.key_hash]


# Example
if __name__ == "__main__":
    cache = SemanticCache(cosine_threshold=0.92)
    emb = [0.1] * 384
    cache.put("what is gsa?", emb, "GSA is Precision Workers CLI")
    assert cache.get_exact("what is gsa?")
    hit = cache.get_near(emb)
    print("near", hit[1] if hit else None)
