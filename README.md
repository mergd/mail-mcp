<img src="assets/icon.svg" width="64" height="64" alt="">

# mail-mcp

Open-source bridge that connects IMAP mailboxes (Yahoo, iCloud, AOL, Fastmail, or any IMAP server) to any MCP client. Runs as a stateless Cloudflare Worker.

Hosted at https://mailmcp.fldr.zip: sign in, connect a mailbox with an app password, then add `https://mailmcp.fldr.zip/mcp` as a remote MCP server in your client. When the client connects you choose which mailboxes it can use and its access level.

## Access levels and tools

| Level | Tools |
|---|---|
| Read only | `list_mailboxes`, `list_folders`, `search_messages`, `read_message`, `get_thread`, `get_attachment` |
| Read & organize | + `mark_message`, `move_message`, `archive_message`, `delete_message` (moves to Trash), `create_draft` |
| Full access | + `send_message` |

## How it works

- **Stateless:** every tool call opens an IMAP connection (`imapflow` over `cloudflare:sockets`), does its work, and closes it. No Durable Objects, no long-lived sockets.
- **Storage:** D1 holds users, sessions, mailbox settings, and grants. App passwords are encrypted with AES-256-GCM using the `MASTER_KEY` secret. Mail content is never stored.
- **OAuth:** `@cloudflare/workers-oauth-provider` (dynamic client registration and Client ID Metadata Documents), with tokens in KV. Grants are mirrored in D1 so that listing and revocation take effect immediately.
- **Sign-in:** magic links sent with Cloudflare Email.
- **Sending:** a small SMTP client over `cloudflare:sockets` (implicit TLS on 465, STARTTLS on 587).

## Development

```sh
bun install
echo "MASTER_KEY=$(openssl rand -base64 32)" > .dev.vars
bunx wrangler d1 migrations apply DB --local
bun run dev:worker   # API on :8787
bun run dev          # UI on :5173, proxies /api
bun run typecheck
```

Pushes to `main` deploy via GitHub Actions: build the UI, apply D1 migrations, then `wrangler deploy`.

## Self-hosting

Create a D1 database and a KV namespace, put their IDs in `wrangler.jsonc`, enable Email Sending on your domain, change the domain in `wrangler.jsonc` and `src/worker/index.ts`, and set the secret with `wrangler secret put MASTER_KEY`.
