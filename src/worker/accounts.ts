import { Hono } from "hono";
import type { AppEnv } from "./env";
import { encryptSecret } from "./crypto";
import { requireUser } from "./auth";
import { detect } from "./detect";
import { checkLogin } from "./imap";
import { providers, type MailAccount, type ProviderId } from "../shared/providers";

interface ConnectBody {
  provider: ProviderId;
  email: string;
  /** Defaults to the email address. */
  username?: string;
  password: string;
  imapHost?: string;
  smtpHost?: string;
  smtpPort?: number;
}

const HOST = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
/** Failed logins per address per hour before we stop trying, so the provider doesn't lock the user's account. */
const MAX_FAILURES = 10;
const FAILURE_WINDOW = 60 * 60 * 1000;

export const accounts = new Hono<AppEnv>().use(requireUser);

accounts.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, email, provider, imap_host AS imapHost, created_at AS createdAt FROM mail_accounts WHERE user_id = ? ORDER BY created_at",
  )
    .bind(c.get("userId"))
    .all<MailAccount>();
  return c.json(results);
});

accounts.post("/detect", async (c) => {
  const { email } = await c.req.json<{ email?: string }>();
  if (!email?.includes("@")) return c.json({ error: "Enter a full email address." }, 400);
  if (!(await c.env.AUTH_LIMIT.limit({ key: `detect:${c.get("userId")}` })).success) {
    return c.json({ error: "Too many requests. Wait a minute and try again." }, 429);
  }
  return c.json(await detect(email));
});

accounts.post("/", async (c) => {
  const body = await c.req.json<ConnectBody>();
  const preset = providers[body.provider];
  const email = body.email?.trim().toLowerCase();
  if (!preset || !email || !body.password) return c.json({ error: "Email and app password are required." }, 400);

  const userId = c.get("userId");
  const now = Date.now();
  const limits = await Promise.all([
    c.env.AUTH_LIMIT.limit({ key: `connect:user:${userId}` }),
    c.env.AUTH_LIMIT.limit({ key: `connect:email:${email}` }),
  ]);
  if (limits.some((l) => !l.success)) return c.json({ error: "Too many attempts. Wait a minute and try again." }, 429);
  const failures = await c.env.DB.prepare("SELECT count FROM connect_failures WHERE email = ? AND window_start > ?")
    .bind(email, now - FAILURE_WINDOW)
    .first<number>("count");
  if ((failures ?? 0) >= MAX_FAILURES) {
    return c.json({ error: "Too many failed sign-ins for this address. Wait an hour, then create a fresh app password and try again." }, 429);
  }

  // IMAP only over implicit TLS (993); SMTP over 465 (TLS) or 587 (STARTTLS). Never plaintext.
  const cfg = {
    imapHost: (body.imapHost?.trim() || preset.imap.host).toLowerCase(),
    imapPort: 993,
    smtpHost: (body.smtpHost?.trim() || preset.smtp.host).toLowerCase(),
    smtpPort: body.smtpHost ? Number(body.smtpPort) : preset.smtp.port,
  };
  if (!HOST.test(cfg.imapHost) || !HOST.test(cfg.smtpHost)) return c.json({ error: "Enter valid IMAP and SMTP server names." }, 400);
  if (![465, 587].includes(cfg.smtpPort)) return c.json({ error: "SMTP must use port 465 or 587." }, 400);

  const username = body.username?.trim() || email;
  const password = body.password.replace(/\s+/g, "");
  const login = await checkLogin({ host: cfg.imapHost, port: cfg.imapPort, username, password });
  if (login?.authFailed) {
    await c.env.DB.prepare(
      `INSERT INTO connect_failures (email, count, window_start) VALUES (?1, 1, ?2)
       ON CONFLICT(email) DO UPDATE SET
         count = CASE WHEN window_start > ?3 THEN count + 1 ELSE 1 END,
         window_start = CASE WHEN window_start > ?3 THEN window_start ELSE ?2 END`,
    )
      .bind(email, now, now - FAILURE_WINDOW)
      .run();
    const hint = body.provider === "custom" ? "Check the username and password." : "Make sure you used an app password, not your normal password.";
    return c.json({ error: `${preset.name} rejected the login. ${hint}` }, 400);
  }
  if (login) return c.json({ error: login.error }, 400);

  const id = crypto.randomUUID();
  const secret = await encryptSecret(c.env.MASTER_KEY, password, `${userId}:${id}`);
  const inserted = await c.env.DB.prepare(
    `INSERT INTO mail_accounts (id, user_id, email, provider, imap_host, imap_port, smtp_host, smtp_port, username, secret, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, email) DO NOTHING`,
  )
    .bind(id, userId, email, body.provider, cfg.imapHost, cfg.imapPort, cfg.smtpHost, cfg.smtpPort, username, secret, now)
    .run();
  await c.env.DB.prepare("DELETE FROM connect_failures WHERE email = ?").bind(email).run();
  if (!inserted.meta.changes) return c.json({ error: "This mailbox is already connected." }, 409);
  return c.json({ id });
});

accounts.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM mail_accounts WHERE id = ? AND user_id = ?").bind(c.req.param("id"), c.get("userId")).run();
  return c.json({ ok: true });
});
