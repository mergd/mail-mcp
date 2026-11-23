<img src="assets/icon.svg" width="64" height="64" alt="">

# mail-mcp

Created in [T3 Code](https://t3.codes).

Open-source bridge that connects IMAP mailboxes (Yahoo, iCloud, AOL, Fastmail, custom) to any MCP client. Runs as a stateless Cloudflare Worker.

## Development

```sh
bun install
bun run typecheck
docker run -d --name greenmail -p 3143:3143 -p 3025:3025 \
  -e GREENMAIL_OPTS='-Dgreenmail.setup.test.all -Dgreenmail.hostname=0.0.0.0 -Dgreenmail.users=test:pw@localhost -Dgreenmail.auth.disabled=false' \
  greenmail/standalone
bun run test
```

Pushes to `main` deploy to https://mailmcp.fldr.zip via GitHub Actions.
