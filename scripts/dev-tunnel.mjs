#!/usr/bin/env node
/**
 * `pnpm dev:tunnel` — start the Vite dev server AND a Cloudflare *quick* tunnel
 * pointed at it, then print a public https://<random>.trycloudflare.com URL so
 * the running app can be opened from any device, anywhere.
 *
 * Notes:
 * - Quick tunnel: no Cloudflare account or login. The URL is ephemeral and
 *   changes every run. The local dev server is publicly reachable for as long
 *   as this command runs — stop it (Ctrl+C) when you're done.
 * - The `cloudflared` binary is downloaded automatically on first run (the
 *   package's pnpm postinstall is intentionally not allowlisted in
 *   `onlyBuiltDependencies`). Subsequent runs reuse the cached binary.
 * - `server.allowedHosts` is injected HERE, not in `vite.config.ts`, so normal
 *   `pnpm dev` keeps Vite's default DNS-rebinding host protection. Vite still
 *   loads `vite.config.ts` (plugins, etc.) and merges this in.
 *
 * Run via `pnpm dev:tunnel` (preferred) or directly: `node scripts/dev-tunnel.mjs`.
 */

import { Tunnel, bin, install } from "cloudflared";
import { existsSync } from "node:fs";
import { createServer } from "vite";

// Leading dot => matches any *.trycloudflare.com subdomain (random each run).
const TUNNEL_ALLOWED_HOST = ".trycloudflare.com";

async function main() {
  // 1. Ensure the cloudflared binary exists (first run downloads it).
  if (!existsSync(bin)) {
    console.log("Downloading cloudflared (first run only)...");
    await install(bin);
  }

  // 2. Start Vite programmatically so we know the resolved port and can allow
  //    the tunnel host. Omitting `configFile` lets Vite load vite.config.ts.
  const server = await createServer({
    server: { allowedHosts: [TUNNEL_ALLOWED_HOST] },
  });
  await server.listen();
  server.printUrls();

  const address = server.httpServer?.address();
  const port = address && typeof address === "object" ? address.port : server.config.server.port;
  const localUrl = `http://localhost:${port}`;

  // 3. Open the quick tunnel at the resolved port.
  const tunnel = Tunnel.quick(localUrl);

  let shuttingDown = false;
  const shutdown = async (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      tunnel.stop();
    } catch (err) {
      console.error("[dev:tunnel] error stopping tunnel:", err);
    }
    try {
      await server.close();
    } catch (err) {
      console.error("[dev:tunnel] error closing Vite server:", err);
    }
    process.exit(code);
  };

  tunnel.on("error", (err) => console.error("[dev:tunnel] cloudflared error:", err));
  tunnel.on("exit", (code) => {
    if (code) console.error(`[dev:tunnel] cloudflared exited with code ${code}`);
  });

  tunnel.once("url", (publicUrl) => {
    const rule = "=".repeat(64);
    console.log(`\n${rule}`);
    console.log("  Cloudflare quick tunnel is live");
    console.log(`  Public URL:  ${publicUrl}`);
    console.log(`  Local:       ${localUrl}`);
    console.log("  Ephemeral - the URL changes every run. Ctrl+C to stop.");
    console.log(`${rule}\n`);
  });

  tunnel.once("connected", (conn) => {
    if (conn && conn.location) console.log(`[dev:tunnel] edge connected: ${conn.location}`);
  });

  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });
}

main().catch((err) => {
  console.error("[dev:tunnel] failed to start:", err);
  process.exit(1);
});
