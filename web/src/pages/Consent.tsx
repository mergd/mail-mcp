import { Banner, Button, Checkbox, Link, Loader, Radio, Text } from "@fldr/ui";
import { AppWindowIcon, EyeIcon, FolderOpenIcon, PaperPlaneTiltIcon, WarningIcon, type Icon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { css } from "../../styled-system/css";
import { levelLabels, type AccessLevel } from "../../../src/shared/access";
import { providers, type ProviderId } from "../../../src/shared/providers";
import { api } from "../api";
import { ErrorBanner, Heading, IconTile, Page, stack } from "../ui";

const levelIcons: Record<AccessLevel, Icon> = { read: EyeIcon, organize: FolderOpenIcon, full: PaperPlaneTiltIcon };

interface ConsentInfo {
  handle: string;
  clientName: string;
  clientDomain?: string;
  redirectHost: string;
  redirectIsLoopback: boolean;
  accounts: { id: string; email: string; provider: ProviderId }[];
  redirectTo?: string;
}

export function Consent() {
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [level, setLevel] = useState<AccessLevel>("read");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);

  useEffect(() => {
    api<ConsentInfo>(`/oauth/consent${location.search}`).then(
      (data) => {
        if (data.redirectTo) return location.assign(data.redirectTo);
        setInfo(data);
        setAccountIds(data.accounts.map((a) => a.id));
      },
      (err: Error) => setError(err.message),
    );
  }, []);

  async function decide(approve: boolean) {
    if (!info) return;
    setPending(approve ? "allow" : "deny");
    setError("");
    try {
      const { redirectTo } = await api<{ redirectTo: string }>("/oauth/decision", { body: { handle: info.handle, approve, level, accountIds } });
      location.assign(redirectTo);
    } catch (err) {
      setError((err as Error).message);
      setPending(null);
    }
  }

  if (!info)
    return (
      <Page>
        {error ? (
          <ErrorBanner>{error}</ErrorBanner>
        ) : (
          <div className={css({ display: "flex", justifyContent: "center" })}>
            <Loader />
          </div>
        )}
      </Page>
    );

  return (
    <Page>
      <Heading
        icon={<IconTile icon={AppWindowIcon} size={40} />}
        description={
          <>
            {info.clientDomain ? (
              <>
                Published by <Text as="strong" bold>{info.clientDomain}</Text>.{" "}
              </>
            ) : (
              "This app registered itself; its name isn't verified. "
            )}
            Access goes to <Text as="strong" bold>{info.redirectHost}</Text>.
          </>
        }
      >
        {info.clientName} wants access to your mail
      </Heading>

      {info.redirectIsLoopback && (
        <Banner
          variant="alert"
          icon={<WarningIcon />}
          description="This sends access to an app on your computer. Continue only if you just started connecting from it."
        />
      )}

      {info.accounts.length === 0 ? (
        <Text>
          You haven't connected a mailbox yet. <Link href="/">Connect one</Link>, then try again from your app.
        </Text>
      ) : (
        <div className={stack("6")}>
          <Checkbox.Group legend="Mailboxes" appearance="card" value={accountIds} onValueChange={setAccountIds}>
            {info.accounts.map((a) => (
              <Checkbox.Item key={a.id} value={a.id} label={a.email} description={providers[a.provider].name} />
            ))}
          </Checkbox.Group>

          <Radio.Group legend="Access level" appearance="card" value={level} onValueChange={(v) => setLevel(v as AccessLevel)}>
            {(Object.keys(levelLabels) as AccessLevel[]).map((l) => (
              <Radio.Item key={l} value={l} label={<LevelLabel level={l} />} description={levelLabels[l].detail} />
            ))}
          </Radio.Group>
        </div>
      )}

      <ErrorBanner>{error}</ErrorBanner>
      <div className={css({ display: "flex", justifyContent: "flex-end", gap: "2" })}>
        <Button variant="ghost" disabled={!!pending} loading={pending === "deny"} onClick={() => decide(false)}>
          Deny
        </Button>
        <Button variant="primary" disabled={!!pending || !accountIds.length} loading={pending === "allow"} onClick={() => decide(true)}>
          Allow
        </Button>
      </div>
    </Page>
  );
}

function LevelLabel({ level }: { level: AccessLevel }) {
  const I = levelIcons[level];
  return (
    <span className={css({ display: "inline-flex", alignItems: "center", gap: "1.5" })}>
      <I size={16} />
      {levelLabels[level].title}
    </span>
  );
}
