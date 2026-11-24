import { Link, Text } from "@fldr/ui";
import { AuthCard } from "@fldr/ui/blocks";
import { EnvelopeOpenIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { css } from "../../styled-system/css";
import { api } from "../api";
import { IconTile, Page } from "../ui";

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
        <div className={css({ maxW: "360px", mx: "auto", textAlign: "center", display: "flex", flexDir: "column", alignItems: "center", gap: "2" })}>
          <IconTile icon={EnvelopeOpenIcon} size={48} />
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
          logo={<IconTile icon={EnvelopeSimpleIcon} size={40} />}
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
