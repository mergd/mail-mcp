import { css } from "../../styled-system/css";
import { providers, unsupported, type Provider } from "../../../src/shared/providers";
import { Card, Heading, Page } from "../ui";

const muted = css({ fontSize: "sm", color: "muted" });

/** How to get an app password for one provider. */
export function ProviderSteps({ provider }: { provider: Provider }) {
  return (
    <div className={css({ display: "flex", flexDir: "column", gap: "3", alignItems: "flex-start" })}>
      <ol className={css({ listStyle: "decimal", pl: "5", display: "flex", flexDir: "column", gap: "1.5" })}>
        {provider.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {provider.appPasswordUrl && (
        <a
          href={provider.appPasswordUrl}
          target="_blank"
          rel="noreferrer"
          className={css({ fontSize: "sm", fontWeight: "medium", color: "accent", _hover: { textDecoration: "underline" } })}
        >
          Open {new URL(provider.appPasswordUrl).hostname} ↗
        </a>
      )}
      {provider.note && <p className={muted}>{provider.note}</p>}
    </div>
  );
}

export function Guide() {
  const list = Object.values(providers).filter((p) => p.id !== "custom");
  return (
    <Page>
      <div>
        <Heading>Setup guides</Heading>
        <p className={muted}>
          How to create an app password for each provider. <a href="/" className={css({ color: "accent" })}>Connect a mailbox →</a>
        </p>
      </div>
      {list.map((p) => (
        <Card key={p.id}>
          <h2 className={css({ fontWeight: "semibold", mb: "3" })}>{p.name}</h2>
          <ProviderSteps provider={p} />
          <p className={css({ fontSize: "xs", color: "muted", mt: "3" })}>
            IMAP {p.imap.host}:{p.imap.port} · SMTP {p.smtp.host}:{p.smtp.port}
          </p>
        </Card>
      ))}
      {unsupported.map((u) => (
        <Card key={u.name}>
          <h2 className={css({ fontWeight: "semibold", mb: "2" })}>{u.name}</h2>
          <p className={muted}>{u.note}</p>
        </Card>
      ))}
      <Card>
        <h2 className={css({ fontWeight: "semibold", mb: "3" })}>Other providers</h2>
        <ProviderSteps provider={providers.custom} />
        <p className={css({ fontSize: "xs", color: "muted", mt: "3" })}>
          We look up server settings from your domain's MX records and Mozilla's autoconfig database.
        </p>
      </Card>
    </Page>
  );
}
