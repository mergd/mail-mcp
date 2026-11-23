import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useEffect, useState, type FormEvent } from "react";
import { css } from "../../styled-system/css";
import { providers, type MailAccount, type ProviderId } from "../../../src/shared/providers";
import { api, ApiError, navigate } from "../api";
import { Button, Card, ErrorText, Page, TextField } from "../ui";

export function Home() {
  const [me, setMe] = useState<{ email: string } | null>(null);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);

  const load = () => api<MailAccount[]>("/accounts").then(setAccounts);

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

      <a href="/privacy" className={css({ fontSize: "sm", color: "muted" })}>
        Privacy
      </a>
    </Page>
  );
}

const radioCard = css({
  px: "3",
  py: "2",
  rounded: "md",
  border: "1px solid",
  borderColor: "border",
  fontSize: "sm",
  cursor: "pointer",
  textAlign: "left",
  _checked: { borderColor: "accent", outline: "1px solid", outlineColor: "accent" },
});

function ConnectForm({ onConnected }: { onConnected: () => void }) {
  const [provider, setProvider] = useState<ProviderId>("yahoo");
  const [form, setForm] = useState({ email: "", password: "", imapHost: "", imapPort: "993", smtpHost: "", smtpPort: "465" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const preset = providers[provider];
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/accounts", { body: { provider, ...form, imapPort: Number(form.imapPort), smtpPort: Number(form.smtpPort) } });
      setForm({ ...form, email: "", password: "" });
      onConnected();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <h2 className={css({ fontWeight: "semibold", mb: "4" })}>Connect a mailbox</h2>
      <form onSubmit={submit} className={css({ display: "flex", flexDir: "column", gap: "4" })}>
        <RadioGroup
          value={provider}
          onValueChange={(v) => setProvider(v as ProviderId)}
          aria-label="Provider"
          className={css({ display: "grid", gridTemplateColumns: { base: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: "2" })}
        >
          {Object.values(providers).map((p) => (
            <Radio.Root key={p.id} value={p.id} className={radioCard}>
              {p.name}
            </Radio.Root>
          ))}
        </RadioGroup>

        <TextField label="Email address" type="email" required value={form.email} onChange={set("email")} />
        <TextField
          label="App password"
          type="password"
          required
          autoComplete="off"
          value={form.password}
          onChange={set("password")}
          description={
            preset.appPasswordUrl ? (
              <>
                Not your normal password. Create one at{" "}
                <a href={preset.appPasswordUrl} target="_blank" rel="noreferrer" className={css({ color: "accent" })}>
                  {new URL(preset.appPasswordUrl).hostname}
                </a>
                : {preset.appPasswordHelp}
              </>
            ) : (
              "Use an app password if your provider supports them."
            )
          }
        />

        {provider === "custom" && (
          <div className={css({ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "3" })}>
            <TextField label="IMAP server" required value={form.imapHost} onChange={set("imapHost")} placeholder="imap.example.com" />
            <TextField label="Port" required inputMode="numeric" value={form.imapPort} onChange={set("imapPort")} />
            <TextField label="SMTP server" required value={form.smtpHost} onChange={set("smtpHost")} placeholder="smtp.example.com" />
            <TextField label="Port" required inputMode="numeric" value={form.smtpPort} onChange={set("smtpPort")} />
          </div>
        )}

        <ErrorText>{error}</ErrorText>
        <Button type="submit" disabled={pending}>
          {pending ? "Testing connection…" : "Connect"}
        </Button>
      </form>
    </Card>
  );
}
