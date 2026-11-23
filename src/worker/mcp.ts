import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { OAuthResourceContext } from "@cloudflare/workers-oauth-provider";
import { z } from "zod";
import type { GrantProps } from "../shared/access";
import { providers } from "../shared/providers";
import { bytesToB64 } from "./b64";
import type { Env } from "./env";
import * as mail from "./mail";

const json = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });

async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (e) {
    const message = e instanceof mail.UserError ? e.message : `Mail server error: ${(e as Error).message}`;
    return { isError: true, content: [{ type: "text", text: message }] };
  }
}

const messageId = z.string().describe("Message id from search_messages, get_thread or read_message");
const addresses = z.array(z.string()).describe('Addresses, e.g. "ada@example.com" or "Ada Lovelace <ada@example.com>"');
const compose = {
  account: z.string().describe("Mailbox to use (email address). Optional when replying."),
  to: addresses.optional(),
  cc: addresses.optional(),
  bcc: addresses.optional(),
  subject: z.string().optional().describe("Required unless replying; defaults to Re: <original subject>"),
  body: z.string().describe("Plain-text body"),
  reply_to_id: messageId.optional().describe("Message id being replied to; sets threading headers"),
};

function buildServer(env: Env, grant: GrantProps, scopes: string[]) {
  const server = new McpServer({ name: "mail-mcp", version: "0.1.0" });
  let cache: Promise<mail.Account[]> | undefined;
  const accounts = () => (cache ??= mail.loadAccounts(env, grant.userId, grant.accountIds));

  async function pick(account?: string) {
    const all = await accounts();
    if (!account) return all;
    const key = account.toLowerCase();
    const match = all.filter((a) => a.email === key || a.id === account);
    if (!match.length) throw new mail.UserError(`No connected mailbox "${account}". Use list_mailboxes to see what's available.`);
    return match;
  }
  async function pickOne(account?: string, replyToId?: string) {
    if (!account && replyToId) account = replyToId.split(":")[0];
    const all = await accounts();
    if (!account && all.length === 1) return all[0]!;
    if (!account) throw new mail.UserError("Specify which mailbox to use.");
    return (await pick(account))[0]!;
  }

  const read = { readOnlyHint: true, openWorldHint: false };

  server.registerTool(
    "list_mailboxes",
    { description: "List the email accounts this connection can access.", annotations: read },
    () => run(async () => json((await accounts()).map((a) => ({ email: a.email, provider: providers[a.provider].name })))),
  );

  server.registerTool(
    "list_folders",
    { description: "List folders in a mailbox.", inputSchema: { account: z.string().describe("Mailbox email address") }, annotations: read },
    ({ account }) => run(async () => json(await mail.listFolders(await pickOne(account)))),
  );

  server.registerTool(
    "search_messages",
    {
      description:
        "Search messages, newest first. Searches every mailbox when `account` is omitted. With no filters, lists the latest messages in the folder.",
      inputSchema: {
        account: z.string().optional().describe("Mailbox email address; omit to search all"),
        folder: z.string().optional().describe('Folder path, or one of: inbox, sent, drafts, trash, junk, archive. Default: inbox'),
        from: z.string().optional(),
        to: z.string().optional(),
        subject: z.string().optional(),
        text: z.string().optional().describe("Matches headers and body"),
        since: z.string().optional().describe("ISO date, inclusive"),
        before: z.string().optional().describe("ISO date, exclusive"),
        unread: z.boolean().optional(),
        flagged: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional().describe("Default 20"),
      },
      annotations: read,
    },
    ({ account, ...params }) => run(async () => json(await mail.searchMessages(await pick(account), params))),
  );

  server.registerTool(
    "read_message",
    {
      description: "Read a message's headers, text body, and attachment list. Doesn't mark it as read.",
      inputSchema: { id: messageId, max_chars: z.number().int().min(500).max(200_000).optional().describe("Default 20000") },
      annotations: read,
    },
    ({ id, max_chars }) => run(async () => json(await mail.readMessage(await accounts(), id, max_chars))),
  );

  server.registerTool(
    "get_thread",
    { description: "List the messages in a message's conversation (from Inbox, Sent, Archive and the message's own folder), oldest first.", inputSchema: { id: messageId }, annotations: read },
    ({ id }) => run(async () => json(await mail.getThread(await accounts(), id))),
  );

  server.registerTool(
    "get_attachment",
    {
      description: "Download an attachment (up to 5 MB) by its part number from read_message.",
      inputSchema: { id: messageId, part: z.string().describe("Attachment part from read_message") },
      annotations: read,
    },
    ({ id, part }) =>
      run(async () => {
        const att = await mail.getAttachment(await accounts(), id, part);
        if (att.type.startsWith("text/")) return { content: [{ type: "text", text: new TextDecoder().decode(att.bytes) }] };
        const data = bytesToB64(att.bytes);
        if (att.type.startsWith("image/")) return { content: [{ type: "image", data, mimeType: att.type }] };
        return { content: [{ type: "resource", resource: { uri: `attachment:///${encodeURIComponent(att.filename ?? part)}`, mimeType: att.type, blob: data } }] };
      }),
  );

  if (scopes.includes("mail.write")) {
    const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

    server.registerTool(
      "mark_message",
      {
        description: "Mark a message read/unread and/or flagged/unflagged.",
        inputSchema: { id: messageId, read: z.boolean().optional(), flagged: z.boolean().optional() },
        annotations: { ...write, idempotentHint: true },
      },
      ({ id, ...flags }) => run(async () => json(await mail.markMessage(await accounts(), id, flags))),
    );

    server.registerTool(
      "move_message",
      {
        description: "Move a message to another folder. Message ids change after a move.",
        inputSchema: { id: messageId, folder: z.string().describe("Folder path, or inbox, sent, drafts, trash, junk, archive") },
        annotations: write,
      },
      ({ id, folder }) => run(async () => json(await mail.moveMessage(await accounts(), id, folder))),
    );

    server.registerTool(
      "archive_message",
      { description: "Move a message to the Archive folder.", inputSchema: { id: messageId }, annotations: write },
      ({ id }) => run(async () => json(await mail.moveMessage(await accounts(), id, "archive"))),
    );

    server.registerTool(
      "delete_message",
      { description: "Move a message to Trash. Doesn't delete permanently.", inputSchema: { id: messageId }, annotations: { ...write, destructiveHint: true } },
      ({ id }) => run(async () => json(await mail.moveMessage(await accounts(), id, "trash"))),
    );

    server.registerTool(
      "create_draft",
      { description: "Save a plain-text draft in the mailbox's Drafts folder.", inputSchema: { ...compose, account: compose.account.optional() }, annotations: write },
      ({ account, reply_to_id, ...d }) =>
        run(async () => json(await mail.createDraft(await accounts(), await pickOne(account, reply_to_id), { ...d, replyToId: reply_to_id }))),
    );
  }

  if (scopes.includes("mail.send")) {
    server.registerTool(
      "send_message",
      {
        description: "Send a plain-text email from one of the connected mailboxes.",
        inputSchema: { ...compose, account: compose.account.optional() },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      },
      ({ account, reply_to_id, ...d }) =>
        run(async () => json(await mail.sendMessage(await accounts(), await pickOne(account, reply_to_id), { ...d, replyToId: reply_to_id }))),
    );
  }

  return server;
}

export const mcpHandler: ExportedHandler<Env> & { fetch: NonNullable<ExportedHandler<Env>["fetch"]> } = {
  async fetch(request, env, ctx) {
    const { props, auth } = ctx as unknown as OAuthResourceContext<GrantProps>;
    // Revocation check against D1: KV-backed token deletion can lag behind a revoke.
    const grantId = auth.token.split(":")[1];
    const live = grantId && (await env.DB.prepare("SELECT 1 FROM grants WHERE id = ? AND user_id = ?").bind(grantId, props.userId).first());
    if (!live) return new Response("Access was revoked", { status: 401, headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' } });

    const { success } = await env.MCP_LIMIT.limit({ key: props.userId });
    if (!success) return Response.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });

    const server = buildServer(env, props, auth.scope);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
