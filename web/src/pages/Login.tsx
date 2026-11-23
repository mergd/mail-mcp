import { useState, type FormEvent } from "react";
import { css } from "../../styled-system/css";
import { api } from "../api";
import { Button, Card, ErrorText, Heading, Page, TextField } from "../ui";

export function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/auth/request", { body: { email } });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Page>
      <Heading>mail-mcp</Heading>
      <p className={css({ color: "muted" })}>Connect Yahoo, iCloud, AOL, Fastmail or any IMAP mailbox to your AI assistant over MCP.</p>
      <Card>
        {sent ? (
          <p>
            Check <strong>{email}</strong> for a sign-in link. It expires in 15 minutes.
          </p>
        ) : (
          <form onSubmit={submit} className={css({ display: "flex", flexDir: "column", gap: "4" })}>
            <TextField label="Email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Email me a sign-in link"}
            </Button>
          </form>
        )}
      </Card>
      <a href="/privacy" className={css({ fontSize: "sm", color: "muted" })}>
        Privacy
      </a>
    </Page>
  );
}
