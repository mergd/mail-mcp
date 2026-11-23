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
    const { redirectTo } = await oauthApi.completeAuthorization({
      request: approved.request,
      userId,
      scope,
      props,
      metadata: { clientName: details.clientName, redirectHost: details.redirectHost, level, accountIds: owned },
    });
    return withHeaders(c.json({ redirectTo }), approved.headers);
  } catch (e) {
    return oauthError(c, e);
  }
});

export const clients = new Hono<AppEnv>().use(requireUser);

clients.get("/", async (c) => {
  const { items } = await c.env.OAUTH_PROVIDER.listUserGrants(c.get("userId"));
  return c.json(
    items.map((g) => ({
      id: g.id,
      clientName: g.metadata?.clientName ?? g.clientId,
      redirectHost: g.metadata?.redirectHost,
      level: g.metadata?.level,
      accountIds: g.metadata?.accountIds ?? [],
      createdAt: g.createdAt * 1000,
    })),
  );
});

clients.delete("/:id", async (c) => {
  await c.env.OAUTH_PROVIDER.revokeGrant(c.req.param("id"), c.get("userId"));
  return c.json({ ok: true });
});
