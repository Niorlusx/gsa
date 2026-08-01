# GSA Cloudflare Sandbox

Secure isolated code execution via [Cloudflare Sandbox SDK](https://developers.cloudflare.com/sandbox/).

> **Not** Stripe test mode. Stripe sandbox = payment test keys.  
> **This** sandbox = Durable Object + container for untrusted code.

## Prerequisites

| Requirement | Why |
|-------------|-----|
| Docker Desktop | Local `wrangler dev` builds/runs containers |
| Cloudflare account with Containers | Deploy |
| Node 20+ | Tooling |

## Setup

```bash
cd cloudflare/sandbox
npm.cmd install
# Docker must be running:
npx.cmd wrangler dev
```

## API

### Health
```bash
curl http://localhost:8787/health
```

### Exec shell command
```bash
curl -X POST http://localhost:8787/exec ^
  -H "Content-Type: application/json" ^
  -d "{\"id\":\"user-1\",\"command\":\"python3 -c \\\"print(2+2)\\\"\"}"
```

### Run code (interpreter)
```bash
curl -X POST http://localhost:8787/run-code ^
  -H "Content-Type: application/json" ^
  -d "{\"language\":\"python\",\"code\":\"print(sum([1,2,3]))\"}"
```

### Destroy sandbox
```bash
curl -X POST http://localhost:8787/destroy ^
  -H "Content-Type: application/json" ^
  -d "{\"id\":\"user-1\"}"
```

## Deploy

```bash
npx.cmd wrangler deploy
```

Preview URLs for exposed ports need a custom domain with `*.yourdomain.com` DNS — `.workers.dev` does not support sandbox preview subdomains.

## Architecture

- Same `sandboxId` → same container (stateful)
- Sleep after ~10m idle (configurable)
- Call `destroy` to free resources immediately
