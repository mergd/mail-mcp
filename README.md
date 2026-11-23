<img src="assets/icon.svg" width="64" height="64" alt="">

# mail-mcp

Created in [T3 Code](https://t3.codes).

Open-source bridge that connects IMAP mailboxes (Yahoo, iCloud, AOL, Fastmail, custom) to any MCP client. Runs as a stateless Cloudflare Worker.

## Development

```sh
bun install
bun run typecheck
```

Pushes to `main` deploy to https://mailmcp.fldr.zip via GitHub Actions.
