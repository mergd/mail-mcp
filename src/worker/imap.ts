import { connect } from "cloudflare:sockets";
import { createSocketsTransport, ImapFlow, type SocketsConnect } from "imapflow";

const socketsConnect: SocketsConnect = (address, options) =>
  connect(address, { secureTransport: options?.secureTransport ?? "off", allowHalfOpen: options?.allowHalfOpen ?? false });

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
    transport: createSocketsTransport(socketsConnect),
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

export async function checkLogin(cfg: ImapConfig): Promise<{ error: string; authFailed: boolean } | null> {
  try {
    await withImap(cfg, (c) => c.mailboxOpen("INBOX", { readOnly: true }));
    return null;
  } catch (e) {
    const err = e as { authenticationFailed?: boolean; message?: string };
    if (err.authenticationFailed) return { error: "Login failed. Check the username and password.", authFailed: true };
    return { error: `Couldn't connect to ${cfg.host}:${cfg.port}: ${err.message ?? "unknown error"}`, authFailed: false };
  }
}
