import { useEffect, useState, type FormEvent } from "react";
import { css, cx } from "../../styled-system/css";
import { levelLabels, type AccessLevel } from "../../../src/shared/access";
import { providers, type Detected, type MailAccount } from "../../../src/shared/providers";
import { api, ApiError, navigate } from "../api";
import { Button, Card, ErrorText, Page, TextField } from "../ui";
import { ProviderSteps } from "./Guide";

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

  return (
    <Page>
      <header className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4" })}>
        <h1 className={css({ fontSize: "xl", fontWeight: "semibold" })}>mail-mcp</h1>
        <div className={css({ display: "flex", alignItems: "center", gap: "3", fontSize: "sm", color: "muted", minW: 0 })}>
          <span className={css({ truncate: true })}>{me.email}</span>
          <Button variant="ghost" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      {accounts.length > 0 && (
        <Card>
          <h2 className={css({ fontWeight: "semibold", mb: "3" })}>Mailboxes</h2>
          <ul className={css({ display: "flex", flexDir: "column", divideY: "1px", divideColor: "border" })}>
            {accounts.map((a) => (
              <li key={a.id} className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "3", py: "2.5" })}>
                <div className={css({ minW: 0 })}>
                  <div className={css({ truncate: true })}>{a.email}</div>
                  <div className={css({ fontSize: "sm", color: "muted" })}>{providers[a.provider].name}</div>
                </div>
                <Button variant="danger" onClick={() => remove(a.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConnectForm onConnected={load} />

      {accounts.length > 0 && <McpUrl />}

      {clients.length > 0 && (
        <Card>
          <h2 className={css({ fontWeight: "semibold", mb: "3" })}>Connected apps</h2>
          <ul className={css({ display: "flex", flexDir: "column", divideY: "1px", divideColor: "border" })}>
            {clients.map((cl) => (
              <li key={cl.id} className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "3", py: "2.5" })}>
                <div className={css({ minW: 0 })}>
                  <div className={css({ truncate: true })}>{cl.clientName}</div>
                  <div className={css({ fontSize: "sm", color: "muted" })}>
                    {cl.level ? levelLabels[cl.level].title : "Unknown access"} ·{" "}
                    {cl.accountIds.map((id) => accounts.find((a) => a.id === id)?.email).filter(Boolean).join(", ") || "no mailboxes"}
                  </div>
                </div>
                <Button variant="danger" onClick={() => revoke(cl.id)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <a href="/privacy" className={css({ fontSize: "sm", color: "muted" })}>
        Privacy
      </a>
    </Page>
  );
}

interface Client {
  id: string;
  clientName: string;
  level?: AccessLevel;
  accountIds: string[];
  createdAt: number;
}

function McpUrl() {
  const url = `${location.origin}/mcp`;
  const [copied, setCopied] = useState(false);
  return (
    <Card>
      <h2 className={css({ fontWeight: "semibold", mb: "1" })}>Connect your AI app</h2>
      <p className={css({ fontSize: "sm", color: "muted", mb: "3" })}>
        Add this URL as a remote MCP server (in Claude: Settings → Connectors → Add custom connector). You'll choose which mailboxes it can use and what it may do.
      </p>
      <div className={css({ display: "flex", gap: "2" })}>
        <code className={css({ flex: 1, minW: 0, truncate: true, px: "3", py: "2", rounded: "md", bg: "bg", border: "1px solid", borderColor: "border", fontSize: "sm" })}>{url}</code>
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Card>
  );
}

const stack = css({ display: "flex", flexDir: "column", gap: "4" });
const muted = css({ fontSize: "sm", color: "muted" });
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
      <Card>
        <h2 className={css({ fontWeight: "semibold", mb: "1" })}>Connect a mailbox</h2>
        <p className={cx(muted, css({ mb: "4" }))}>
          iCloud, Gmail, Yahoo, AOL, Fastmail, Zoho, or any IMAP provider.{" "}
          <a href="/guide" className={css({ color: "accent" })}>
            Setup guides
          </a>
        </p>
        <form onSubmit={lookup} className={stack}>
          <TextField label="Email address" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={pending}>
            {pending ? "Looking up…" : "Continue"}
          </Button>
        </form>
      </Card>
    );
  }

  if (found.unsupported) {
    return (
      <Card className={stack}>
        <h2 className={css({ fontWeight: "semibold" })}>{found.unsupported.name}</h2>
        <p className={muted}>{found.unsupported.note}</p>
        <Button variant="ghost" onClick={back} className={css({ alignSelf: "flex-start", px: "0" })}>
          ← Use a different address
        </Button>
      </Card>
    );
  }

  const provider = providers[found.provider];
  const custom = found.provider === "custom";
  const servers = (
    <div className={css({ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "3" })}>
      <TextField label="IMAP server" required value={form.imapHost} onChange={set("imapHost")} placeholder="imap.example.com" />
      <TextField label="Port" value="993" readOnly description="TLS" />
      <TextField label="SMTP server" required value={form.smtpHost} onChange={set("smtpHost")} placeholder="smtp.example.com" />
      <TextField label="Port" required inputMode="numeric" value={form.smtpPort} onChange={set("smtpPort")} description="465 or 587" />
    </div>
  );

  return (
    <Card>
      <h2 className={css({ fontWeight: "semibold", mb: "4" })}>
        {provider.name}
        {found.customDomain && !custom && <span className={cx(muted, css({ fontWeight: "normal", ml: "2" }))}>custom domain</span>}
      </h2>
      <form onSubmit={connect} className={stack}>
        <ProviderSteps provider={provider} />
        <TextField label="Username" required autoComplete="username" value={form.username} onChange={set("username")} description={found.usernameHint} />
        <TextField label={custom ? "Password" : "App password"} type="password" required autoComplete="off" value={form.password} onChange={set("password")} />
        {custom && !found.imap ? (
          servers
        ) : (
          <details>
            <summary className={cx(muted, css({ cursor: "pointer" }))}>Server settings</summary>
            <div className={css({ mt: "3" })}>{servers}</div>
          </details>
        )}
        <ErrorText>{error}</ErrorText>
        <div className={css({ display: "flex", gap: "2" })}>
          <Button type="submit" disabled={pending}>
            {pending ? "Testing connection…" : "Connect"}
          </Button>
          <Button type="button" variant="ghost" onClick={back}>
            Back
          </Button>
        </div>
      </form>
    </Card>
  );
}
