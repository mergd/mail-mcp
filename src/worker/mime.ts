import { utf8ToB64 as b64 } from "./b64";
const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);

const noNewlines = (s: string) => {
  if (/[\r\n]/.test(s)) throw new Error("Header values can't contain line breaks");
  return s;
};

const encodeWord = (s: string) => (isAscii(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

// "Name <a@b.c>" → keeps the address, encodes a non-ASCII display name.
function encodeAddress(addr: string) {
  const m = noNewlines(addr.trim()).match(/^(.*)<([^>]+)>$/);
  if (!m) return addr.trim();
  const name = m[1]!.trim().replace(/^"|"$/g, "");
  return name ? `${isAscii(name) ? `"${name.replace(/"/g, "")}"` : encodeWord(name)} <${m[2]}>` : `<${m[2]}>`;
}

export const bareAddress = (addr: string) => (addr.match(/<([^>]+)>/)?.[1] ?? addr).trim();

export interface Compose {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string;
  includeBcc?: boolean;
}

export function buildMessage(m: Compose): { raw: string; messageId: string } {
  const domain = bareAddress(m.from).split("@")[1] ?? "mailmcp.fldr.zip";
  const messageId = `<${crypto.randomUUID()}@${domain}>`;
  const list = (xs?: string[]) => (xs ?? []).map(encodeAddress).join(", ");
  const headers: [string, string | undefined][] = [
    ["From", encodeAddress(m.from)],
    ["To", m.to.length ? list(m.to) : undefined],
    ["Cc", m.cc?.length ? list(m.cc) : undefined],
    ["Bcc", m.includeBcc && m.bcc?.length ? list(m.bcc) : undefined],
    ["Subject", encodeWord(noNewlines(m.subject))],
    ["Date", new Date().toUTCString().replace("GMT", "+0000")],
    ["Message-ID", messageId],
    ["In-Reply-To", m.inReplyTo && noNewlines(m.inReplyTo)],
    ["References", m.references && noNewlines(m.references)],
    ["MIME-Version", "1.0"],
    ["Content-Type", "text/plain; charset=utf-8"],
    ["Content-Transfer-Encoding", "base64"],
  ];
  const head = headers.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\r\n");
  const body = b64(m.text.replace(/\r?\n/g, "\r\n")).replace(/.{76}/g, "$&\r\n");
  return { raw: `${head}\r\n\r\n${body}\r\n`, messageId };
}
