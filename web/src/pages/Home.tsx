import { Button, ClipboardText, Collapsible, Input, Link, SensitiveInput, Text } from "@fldr/ui";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { css } from "../../styled-system/css";
import { levelLabels, type AccessLevel } from "../../../src/shared/access";
import { providers, type Detected, type MailAccount } from "../../../src/shared/providers";
import { api, ApiError, navigate } from "../api";
import { ErrorBanner, Page, Row, Rows, Section, stack } from "../ui";
import { ProviderSteps } from "./Guide";

interface Client {
  id: string;
  clientName: string;
  level?: AccessLevel;
  accountIds: string[];
  createdAt: number;
}

export function Home() {
  const [me, setMe] = useState<{ email: string } | null>(null);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const load = () => Promise.all([api<MailAccount[]>("/accounts").then(setAccounts), api<Client[]>("/clients").then(setClients)]);

  useEffect(() => {
    api<{ email: string }>("/me").then(
      (u) => {
        setMe(u);
        load();
      },
      (err) => err instanceof ApiError && err.status === 401 && navigate("/login"),
    );
  }, []);

  if (!me) return null;

  async function remove(id: string) {
    await api(`/accounts/${id}`, { method: "DELETE" });
    await load();
  }

  async function revoke(id: string) {
    await api(`/clients/${id}`, { method: "DELETE" });
    await load();
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    navigate("/login");
  }

  const emailOf = (id: string) => accounts.find((a) => a.id === id)?.email;

  return (
    <Page>
      <header className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4" })}>
        <Text variant="heading" size="lg" as="h1">
          mail-mcp
        </Text>
        <div className={css({ display: "flex", alignItems: "center", gap: "2", minW: 0 })}>
          <Text variant="secondary" truncate>
            {me.email}
          </Text>
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      {accounts.length > 0 && (
        <Section title="Mailboxes">
          <Rows>
            {accounts.map((a) => (
              <Row
                key={a.id}
                title={a.email}
                detail={providers[a.provider].name}
                action={
                  <Button variant="secondary-destructive" size="sm" onClick={() => remove(a.id)}>
                    Remove
                  </Button>
                }
              />
            ))}
          </Rows>
        </Section>
      )}

      <ConnectForm onConnected={load} />

      {accounts.length > 0 && (
        <Section title="Connect your AI app">
          <div className={stack("3")}>
            <Text variant="secondary">
              Add this URL as a remote MCP server (in Claude: Settings → Connectors → Add custom connector). You'll choose which mailboxes it can use
              and what it may do.
            </Text>
            <ClipboardText text={`${location.origin}/mcp`} />
          </div>
        </Section>
      )}

      {clients.length > 0 && (
        <Section title="Connected apps">
          <Rows>
            {clients.map((cl) => (
              <Row
                key={cl.id}
                title={cl.clientName}
                detail={`${cl.level ? levelLabels[cl.level].title : "Unknown access"} · ${cl.accountIds.map(emailOf).filter(Boolean).join(", ") || "no mailboxes"}`}
                action={
                  <Button variant="secondary-destructive" size="sm" onClick={() => revoke(cl.id)}>
                    Revoke
                  </Button>
                }
              />
            ))}
          </Rows>
        </Section>
      )}

      <Link href="/privacy" variant="plain">
        <Text variant="secondary" size="sm" as="span">
          Privacy
        </Text>
      </Link>
    </Page>
  );
}

const emptyForm = { username: "", password: "", imapHost: "", smtpHost: "", smtpPort: "465" };

function ConnectForm({ onConnected }: { onConnected: () => void }) {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<Detected | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function run(fn: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const lookup = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const d = await api<Detected>("/accounts/detect", { body: { email: email.trim() } });
      setForm({ ...emptyForm, username: email.trim(), imapHost: d.imap?.host ?? "", smtpHost: d.smtp?.host ?? "", smtpPort: String(d.smtp?.port ?? 465) });
      setFound(d);
    });
  };

  const connect = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      await api("/accounts", { body: { provider: found!.provider, email: email.trim(), ...form, smtpPort: Number(form.smtpPort) } });
      setFound(null);
      setEmail("");
      setForm(emptyForm);
      onConnected();
    });
  };

  const back = () => {
    setFound(null);
    setError("");
  };

  if (!found) {
    return (
      <Section title="Connect a mailbox">
        <form onSubmit={lookup} className={stack("4")}>
          <Text variant="secondary">
            iCloud, Gmail, Yahoo, AOL, Fastmail, Zoho, or any IMAP provider. <Link href="/guide">Setup guides</Link>
          </Text>
          <Input label="Email address" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <ErrorBanner>{error}</ErrorBanner>
          <div>
            <Button type="submit" variant="primary" loading={pending}>
              Continue
            </Button>
          </div>
        </form>
      </Section>
    );
  }

  const backButton = (
    <Button type="button" variant="ghost" size="sm" icon={ArrowLeftIcon} onClick={back}>
      Back
    </Button>
  );

  if (found.unsupported) {
    return (
      <Section title={found.unsupported.name} actions={backButton}>
        <Text variant="secondary">{found.unsupported.note}</Text>
      </Section>
    );
  }

  const provider = providers[found.provider];
  const custom = found.provider === "custom";
  const servers = (
    <div className={css({ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "3" })}>
      <Input label="IMAP server" required value={form.imapHost} onChange={set("imapHost")} placeholder="imap.example.com" />
      <Input label="Port" value="993" readOnly description="TLS" />
      <Input label="SMTP server" required value={form.smtpHost} onChange={set("smtpHost")} placeholder="smtp.example.com" />
      <Input label="Port" required inputMode="numeric" value={form.smtpPort} onChange={set("smtpPort")} description="465 or 587" />
    </div>
  );

  return (
    <Section title={found.customDomain && !custom ? `${provider.name} (custom domain)` : provider.name} actions={backButton}>
      <form onSubmit={connect} className={stack("4")}>
        <ProviderSteps provider={provider} />
        <Input label="Username" required autoComplete="username" value={form.username} onChange={set("username")} description={found.usernameHint} />
        <SensitiveInput
          label={custom ? "Password" : "App password"}
          required
          autoComplete="off"
          value={form.password}
          onValueChange={(password) => setForm({ ...form, password })}
        />
        {custom && !found.imap ? (
          servers
        ) : (
          <Collapsible.Root>
            <Collapsible.DefaultTrigger>Server settings</Collapsible.DefaultTrigger>
            <Collapsible.DefaultPanel>{servers}</Collapsible.DefaultPanel>
          </Collapsible.Root>
        )}
        <ErrorBanner>{error}</ErrorBanner>
        <div>
          <Button type="submit" variant="primary" loading={pending}>
            {pending ? "Testing connection…" : "Connect"}
          </Button>
        </div>
      </form>
    </Section>
  );
}
