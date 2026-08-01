# Cloudflare Sandbox base — linux/amd64
# Requires Docker Desktop for local `wrangler dev`
FROM docker.io/cloudflare/sandbox:0.8.9

# Optional: common tools for agent / CI workloads
RUN pip3 install --no-cache-dir requests && \
    npm install -g typescript 2>/dev/null || true

# Ports for local wrangler port exposure / preview URLs
EXPOSE 8080 3000
