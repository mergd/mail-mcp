import { Hono } from "hono";
import type { AppEnv } from "./env";
import { encryptSecret } from "./crypto";
import { requireUser } from "./auth";
import { checkLogin } from "./imap";
import { providers, type MailAccount, type ProviderId } from "../shared/providers";

interface ConnectBody {
  provider: ProviderId;
  email: string;
  password: string;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
}

export const accounts = new Hono<AppEnv>().use(requireUser);

accounts.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, email, provider, imap_host AS imapHost, created_at AS createdAt FROM mail_accounts WHERE user_id = ? ORDER BY created_at",
  )
    .bind(c.get("userId"))
    .all<MailAccount>();
  return c.json(results);
});

accounts.post("/", async (c) => {
  const body = await c.req.json<ConnectBody>();
  const preset = providers[body.provider];
  const email = body.email?.trim().toLowerCase();
  if (!preset || !email || !body.password) return c.json({ error: "Email and app password are required." }, 400);

  const custom = body.provider === "custom";
  const cfg = {
    imapHost: custom ? body.imapHost?.trim() : preset.imap.host,
    imapPort: custom ? Number(body.imapPort) : preset.imap.port,
    smtpHost: custom ? body.smtpHost?.trim() : preset.smtp.host,
    smtpPort: custom ? Number(body.smtpPort) : preset.smtp.port,
  };
  if (!cfg.imapHost || !cfg.smtpHost || !cfg.imapPort || !cfg.smtpPort) return c.json({ error: "IMAP and SMTP server settings are required." }, 400);

  const password = body.password.replace(/\s+/g, "");
  const loginError = await checkLogin({ host: cfg.imapHost, port: cfg.imapPort, username: email, password });
  if (loginError) return c.json({ error: loginError }, 400);

  const userId = c.get("userId");
  const id = crypto.randomUUID();
  const secret = await encryptSecret(c.env.MASTER_KEY, password, `${userId}:${id}`);
  const inserted = await c.env.DB.prepare(
    `INSERT INTO mail_accounts (id, user_id, email, provider, imap_host, imap_port, smtp_host, smtp_port, username, secret, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, email) DO NOTHING`,
  )
    .bind(id, userId, email, body.provider, cfg.imapHost, cfg.imapPort, cfg.smtpHost, cfg.smtpPort, email, secret, Date.now())
    .run();
  if (!inserted.meta.changes) return c.json({ error: "This mailbox is already connected." }, 409);
  return c.json({ id });
});

accounts.delete("/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM mail_accounts WHERE id = ? AND user_id = ?").bind(c.req.param("id"), c.get("userId")).run();
  return c.json({ ok: true });
});
