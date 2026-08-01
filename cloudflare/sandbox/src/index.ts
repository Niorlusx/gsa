/**
 * GSA Cloudflare Sandbox Worker
 *
 * Isolated containers for safe code execution (AI agents, scripts, CI snippets).
 * Not related to Stripe test mode — this is the Cloudflare Sandbox SDK.
 *
 * Requirements:
 *   - Docker Desktop running for `wrangler dev`
 *   - Account with Containers / Sandbox access for deploy
 *
 * API:
 *   GET  /health              → service status
 *   POST /exec                → { "id"?: string, "command": "python3 -c 'print(1)'" }
 *   POST /run-code            → { "id"?: string, "language": "python"|"javascript"|"typescript", "code": "..." }
 *   POST /destroy             → { "id": string }
 */
import { getSandbox, proxyToSandbox, type Sandbox } from "@cloudflare/sandbox";

// Required re-export so Wrangler can bind the DO + container class
export { Sandbox } from "@cloudflare/sandbox";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Preview URLs for exposed ports — must run first
    const proxied = await proxyToSandbox(request, env);
    if (proxied) return proxied;

    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return Response.json({
        ok: true,
        service: "gsa-sandbox",
        note: "POST /exec or /run-code — Docker required for local dev",
      });
    }

    try {
      if (request.method === "POST" && url.pathname === "/exec") {
        return await handleExec(request, env);
      }
      if (request.method === "POST" && url.pathname === "/run-code") {
        return await handleRunCode(request, env);
      }
      if (request.method === "POST" && url.pathname === "/destroy") {
        return await handleDestroy(request, env);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ level: "error", msg: "sandbox_error", message }));
      // Container cold-start race
      if (message.includes("CONTAINER_NOT_READY") || message.includes("not ready")) {
        return Response.json(
          { error: "Container not ready — retry in a few seconds", message },
          { status: 503 },
        );
      }
      return Response.json({ error: message }, { status: 500 });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

type ExecBody = {
  id?: string;
  command: string;
  timeout?: number;
};

type RunCodeBody = {
  id?: string;
  language?: "python" | "javascript" | "typescript";
  code: string;
  timeout?: number;
};

type DestroyBody = {
  id: string;
};

function sandboxIdFrom(body: { id?: string }, request: Request): string {
  if (body.id && body.id.trim()) return body.id.trim();
  const header = request.headers.get("x-sandbox-id");
  if (header?.trim()) return header.trim();
  return "gsa-default";
}

async function handleExec(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as ExecBody;
  if (!body.command?.trim()) {
    return Response.json({ error: "command is required" }, { status: 400 });
  }

  const id = sandboxIdFrom(body, request);
  const sandbox = getSandbox(env.Sandbox, id, { normalizeId: true });
  const result = await sandbox.exec(body.command, {
    timeout: body.timeout ?? 30_000,
  });

  return Response.json({
    sandboxId: id,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    success: result.success,
  });
}

async function handleRunCode(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as RunCodeBody;
  if (!body.code?.trim()) {
    return Response.json({ error: "code is required" }, { status: 400 });
  }

  const id = sandboxIdFrom(body, request);
  const language = body.language ?? "python";
  const sandbox = getSandbox(env.Sandbox, id, { normalizeId: true });
  const result = await sandbox.runCode(body.code, {
    language,
    timeout: body.timeout ?? 60_000,
  });

  return Response.json({
    sandboxId: id,
    language,
    logs: result.logs,
    results: result.results,
    error: result.error ?? null,
    executionCount: result.executionCount,
  });
}

async function handleDestroy(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as DestroyBody;
  if (!body.id?.trim()) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const sandbox = getSandbox(env.Sandbox, body.id.trim(), { normalizeId: true });
  await sandbox.destroy();
  return Response.json({ ok: true, destroyed: body.id.trim() });
}
