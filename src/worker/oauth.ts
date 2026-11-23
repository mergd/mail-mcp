import { AuthorizationError, CimdFetchError } from "@cloudflare/workers-oauth-provider";
import { Hono, type Context } from "hono";
import { levelScopes, type AccessLevel, type GrantProps } from "../shared/access";
import type { AppEnv } from "./env";
import { requireUser, sessionUser } from "./auth";

const FRAME_HEADERS = { "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'" };

// GET /authorize: the consent page is the SPA; sign in first if needed.
export async function authorizePage(c: Context<AppEnv>) {
  const url = new URL(c.req.url);
  if (!(await sessionUser(c))) return c.redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  const page = await c.env.ASSETS.fetch(new URL("/", url));
  return new Response(page.body, { headers: { "Content-Type": "text/html; charset=utf-8", ...FRAME_HEADERS } });
}

const withHeaders = (res: Response, headers: Headers) => {
  headers.forEach((v, k) => k.toLowerCase() !== "location" && res.headers.append(k, v));
  return res;
};

function oauthError(c: Context<AppEnv>, e: unknown) {
  if (e instanceof AuthorizationError && e.redirectTo) return c.json({ redirectTo: e.redirectTo });
  if (e instanceof AuthorizationError) return c.json({ error: e.description ?? "This authorization request is invalid." }, 400);
  if (e instanceof CimdFetchError) return c.json({ error: "This app could not be verified." }, 400);
  throw e;
}

export const oauth = new Hono<AppEnv>().use(requireUser);

oauth.get("/consent", async (c) => {
  const oauthApi = c.env.OAUTH_PROVIDER;
  try {
    const authRequest = await oauthApi.parseAuthRequest(new Request(new URL(`/authorize${new URL(c.req.url).search}`, c.req.url)));
    const details = await oauthApi.describeConsent(authRequest);
    const consent = await oauthApi.beginConsent(authRequest);
    const { results: accounts } = await c.env.DB.prepare("SELECT id, email, provider FROM mail_accounts WHERE user_id = ? ORDER BY created_at")
      .bind(c.get("userId"))
      .all();
    return withHeaders(
      c.json({
        handle: consent.handle,
        clientName: details.clientName,
        clientDomain: details.clientDomain,
        redirectHost: details.redirectHost,
        redirectIsLoopback: details.redirectIsLoopback,
        accounts,
      }),
      consent.headers,
    );
  } catch (e) {
    return oauthError(c, e);
  }
});

interface Decision {
  handle: string;
  approve: boolean;
  level?: AccessLevel;
  accountIds?: string[];
}

oauth.post("/decision", async (c) => {
  const oauthApi = c.env.OAUTH_PROVIDER;
  const body = await c.req.json<Decision>();
  const userId = c.get("userId");
  try {
    if (!body.approve) {
      const denied = await oauthApi.denyConsent(c.req.raw, body.handle);
      return withHeaders(c.json({ redirectTo: denied.redirectTo }), denied.headers);
    }

    const level = body.level && body.level in levelScopes ? body.level : null;
    const requested = [...new Set(body.accountIds ?? [])];
    const owned = requested.length
      ? (
          await c.env.DB.prepare(`SELECT id FROM mail_accounts WHERE user_id = ? AND id IN (${requested.map(() => "?").join(",")})`)
            .bind(userId, ...requested)
            .all<{ id: string }>()
        ).results.map((r) => r.id)
      : [];
    if (!level || !owned.length) return c.json({ error: "Choose an access level and at least one mailbox." }, 400);

    const scope = levelScopes[level];
    const approved = await oauthApi.approveConsent(c.req.raw, body.handle, { scope });
    const details = await oauthApi.describeConsent(approved.request);
    const props: GrantProps = { userId, accountIds: owned, level };
    const { redirectTo } = await oauthApi.completeAuthorization({ request: approved.request, userId, scope, props, metadata: {} });

    // Codes and tokens are "<userId>:<grantId>:<secret>".
    const grantId = new URL(redirectTo).searchParams.get("code")?.split(":")[1];
    if (!grantId) throw new Error("Couldn't read grant id from authorization code");
    // completeAuthorization revokes this user's earlier grants for the client; mirror that.
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM grants WHERE user_id = ? AND client_id = ?").bind(userId, approved.request.clientId),
      c.env.DB.prepare(
        "INSERT INTO grants (id, user_id, client_id, client_name, redirect_host, level, account_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(grantId, userId, approved.request.clientId, details.clientName, details.redirectHost, level, JSON.stringify(owned), Date.now()),
    ]);
    return withHeaders(c.json({ redirectTo }), approved.headers);
  } catch (e) {
    return oauthError(c, e);
  }
});

export const clients = new Hono<AppEnv>().use(requireUser);

clients.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, client_name AS clientName, redirect_host AS redirectHost, level, account_ids AS accountIds, created_at AS createdAt FROM grants WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(c.get("userId"))
    .all<{ accountIds: string }>();
  return c.json(results.map((r) => ({ ...r, accountIds: JSON.parse(r.accountIds) as string[] })));
});

clients.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.get("userId");
  await c.env.DB.prepare("DELETE FROM grants WHERE id = ? AND user_id = ?").bind(id, userId).run();
  await c.env.OAUTH_PROVIDER.revokeGrant(id, userId);
  return c.json({ ok: true });
});
