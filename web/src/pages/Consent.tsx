import { Checkbox } from "@base-ui/react/checkbox";
import { CheckboxGroup } from "@base-ui/react/checkbox-group";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useEffect, useState } from "react";
import { css } from "../../styled-system/css";
import { levelLabels, type AccessLevel } from "../../../src/shared/access";
import { providers, type ProviderId } from "../../../src/shared/providers";
import { api } from "../api";
import { Button, Card, ErrorText, Page } from "../ui";

interface ConsentInfo {
  handle: string;
  clientName: string;
  clientDomain?: string;
  redirectHost: string;
  redirectIsLoopback: boolean;
  accounts: { id: string; email: string; provider: ProviderId }[];
  redirectTo?: string;
}

const option = css({
  display: "flex",
  gap: "3",
  alignItems: "flex-start",
  p: "3",
  rounded: "md",
  border: "1px solid",
  borderColor: "border",
  cursor: "pointer",
  textAlign: "left",
  w: "full",
  _checked: { borderColor: "accent", outline: "1px solid", outlineColor: "accent" },
});

const indicator = css({
  flexShrink: 0,
  mt: "0.5",
  w: "4",
  h: "4",
  border: "1.5px solid",
  borderColor: "muted",
  display: "grid",
  placeItems: "center",
  "[data-checked] > &": { borderColor: "accent", bg: "accent" },
});

const sectionTitle = css({ fontSize: "sm", fontWeight: "semibold", color: "muted", mb: "2" });

export function Consent() {
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [level, setLevel] = useState<AccessLevel>("read");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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
    setPending(true);
    setError("");
    try {
      const { redirectTo } = await api<{ redirectTo: string }>("/oauth/decision", { body: { handle: info.handle, approve, level, accountIds } });
      location.assign(redirectTo);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  if (!info) return <Page>{error ? <Card><ErrorText>{error}</ErrorText></Card> : null}</Page>;

  return (
    <Page>
      <Card className={css({ display: "flex", flexDir: "column", gap: "5" })}>
        <div className={css({ display: "flex", flexDir: "column", gap: "1" })}>
          <h1 className={css({ fontSize: "xl", fontWeight: "semibold" })}>{info.clientName} wants access to your mail</h1>
          <p className={css({ fontSize: "sm", color: "muted" })}>
            {info.clientDomain ? (
              <>
                Published by <strong>{info.clientDomain}</strong>.{" "}
              </>
            ) : (
              "This app registered itself; its name isn't verified. "
            )}
            Access goes to <strong>{info.redirectHost}</strong>.
          </p>
          {info.redirectIsLoopback && (
            <p className={css({ fontSize: "sm", color: "danger" })}>This sends access to an app on your computer. Continue only if you just started connecting from it.</p>
          )}
        </div>

        {info.accounts.length === 0 ? (
          <p>
            You haven't connected a mailbox yet. <a href="/" className={css({ color: "accent" })}>Connect one</a>, then try again from your app.
          </p>
        ) : (
          <>
            <div>
              <div className={sectionTitle} id="mailboxes-label">
                Mailboxes
              </div>
              <CheckboxGroup value={accountIds} onValueChange={setAccountIds} aria-labelledby="mailboxes-label" className={css({ display: "flex", flexDir: "column", gap: "2" })}>
                {info.accounts.map((a) => (
                  <Checkbox.Root key={a.id} value={a.id} className={option}>
                    <span className={`${indicator} ${css({ rounded: "sm" })}`}>
                      <Checkbox.Indicator className={css({ w: "2", h: "2", bg: "accentFg", rounded: "1px" })} />
                    </span>
                    <span className={css({ minW: 0 })}>
                      <span className={css({ display: "block", truncate: true })}>{a.email}</span>
                      <span className={css({ fontSize: "sm", color: "muted" })}>{providers[a.provider].name}</span>
                    </span>
                  </Checkbox.Root>
                ))}
              </CheckboxGroup>
            </div>

            <div>
              <div className={sectionTitle} id="level-label">
                Access level
              </div>
              <RadioGroup value={level} onValueChange={(v) => setLevel(v as AccessLevel)} aria-labelledby="level-label" className={css({ display: "flex", flexDir: "column", gap: "2" })}>
                {(Object.keys(levelLabels) as AccessLevel[]).map((l) => (
                  <Radio.Root key={l} value={l} className={option}>
                    <span className={`${indicator} ${css({ rounded: "full" })}`}>
                      <Radio.Indicator className={css({ w: "1.5", h: "1.5", bg: "accentFg", rounded: "full" })} />
                    </span>
                    <span>
                      <span className={css({ display: "block", fontWeight: "medium" })}>{levelLabels[l].title}</span>
                      <span className={css({ fontSize: "sm", color: "muted" })}>{levelLabels[l].detail}</span>
                    </span>
                  </Radio.Root>
                ))}
              </RadioGroup>
            </div>
          </>
        )}

        <ErrorText>{error}</ErrorText>
        <div className={css({ display: "flex", justifyContent: "flex-end", gap: "2" })}>
          <Button variant="ghost" disabled={pending} onClick={() => decide(false)}>
            Deny
          </Button>
          <Button disabled={pending || !accountIds.length} onClick={() => decide(true)}>
            Allow
          </Button>
        </div>
      </Card>
    </Page>
  );
}
