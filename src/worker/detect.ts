import { providers, unsupported, type Detected, type ProviderId, type Server } from "../shared/providers";

/** MX hosts that identify a provider for custom domains. */
const MX: [ProviderId | (typeof unsupported)[number]["name"], RegExp][] = [
  ["icloud", /\.icloud\.com$/],
  ["gmail", /(^|\.)(google|googlemail)\.com$/],
  ["yahoo", /\.yahoodns\.net$/],
  ["fastmail", /\.messagingengine\.com$/],
  ["zoho", /\.zoho(mail)?\.com$/],
  ["Outlook / Microsoft 365", /\.outlook\.com$/],
  ["Proton Mail", /\.protonmail\.ch$/],
];

export async function detect(email: string): Promise<Detected> {
  const domain = email.split("@")[1]?.trim().toLowerCase() ?? "";

  const known = Object.values(providers).find((p) => p.domains.includes(domain));
  if (known) return { provider: known.id, customDomain: false, imap: known.imap, smtp: known.smtp };
  const blocked = unsupported.find((u) => u.domains.includes(domain));
  if (blocked) return { provider: "custom", customDomain: false, unsupported: blocked };

  const mx = await mxHosts(domain);
  const match = MX.find(([, re]) => mx.some((h) => re.test(h)))?.[0];
  const viaMx = match && match in providers ? providers[match as ProviderId] : undefined;
  if (viaMx) {
    const o = viaMx.customDomain;
    return { provider: viaMx.id, customDomain: true, imap: o?.imap ?? viaMx.imap, smtp: o?.smtp ?? viaMx.smtp, usernameHint: o?.usernameHint };
  }
  const blockedMx = unsupported.find((u) => u.name === match);
  if (blockedMx) return { provider: "custom", customDomain: true, unsupported: blockedMx };

  const auto = (await ispdb(domain)) ?? (mx[0] ? await ispdb(mx[0].split(".").slice(-2).join(".")) : undefined);
  return { provider: "custom", customDomain: true, ...auto };
}

async function mxHosts(domain: string): Promise<string[]> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, {
      headers: { accept: "application/dns-json" },
    });
    const json = await res.json<{ Answer?: { type: number; data: string }[] }>();
    return (json.Answer ?? []).filter((a) => a.type === 15).map((a) => a.data.split(" ").pop()!.replace(/\.$/, "").toLowerCase());
  } catch {
    return [];
  }
}

/** Mozilla's autoconfig database, which Thunderbird uses. */
async function ispdb(domain: string): Promise<{ imap?: Server; smtp?: Server } | undefined> {
  try {
    const res = await fetch(`https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`);
    if (!res.ok) return undefined;
    const xml = await res.text();
    const pick = (tag: "incomingServer" | "outgoingServer", type: string, ports: number[]): Server | undefined =>
      [...xml.matchAll(new RegExp(`<${tag} type="${type}">([\\s\\S]*?)</${tag}>`, "g"))]
        .map((m) => ({
          host: m[1].match(/<hostname>([^<]+)</)?.[1]?.replace("%EMAILDOMAIN%", domain) ?? "",
          port: Number(m[1].match(/<port>(\d+)</)?.[1]),
        }))
        .find((s) => s.host && ports.includes(s.port));
    const imap = pick("incomingServer", "imap", [993]);
    return imap && { imap, smtp: pick("outgoingServer", "smtp", [465, 587]) };
  } catch {
    return undefined;
  }
}
