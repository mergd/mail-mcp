import { Hono, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "./env";
import { randomToken, sha256 } from "./crypto";

const LOGIN_TTL = 15 * 60 * 1000;
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const COOKIE = "sid";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const auth = new Hono<AppEnv>();

auth.post("/request", async (c) => {
  const { email: raw } = await c.req.json<{ email?: string }>();
  const email = raw?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email)) return c.json({ error: "Enter a valid email address." }, 400);

  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const [byIp, byEmail] = await Promise.all([c.env.AUTH_LIMIT.limit({ key: `ip:${ip}` }), c.env.AUTH_LIMIT.limit({ key: `email:${email}` })]);
  if (!byIp.success || !byEmail.success) return c.json({ error: "Too many attempts. Try again in a minute." }, 429);

  const token = randomToken();
  await c.env.DB.prepare("INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), email, Date.now() + LOGIN_TTL)
    .run();

  // Token goes in the fragment so it never reaches server or proxy logs.
  const link = `${new URL(c.req.url).origin}/auth/verify#${token}`;
  await c.env.EMAIL.send({
    from: { name: "mail-mcp", email: "login@mailmcp.fldr.zip" },
    to: email,
    subject: "Sign in to mail-mcp",
    text: `Sign in to mail-mcp:\n\n${link}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`,
    html: `<p><a href="${link}">Sign in to mail-mcp</a></p><p>This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
  });
  return c.json({ ok: true });
});

auth.post("/verify", async (c) => {
  const { token } = await c.req.json<{ token?: string }>();
  if (!token) return c.json({ error: "Missing token." }, 400);

  const row = await c.env.DB.prepare("DELETE FROM login_tokens WHERE token_hash = ? RETURNING email, expires_at")
    .bind(await sha256(token))
    .first<{ email: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return c.json({ error: "This link is invalid or has expired." }, 400);

  const user = await c.env.DB.prepare(
    "INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET email = excluded.email RETURNING id",
  )
    .bind(crypto.randomUUID(), row.email, Date.now())
    .first<{ id: string }>();
  if (!user) throw new Error("User upsert failed");

  const sid = randomToken();
  await c.env.DB.prepare("INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(sid), user.id, Date.now() + SESSION_TTL)
    .run();
  setCookie(c, COOKIE, sid, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: SESSION_TTL / 1000 });
  return c.json({ ok: true });
});

auth.post("/logout", async (c) => {
  const sid = getCookie(c, COOKIE);
  if (sid) await c.env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256(sid)).run();
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const sid = getCookie(c, COOKIE);
  const row = sid
    ? await c.env.DB.prepare("SELECT user_id FROM sessions WHERE id_hash = ? AND expires_at > ?")
        .bind(await sha256(sid), Date.now())
        .first<{ user_id: string }>()
    : null;
  if (!row) return c.json({ error: "Not signed in." }, 401);
  c.set("userId", row.user_id);
  await next();
};
