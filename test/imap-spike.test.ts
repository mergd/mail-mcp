import { ImapFlow } from "imapflow";
import { expect, it } from "vitest";

// Requires: docker run -d -p 3143:3143 -p 3025:3025 -e GREENMAIL_OPTS='-Dgreenmail.setup.test.all -Dgreenmail.hostname=0.0.0.0 -Dgreenmail.users=test:pw@localhost -Dgreenmail.auth.disabled=false' greenmail/standalone
it("imapflow connects and lists mailboxes inside workerd", async () => {
  const client = new ImapFlow({
    host: "127.0.0.1",
    port: 3143,
    secure: false,
    auth: { user: "test", pass: "pw" },
    logger: false,
  });
  await client.connect();
  const boxes = await client.list();
  await client.logout();
  expect(boxes.map((b) => b.path)).toContain("INBOX");
});
