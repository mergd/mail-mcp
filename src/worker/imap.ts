import { ImapFlow } from "imapflow";

export interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export async function withImap<T>(cfg: ImapConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 993,
    auth: { user: cfg.username, pass: cfg.password },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export async function checkLogin(cfg: ImapConfig): Promise<string | null> {
  try {
    await withImap(cfg, (c) => c.mailboxOpen("INBOX"));
    return null;
  } catch (e) {
    const err = e as { authenticationFailed?: boolean; message?: string };
    if (err.authenticationFailed) return "Login failed. Check the email address and app password.";
    return `Couldn't connect to ${cfg.host}:${cfg.port}: ${err.message ?? "unknown error"}`;
  }
}
