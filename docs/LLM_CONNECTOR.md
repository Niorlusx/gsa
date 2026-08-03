# LLM Connector

OpenAI-compatible `POST {api_base}/chat/completions` via **stdlib only** (no `openai` package).

## Config

```json
"connectors": {
  "llm": {
    "provider": "xai",
    "api_base": "https://api.x.ai/v1",
    "model": "grok-4.5",
    "temperature": 0.4,
    "api_key_env": ["GROK_API_KEY", "XAI_API_KEY"]
  }
}
```

## Providers

| provider | api_base | default model | key env |
|----------|----------|---------------|---------|
| **xai** | https://api.x.ai/v1 | grok-4.5 | GROK_API_KEY |
| **deepseek** | https://api.deepseek.com | deepseek-chat | DEEPSEEK_API_KEY |
| **mistral** | https://api.mistral.ai/v1 | mistral-small-latest | MISTRAL_API_KEY |
| **gemini** | https://generativelanguage.googleapis.com/v1beta/openai | gemini-2.5-flash | GEMINI_API_KEY |
| openrouter | https://openrouter.ai/api/v1 | x-ai/grok-4.5 | OPENROUTER_API_KEY |
| groq | https://api.groq.com/openai/v1 | llama-3.3-70b-versatile | GROQ_API_KEY |
| together | https://api.together.xyz/v1 | Meta-Llama-3.1-70B… | TOGETHER_API_KEY |

## Env overrides

```bash
export GSA_PROVIDER=deepseek|mistral|xai|gemini
export GSA_MODEL=gemini-2.5-flash
export GSA_SMALL_MODEL=mistral-small-latest
```

See **[GOOGLE_WORKSPACE_GEMINI.md](GOOGLE_WORKSPACE_GEMINI.md)** for Spark / Workspace add-ons collaboration.
