import { utf8ToB64 as b64 } from "./b64";
import { connect } from "cloudflare:sockets";

const enc = new TextEncoder();

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}


type Sock = ReturnType<typeof connect>;

class SmtpConnection {
  private reader!: ReadableStreamDefaultReader<Uint8Array>;
  private writer!: WritableStreamDefaultWriter<Uint8Array>;
  private buf = "";
  private dec = new TextDecoder();

  constructor(private sock: Sock) {
    this.attach(sock);
  }

  private attach(sock: Sock) {
    this.sock = sock;
    this.reader = sock.readable.getReader();
    this.writer = sock.writable.getWriter();
  }

  upgradeTls() {
    this.reader.releaseLock();
    this.writer.releaseLock();
    this.buf = "";
    this.attach(this.sock.startTls());
  }

  async read(): Promise<{ code: number; text: string }> {
    const lines: string[] = [];
    for (;;) {
      let i: number;
      while ((i = this.buf.indexOf("\r\n")) < 0) {
        const { value, done } = await this.reader.read();
        if (done) throw new Error("SMTP server closed the connection");
        this.buf += this.dec.decode(value, { stream: true });
      }
      const line = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 2);
      lines.push(line.slice(4));
      if (line[3] !== "-") return { code: Number(line.slice(0, 3)), text: lines.join("\n") };
    }
  }

  async cmd(line: string, expect: number[], redacted = line) {
    await this.writer.write(enc.encode(`${line}\r\n`));
    const res = await this.read();
    if (!expect.includes(res.code)) {
      const err = new Error(`SMTP ${redacted.split(" ")[0]} failed: ${res.code} ${res.text}`) as Error & { code: number };
      err.code = res.code;
      throw err;
    }
    return res;
  }

  close() {
    return this.sock.close().catch(() => {});
  }
}

export async function sendSmtp(cfg: SmtpConfig, envelope: { from: string; to: string[] }, raw: string) {
  const implicitTls = cfg.port === 465;
  const conn = new SmtpConnection(connect({ hostname: cfg.host, port: cfg.port }, { secureTransport: implicitTls ? "on" : "starttls", allowHalfOpen: false }));
  try {
    if ((await conn.read()).code !== 220) throw new Error("SMTP server did not greet");
    let ehlo = await conn.cmd("EHLO mailmcp.fldr.zip", [250]);
    if (!implicitTls) {
      await conn.cmd("STARTTLS", [220]);
      conn.upgradeTls();
      ehlo = await conn.cmd("EHLO mailmcp.fldr.zip", [250]);
    }

    try {
      if (/AUTH[ =][^\n]*PLAIN/i.test(ehlo.text)) {
        await conn.cmd(`AUTH PLAIN ${b64(`\0${cfg.username}\0${cfg.password}`)}`, [235], "AUTH");
      } else {
        await conn.cmd("AUTH LOGIN", [334]);
        await conn.cmd(b64(cfg.username), [334], "AUTH");
        await conn.cmd(b64(cfg.password), [235], "AUTH");
      }
    } catch (e) {
      throw Object.assign(new Error("SMTP login failed. The app password may have been revoked."), { cause: e, authenticationFailed: true });
    }

    await conn.cmd(`MAIL FROM:<${envelope.from}>`, [250]);
    for (const rcpt of envelope.to) await conn.cmd(`RCPT TO:<${rcpt}>`, [250, 251]);
    await conn.cmd("DATA", [354]);
    const body = raw.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    await conn.cmd(`${body}\r\n.`, [250], "DATA");
    await conn.cmd("QUIT", [221]).catch(() => {});
  } finally {
    await conn.close();
  }
}
