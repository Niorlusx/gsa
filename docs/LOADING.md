# CLI loading logic

Controls how project context is injected into workers.

## Config (`gsa.config.json`)

```json
"loading": {
  "mode": "system",
  "memory": true,
  "agents_md": true,
  "max_memory_chars": 2000,
  "max_agents_chars": 2000,
  "rag_phase": 1
}
```

| Field | Values | Meaning |
|-------|--------|---------|
| `mode` | `system` | Append context to **system** prompt (default) |
| | `prepend_user` | Put context at the start of the **user** message |
| | `off` | No file context |
| `memory` | bool | Load `.grok/project_memory.md` |
| `agents_md` | bool | Load `AGENTS.md` |
| `max_*_chars` | int | Truncation caps (Phase 1 style) |
| `rag_phase` | `1` \| `2` | `2` reserves hook for `rag/` (not fully wired) |

## CLI flags

Works with `worker`, `run`, `supervisor`, `keywords --llm`:

```bash
gsa worker 8 "strategy" --loading off
gsa worker 4 "competitors" --no-memory
gsa worker 1 "leads" --loading prepend_user --max-memory 1500
gsa loading                          # show resolved config + preview
gsa loading --no-agents --loading system
```

| Flag | Effect |
|------|--------|
| `--loading system\|prepend_user\|off` | Injection mode |
| `--no-memory` / `--memory` | Toggle project memory |
| `--no-agents` / `--agents` | Toggle AGENTS.md |
| `--max-memory N` | Cap memory chars |
| `--rag-phase 1\|2` | Phase marker |

## Resolution order

1. `DEFAULT_LOADING` in CLI  
2. `gsa.config.json` → `loading`  
3. CLI flags (win)

## Defaults (v1.5.1)

Matches prior behavior: memory + agents_md into **system** prompt, ~2k chars each.
