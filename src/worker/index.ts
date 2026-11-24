import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import type { AppEnv, Env } from "./env";
import { auth, requireUser } from "./auth";
import { accounts } from "./accounts";
import { mcpHandler } from "./mcp";
import { authorizePage, clients, oauth } from "./oauth";

const ORIGIN = "https://mailmcp.fldr.zip";

const api = new Hono<AppEnv>()
  .use(csrf())
  .route("/auth", auth)
  .get("/me", requireUser, async (c) => {
    const user = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(c.get("userId")).first<{ email: string }>();
    return c.json(user);
  })
  .route("/accounts", accounts)
  .route("/oauth", oauth)
  .route("/clients", clients);

const app = new Hono<AppEnv>().route("/api", api).get("/authorize", authorizePage);

const provider = new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: mcpHandler,
  defaultHandler: { fetch: app.fetch },
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["mail.read", "mail.write", "mail.send", "offline_access"],
  resourceMetadata: { resource: `${ORIGIN}/mcp`, authorization_servers: [ORIGIN], resource_name: "mail-mcp" },
  clientIdMetadataDocumentEnabled: true,
});

export default {
  fetch: (request, env, ctx) => provider.fetch(request, env, ctx),
  async scheduled(_event, env) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(now),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
      env.DB.prepare("DELETE FROM connect_failures WHERE window_start < ?").bind(now - 60 * 60 * 1000),
    ]);
    await provider.purgeExpiredData(env);
  },
} satisfies ExportedHandler<Env>;
