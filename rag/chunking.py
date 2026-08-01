"""
GSA Phase 2 — text chunking examples.

Strategies:
  - fixed: sliding windows of max_chars with overlap
  - sections: split on markdown headings / blank lines, then pack

Not wired into the CLI until rag_phase >= 2 (see gsa.config.json / docs).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Literal, Optional


Strategy = Literal["fixed", "sections"]


@dataclass
class Chunk:
    text: str
    index: int
    start: int
    end: int
    strategy: Strategy
    meta: Optional[dict] = None


def chunk_fixed(
    text: str,
    max_chars: int = 1200,
    overlap: int = 150,
) -> List[Chunk]:
    """Fixed-size windows with character overlap."""
    if max_chars < 1:
        raise ValueError("max_chars must be >= 1")
    if overlap < 0 or overlap >= max_chars:
        raise ValueError("overlap must be >= 0 and < max_chars")

    text = text or ""
    if not text.strip():
        return []

    chunks: List[Chunk] = []
    i = 0
    n = len(text)
    idx = 0
    step = max_chars - overlap

    while i < n:
        end = min(i + max_chars, n)
        # prefer break on whitespace near the end
        if end < n:
            window = text[i:end]
            br = max(window.rfind("\n"), window.rfind(" "), window.rfind("\t"))
            if br > max_chars * 0.5:
                end = i + br + 1
        piece = text[i:end].strip()
        if piece:
            chunks.append(
                Chunk(text=piece, index=idx, start=i, end=end, strategy="fixed")
            )
            idx += 1
        if end >= n:
            break
        i = end - overlap if end - overlap > i else end

    return chunks


_HEADING = re.compile(r"(?m)^(#{1,6}\s+\S.*)$")


def chunk_sections(
    text: str,
    max_chars: int = 1600,
    overlap: int = 150,
) -> List[Chunk]:
    """
    Split on markdown headings / blank-line paragraphs, then pack into
    blocks <= max_chars (falling back to fixed windows for long sections).
    """
    text = text or ""
    if not text.strip():
        return []

    # Split keeping headings as section starts
    parts = _HEADING.split(text)
    sections: List[str] = []
    buf = ""
    for part in parts:
        if _HEADING.match(part or ""):
            if buf.strip():
                sections.append(buf.strip())
            buf = part
        else:
            buf = (buf + part) if buf else part
    if buf.strip():
        sections.append(buf.strip())

    if not sections:
        sections = [text]

    packed: List[str] = []
    current = ""
    for sec in sections:
        if len(sec) > max_chars:
            if current:
                packed.append(current)
                current = ""
            for sub in chunk_fixed(sec, max_chars=max_chars, overlap=overlap):
                packed.append(sub.text)
            continue
        candidate = f"{current}\n\n{sec}".strip() if current else sec
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                packed.append(current)
            current = sec
    if current:
        packed.append(current)

    out: List[Chunk] = []
    cursor = 0
    for idx, piece in enumerate(packed):
        start = text.find(piece[:80], cursor) if piece else cursor
        if start < 0:
            start = cursor
        end = start + len(piece)
        out.append(
            Chunk(
                text=piece,
                index=idx,
                start=start,
                end=end,
                strategy="sections",
                meta={"max_chars": max_chars, "overlap": overlap},
            )
        )
        cursor = end
    return out


def chunk_text(
    text: str,
    strategy: Strategy = "sections",
    max_chars: int = 1600,
    overlap: int = 150,
) -> List[Chunk]:
    if strategy == "fixed":
        return chunk_fixed(text, max_chars=min(max_chars, 1200), overlap=overlap)
    if strategy == "sections":
        return chunk_sections(text, max_chars=max_chars, overlap=overlap)
    raise ValueError(f"unknown strategy: {strategy}")


def chunks_to_rows(
    chunks: Iterable[Chunk],
    *,
    source: str = "memory",
    worker_id: Optional[str] = None,
) -> List[dict]:
    """Shape for insert into public.agent_chunks (without embeddings)."""
    rows = []
    for c in chunks:
        rows.append(
            {
                "source": source,
                "worker_id": worker_id,
                "content": c.text,
                "metadata": {
                    "chunk_index": c.index,
                    "start": c.start,
                    "end": c.end,
                    "strategy": c.strategy,
                    **(c.meta or {}),
                },
            }
        )
    return rows


# ── examples ───────────────────────────────────────────────────────────────

EXAMPLE_MEMORY = """# Project memory

## Product
GSA sells Precision Workers CLI at A$97 lifetime.

## Stack
Stripe Checkout → Supabase stripe-webhook → Notion + Resend license.

## RAG
Phase 1 injects project_memory.md into system prompt.
Phase 2 uses chunking + embeddings + match_agent_chunks.
"""


def _demo() -> None:
    fixed = chunk_fixed(EXAMPLE_MEMORY, max_chars=120, overlap=20)
    sections = chunk_sections(EXAMPLE_MEMORY, max_chars=200, overlap=20)
    print(f"fixed={len(fixed)} sections={len(sections)}")
    for c in sections:
        print(f"--- [{c.index}] {c.strategy} ({len(c.text)} chars) ---")
        print(c.text[:160].replace("\n", " ") + ("…" if len(c.text) > 160 else ""))


if __name__ == "__main__":
    _demo()
