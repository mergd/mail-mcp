import { Link, Text } from "@fldr/ui";
import { css } from "../../styled-system/css";
import { providers, unsupported, type Provider } from "../../../src/shared/providers";
import { ProviderIcon, providerIconId } from "../ProviderIcon";
import { Heading, Page, Section, stack } from "../ui";

/** How to get an app password for one provider. */
export function ProviderSteps({ provider }: { provider: Provider }) {
  return (
    <div className={stack("3")}>
      <ol className={css({ listStyle: "decimal", pl: "5", display: "flex", flexDir: "column", gap: "1" })}>
        {provider.steps.map((s) => (
          <Text as="li" key={s}>
            {s}
          </Text>
        ))}
      </ol>
      {provider.appPasswordUrl && (
        <Link href={provider.appPasswordUrl} target="_blank" rel="noreferrer">
          Open {new URL(provider.appPasswordUrl).hostname}
          <Link.ExternalIcon />
        </Link>
      )}
      {provider.note && (
        <Text variant="secondary" size="sm">
          {provider.note}
        </Text>
      )}
    </div>
  );
}

const Servers = ({ p }: { p: Provider }) => (
  <Text variant="mono-secondary">
    IMAP {p.imap.host}:{p.imap.port} · SMTP {p.smtp.host}:{p.smtp.port}
  </Text>
);

export function Guide() {
  const list = Object.values(providers).filter((p) => p.id !== "custom");
  return (
    <Page>
      <Heading
        description={
          <>
            How to create an app password for each provider. <Link href="/">Connect a mailbox</Link>
          </>
        }
      >
        Setup guides
      </Heading>
      {list.map((p) => (
        <Section key={p.id} title={p.name} icon={<ProviderIcon id={p.id} size={20} />}>
          <div className={stack("3")}>
            <ProviderSteps provider={p} />
            <Servers p={p} />
          </div>
        </Section>
      ))}
      {unsupported.map((u) => (
        <Section key={u.name} title={u.name} icon={<ProviderIcon id={providerIconId(u.name)} size={20} />}>
          <Text variant="secondary">{u.note}</Text>
        </Section>
      ))}
      <Section title="Other providers" icon={<ProviderIcon id="custom" size={20} />}>
        <div className={stack("3")}>
          <ProviderSteps provider={providers.custom} />
          <Text variant="secondary" size="sm">
            We look up server settings from your domain's MX records and Mozilla's autoconfig database.
          </Text>
        </div>
      </Section>
    </Page>
  );
}
