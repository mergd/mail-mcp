import { Link, Text } from "@fldr/ui";
import { AuthCard } from "@fldr/ui/blocks";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { api } from "../api";
import { Page } from "../ui";

export function Login() {
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit({ email }: { email: string }) {
    setPending(true);
    setError("");
    try {
      await api("/auth/request", { body: { email, next: new URLSearchParams(location.search).get("next") ?? "/" } });
      setSent(email);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Page>
      {sent ? (
        <div className={css({ maxW: "360px", mx: "auto", textAlign: "center" })}>
          <Text variant="heading" size="lg" as="h1">
            Check your email
          </Text>
          <Text variant="secondary">
            We sent a sign-in link to <Text as="strong" bold>{sent}</Text>. It expires in 15 minutes.
          </Text>
        </div>
      ) : (
        <AuthCard
          method="magic-link"
          title="Sign in to mail-mcp"
          description="Connect Yahoo, iCloud, AOL, Fastmail or any IMAP mailbox to your AI assistant over MCP."
          error={error}
          loading={pending}
          onSubmit={submit}
          footer={<Link href="/privacy">Privacy</Link>}
        />
      )}
    </Page>
  );
}
