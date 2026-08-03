# Google Workspace · Gemini · Spark collaboration

GSA multi-model path for **Google Gemini** (API builds) and how it sits next to **Gemini Spark** / Workspace add-ons.

## 1. GSA CLI — Gemini provider (API calls)

OpenAI-compatible endpoint (stdlib HTTP, same as other providers):

| Item | Value |
|------|--------|
| Provider | `gemini` |
| API base | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Key | `GEMINI_API_KEY` or `GOOGLE_API_KEY` (Google AI Studio) |
| Default model | `gemini-2.5-flash` |
| Override | `GSA_MODEL=gemini-2.5-pro` (or current Studio model id) |

```bash
export GSA_PROVIDER=gemini
export GEMINI_API_KEY=...          # from https://aistudio.google.com
export GSA_MODEL=gemini-2.5-flash  # or pro / preview ids your project allows
export GROK_LICENSE=GSA-DEMO-2026-LIVE

bash scripts/gsa-full.sh ab-d
python3 gsa worker 8 "Draft a Workspace rollout plan for GSA agents"
```

A/B track **D** = Gemini (see `gsa.system.json` → `llmsMachineLearning.abTesting.versionD`).

### Build / API assist pattern

Same chat/completions shape as xAI:

```http
POST {api_base}/chat/completions
Authorization: Bearer $GEMINI_API_KEY
Content-Type: application/json

{
  "model": "gemini-2.5-flash",
  "messages": [
    {"role": "system", "content": "...worker skill..."},
    {"role": "user", "content": "...brief..."}
  ],
  "temperature": 0.4
}
```

Use for: code review notes, Apps Script stubs, add-on manifest drafts, CI copy — **not** as a substitute for published Workspace OAuth scopes.

## 2. Gemini Spark (product agent)

Gemini Spark is Google’s **personal agent** inside Workspace (Gmail, Calendar, Drive, Docs, Sheets, Slides, …).

Capabilities relevant to GSA operators (as of 2026 Workspace upgrades):

- Edit private / shared Docs, Sheets, Slides  
- Read comments on spreadsheets and presentations  
- Add images to documents and presentations  
- Tasks, Skills, Schedules against connected Google apps  

**Collaboration model with GSA:**

| Layer | Tool | Role |
|-------|------|------|
| Precision Workers | GSA CLI / Hub | Locked single-job PoW (research, offers, SOPs, strategy) |
| Workspace surface | Gemini Spark | Act inside Docs/Sheets/Gmail on the operator’s account |
| Custom UI | Workspace **Add-ons** | Cards / sidebars calling your backend (or GSA hub API) |

Spark does **not** replace GSA role locks; use Spark to place GSA outputs into Workspace files.

## 3. Google Workspace Add-ons (builds)

Official path: Workspace Add-ons (Apps Script or HTTP backend).

Suggested GSA-oriented add-on flows:

1. **Side panel** — pick worker 1–8, paste brief, call `POST /api/run` on your hosted GSA hub  
2. **Docs** — insert proof-of-work markdown from last run  
3. **Sheets** — write Lead Researcher rows into a leads sheet  

Auth:

- Add-on OAuth for Workspace user  
- Server holds `GEMINI_API_KEY` / `GROK_API_KEY` in secret manager — never in client JS  

Example Apps Script call skeleton (host must implement CORS + license check):

```javascript
function runGsaWorker(workerId, brief) {
  const url = PropertiesService.getScriptProperties().getProperty('GSA_HUB_URL');
  const res = UrlFetchApp.fetch(url + '/api/run', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ worker: workerId, brief: brief, save: true }),
    headers: { 'X-GSA-Token': PropertiesService.getScriptProperties().getProperty('GSA_TOKEN') }
  });
  return JSON.parse(res.getContentText());
}
```

## 4. Security

- Env-only keys (`GEMINI_API_KEY`, never committed)  
- Workspace add-ons: least-privilege OAuth scopes  
- Spark connections: user-toggled per app  
- GSA content policy still applies (`CONTENT_POLICY.md`)

## 5. Repo links

- GSA: https://github.com/Niorlusx/gsa  
- Hub: https://github.com/Niorlusx/agent-swarm-hub  
