import type { FetchMessageObject, ImapFlow, MessageStructureObject, SearchObject } from "imapflow";
import { providers, type ProviderId } from "../shared/providers";
import { decryptSecret } from "./crypto";
import type { Env } from "./env";
import { withImap } from "./imap";
import { bareAddress, buildMessage } from "./mime";
import { sendSmtp } from "./smtp";

export class UserError extends Error {}

export interface Account {
  id: string;
  email: string;
  provider: ProviderId;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
}

interface AccountRow {
  id: string;
  email: string;
  provider: ProviderId;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  username: string;
  secret: string;
}

export async function loadAccounts(env: Env, userId: string, ids: string[]): Promise<Account[]> {
  if (!ids.length) return [];
  const { results } = await env.DB.prepare(`SELECT * FROM mail_accounts WHERE user_id = ? AND id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at`)
    .bind(userId, ...ids)
    .all<AccountRow>();
  return Promise.all(
    results.map(async (r) => ({
      id: r.id,
      email: r.email,
      provider: r.provider,
      imapHost: r.imap_host,
      imapPort: r.imap_port,
      smtpHost: r.smtp_host,
      smtpPort: r.smtp_port,
      username: r.username,
      password: await decryptSecret(env.MASTER_KEY, r.secret, `${userId}:${r.id}`),
    })),
  );
}

const imap = <T>(a: Account, fn: (c: ImapFlow) => Promise<T>) =>
  withImap({ host: a.imapHost, port: a.imapPort, username: a.username, password: a.password }, fn).catch((e: unknown) => {
    if ((e as { authenticationFailed?: boolean }).authenticationFailed)
      throw new UserError(`Login to ${a.email} failed. The app password may have been revoked; reconnect it at https://mailmcp.fldr.zip.`);
    throw e;
  });

// --- Message references: "<accountId>:<uidValidity>:<uid>:<folder>" ---

interface Ref {
  accountId: string;
  uidValidity: string;
  uid: number;
  folder: string;
}

const encodeRef = (r: Ref) => `${r.accountId}:${r.uidValidity}:${r.uid}:${r.folder}`;

function decodeRef(id: string): Ref {
  const [accountId, uidValidity, uid, ...folder] = id.split(":");
  if (!accountId || !uidValidity || !uid || !folder.length) throw new UserError(`Invalid message id: ${id}`);
  return { accountId, uidValidity, uid: Number(uid), folder: folder.join(":") };
}

function accountFor(accounts: Account[], ref: Ref) {
  const a = accounts.find((x) => x.id === ref.accountId);
  if (!a) throw new UserError("That message belongs to a mailbox this connection can't access.");
  return a;
}

async function openRef(c: ImapFlow, ref: Ref, readOnly: boolean) {
  const box = await c.mailboxOpen(ref.folder, { readOnly });
  if (String(box.uidValidity) !== ref.uidValidity) throw new UserError("This message id is out of date. Search again.");
}

// --- Folders ---

const SPECIAL: Record<string, string> = {
  inbox: "\\Inbox",
  sent: "\\Sent",
  drafts: "\\Drafts",
  trash: "\\Trash",
  junk: "\\Junk",
  spam: "\\Junk",
  archive: "\\Archive",
};

async function resolveFolder(c: ImapFlow, name: string): Promise<string> {
  const special = SPECIAL[name.toLowerCase()];
  if (!special) return name;
  if (special === "\\Inbox") return "INBOX";
  const match = (await c.list()).find((f) => f.specialUse === special);
  if (!match) throw new UserError(`This mailbox has no ${name} folder. Use list_folders to see what exists.`);
  return match.path;
}

export const listFolders = (a: Account) =>
  imap(a, async (c) => (await c.list()).map((f) => ({ path: f.path, specialUse: f.specialUse?.replace("\\", "").toLowerCase() })));

// --- Summaries ---

type Addr = { name?: string; address?: string };
const fmtAddr = (a?: Addr) => (a ? (a.name ? `${a.name} <${a.address}>` : (a.address ?? "")) : "");
const fmtList = (xs?: Addr[]) => (xs ?? []).map(fmtAddr);

function summary(a: Account, folder: string, uidValidity: string, m: FetchMessageObject) {
  const date = m.envelope?.date ?? m.internalDate;
  return {
    id: encodeRef({ accountId: a.id, uidValidity, uid: m.uid, folder }),
    mailbox: a.email,
    folder,
    from: fmtAddr(m.envelope?.from?.[0]),
    to: fmtList(m.envelope?.to),
    subject: m.envelope?.subject ?? "",
    date: date ? new Date(date).toISOString() : undefined,
    unread: !m.flags?.has("\\Seen"),
    flagged: m.flags?.has("\\Flagged") ?? false,
  };
}

type Summary = ReturnType<typeof summary>;

async function fetchSummaries(c: ImapFlow, a: Account, folder: string, uids: number[]): Promise<Summary[]> {
  if (!uids.length) return [];
  const box = c.mailbox;
  const uidValidity = box ? String(box.uidValidity) : "0";
  const msgs = await c.fetchAll(uids.join(","), { envelope: true, flags: true, internalDate: true }, { uid: true });
  return msgs.map((m) => summary(a, folder, uidValidity, m));
}

export interface SearchParams {
  folder?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  since?: string;
  before?: string;
  unread?: boolean;
  flagged?: boolean;
  limit?: number;
}

export async function searchMessages(accounts: Account[], p: SearchParams) {
  const limit = Math.min(p.limit ?? 20, 100);
  const query: SearchObject = {};
  if (p.from) query.from = p.from;
  if (p.to) query.to = p.to;
  if (p.subject) query.subject = p.subject;
  if (p.text) query.text = p.text;
  if (p.since) query.since = p.since;
  if (p.before) query.before = p.before;
  if (p.unread !== undefined) query.seen = !p.unread;
  if (p.flagged !== undefined) query.flagged = p.flagged;
  if (!Object.keys(query).length) query.all = true;

  const perAccount = await Promise.all(
    accounts.map((a) =>
      imap(a, async (c) => {
        const folder = await resolveFolder(c, p.folder ?? "inbox");
        await c.mailboxOpen(folder, { readOnly: true });
        const uids = (await c.search(query, { uid: true })) || [];
        return fetchSummaries(c, a, folder, uids.sort((x, y) => y - x).slice(0, limit));
      }).catch((e: unknown) => {
        if (accounts.length === 1) throw e;
        return [{ mailbox: a.email, error: (e as Error).message }];
      }),
    ),
  );
  const flat = perAccount.flat();
  const errors = flat.filter((x): x is { mailbox: string; error: string } => "error" in x);
  const messages = flat
    .filter((x): x is Summary => !("error" in x))
    .sort((x, y) => (y.date ?? "").localeCompare(x.date ?? ""))
    .slice(0, limit);
  return errors.length ? { messages, errors } : { messages };
}

// --- Reading ---

interface Leaf {
  part: string;
  type: string;
  size?: number;
  filename?: string;
  disposition?: string;
}

function leaves(node: MessageStructureObject, out: Leaf[] = []): Leaf[] {
  if (node.childNodes?.length) {
    for (const child of node.childNodes) leaves(child, out);
  } else {
    out.push({
      part: node.part ?? "1",
      type: node.type.toLowerCase(),
      size: node.size,
      filename: node.dispositionParameters?.filename ?? node.parameters?.name,
      disposition: node.disposition?.toLowerCase(),
    });
  }
  return out;
}

const isBody = (l: Leaf) => !l.filename && l.disposition !== "attachment" && (l.type === "text/plain" || l.type === "text/html");

async function streamToBytes(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function htmlToText(html: string) {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function readMessage(accounts: Account[], id: string, maxChars = 20000) {
  const ref = decodeRef(id);
  const a = accountFor(accounts, ref);
  return imap(a, async (c) => {
    await openRef(c, ref, true);
    const m = await c.fetchOne(String(ref.uid), { envelope: true, flags: true, internalDate: true, bodyStructure: true }, { uid: true });
    if (!m) throw new UserError("Message not found. It may have been moved or deleted.");
    const parts = m.bodyStructure ? leaves(m.bodyStructure) : [];
    const bodyPart = parts.find((l) => isBody(l) && l.type === "text/plain") ?? parts.find(isBody);

    let text = "";
    if (bodyPart) {
      const dl = await c.download(String(ref.uid), bodyPart.part, { uid: true, maxBytes: 500_000 });
      if (dl.content) {
        const raw = new TextDecoder().decode(await streamToBytes(dl.content));
        text = bodyPart.type === "text/html" ? htmlToText(raw) : raw.trim();
      }
    }
    const truncated = text.length > maxChars;
    return {
      ...summary(a, ref.folder, ref.uidValidity, m),
      cc: fmtList(m.envelope?.cc),
      replyTo: fmtList(m.envelope?.replyTo),
      text: truncated ? `${text.slice(0, maxChars)}\n\n[truncated: ${text.length - maxChars} more characters]` : text,
      attachments: parts.filter((l) => l !== bodyPart && !isBody(l)).map((l) => ({ part: l.part, filename: l.filename ?? "(unnamed)", type: l.type, size: l.size })),
    };
  });
}

export const MAX_ATTACHMENT = 5 * 1024 * 1024;

export async function getAttachment(accounts: Account[], id: string, part: string) {
  const ref = decodeRef(id);
  const a = accountFor(accounts, ref);
  return imap(a, async (c) => {
    await openRef(c, ref, true);
    const dl = await c.download(String(ref.uid), part, { uid: true, maxBytes: MAX_ATTACHMENT + 1 });
    if (!dl.content) throw new UserError("Attachment not found.");
    const bytes = await streamToBytes(dl.content);
    if (bytes.length > MAX_ATTACHMENT) throw new UserError("Attachment is larger than 5 MB.");
    return { bytes, type: dl.meta?.contentType ?? "application/octet-stream", filename: dl.meta?.filename };
  });
}

// --- Threads ---

async function threadHeaders(c: ImapFlow, uid: number) {
  const m = await c.fetchOne(String(uid), { envelope: true, headers: ["references"] }, { uid: true });
  if (!m) throw new UserError("Message not found. It may have been moved or deleted.");
  const refs = (m.headers?.toString().match(/<[^>]+>/g) ?? []) as string[];
  return { messageId: m.envelope?.messageId, references: refs, subject: m.envelope?.subject ?? "" };
}

export async function getThread(accounts: Account[], id: string) {
  const ref = decodeRef(id);
  const a = accountFor(accounts, ref);
  return imap(a, async (c) => {
    await openRef(c, ref, true);
    const h = await threadHeaders(c, ref.uid);
    const ids = [...new Set([...h.references, h.messageId].filter((x): x is string => !!x))].slice(-20);
    const root = ids[0];
    if (!root) return { messages: [] };

    const query: SearchObject = { or: [...ids.map((x) => ({ header: { "message-id": x } })), { header: { references: root } }] };
    const extra = await Promise.all(["sent", "archive"].map((f) => resolveFolder(c, f).catch(() => "")));
    const folders = [...new Set(["INBOX", ref.folder, ...extra].filter(Boolean))];
    const found: Summary[] = [];
    for (const folder of folders) {
      await c.mailboxOpen(folder, { readOnly: true });
      const uids = (await c.search(query, { uid: true })) || [];
      found.push(...(await fetchSummaries(c, a, folder, uids.slice(-50))));
    }
    return { messages: found.sort((x, y) => (x.date ?? "").localeCompare(y.date ?? "")) };
  });
}

// --- Organizing ---

export async function markMessage(accounts: Account[], id: string, flags: { read?: boolean; flagged?: boolean }) {
  const ref = decodeRef(id);
  return imap(accountFor(accounts, ref), async (c) => {
    await openRef(c, ref, false);
    const uid = String(ref.uid);
    for (const [flag, on] of [["\\Seen", flags.read], ["\\Flagged", flags.flagged]] as const) {
      if (on === true) await c.messageFlagsAdd(uid, [flag], { uid: true });
      if (on === false) await c.messageFlagsRemove(uid, [flag], { uid: true });
    }
    return { ok: true };
  });
}

export async function moveMessage(accounts: Account[], id: string, destination: string) {
  const ref = decodeRef(id);
  return imap(accountFor(accounts, ref), async (c) => {
    const target = await resolveFolder(c, destination);
    if (target === ref.folder) throw new UserError(`The message is already in ${target}.`);
    await openRef(c, ref, false);
    const res = await c.messageMove(String(ref.uid), target, { uid: true });
    if (!res) throw new UserError("Move failed. The message may already have been moved.");
    return { ok: true, folder: target };
  });
}

// --- Composing ---

export interface Draft {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body: string;
  replyToId?: string;
}

async function compose(c: ImapFlow, a: Account, accounts: Account[], d: Draft, includeBcc: boolean) {
  let subject = d.subject;
  let inReplyTo: string | undefined;
  let references: string | undefined;
  if (d.replyToId) {
    const ref = decodeRef(d.replyToId);
    if (ref.accountId !== a.id) throw new UserError("Replies must be sent from the mailbox that received the original message.");
    accountFor(accounts, ref);
    await openRef(c, ref, true);
    const h = await threadHeaders(c, ref.uid);
    inReplyTo = h.messageId;
    references = [...h.references, h.messageId].filter(Boolean).join(" ") || undefined;
    subject ??= /^re:/i.test(h.subject) ? h.subject : `Re: ${h.subject}`;
  }
  if (!subject) throw new UserError("A subject is required.");
  return buildMessage({ from: a.email, to: d.to ?? [], cc: d.cc, bcc: d.bcc, subject, text: d.body, inReplyTo, references, includeBcc });
}

export async function createDraft(accounts: Account[], a: Account, d: Draft) {
  return imap(a, async (c) => {
    const { raw } = await compose(c, a, accounts, d, true);
    const drafts = await resolveFolder(c, "drafts");
    await c.append(drafts, raw, ["\\Draft", "\\Seen"]);
    return { ok: true, folder: drafts };
  });
}

export async function sendMessage(accounts: Account[], a: Account, d: Draft) {
  const recipients = [...(d.to ?? []), ...(d.cc ?? []), ...(d.bcc ?? [])].map(bareAddress);
  if (!recipients.length) throw new UserError("At least one recipient is required.");
  return imap(a, async (c) => {
    const { raw, messageId } = await compose(c, a, accounts, d, false);
    await sendSmtp({ host: a.smtpHost, port: a.smtpPort, username: a.username, password: a.password }, { from: a.email, to: recipients }, raw).catch((e: unknown) => {
      throw new UserError((e as Error).message);
    });
    if (providers[a.provider].appendSent) {
      const sent = await resolveFolder(c, "sent").catch(() => null);
      if (sent) await c.append(sent, raw, ["\\Seen"]);
    }
    return { ok: true, messageId };
  });
}
