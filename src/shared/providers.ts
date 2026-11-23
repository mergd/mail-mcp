export type ProviderId = "yahoo" | "icloud" | "aol" | "fastmail" | "custom";

export interface Provider {
  id: ProviderId;
  name: string;
  imap: { host: string; port: number };
  smtp: { host: string; port: number };
  appPasswordUrl?: string;
  appPasswordHelp?: string;
}

export const providers: Record<ProviderId, Provider> = {
  yahoo: {
    id: "yahoo",
    name: "Yahoo Mail",
    imap: { host: "imap.mail.yahoo.com", port: 993 },
    smtp: { host: "smtp.mail.yahoo.com", port: 465 },
    appPasswordUrl: "https://login.yahoo.com/account/security",
    appPasswordHelp: "Account security → Generate app password.",
  },
  icloud: {
    id: "icloud",
    name: "iCloud Mail",
    imap: { host: "imap.mail.me.com", port: 993 },
    smtp: { host: "smtp.mail.me.com", port: 587 },
    appPasswordUrl: "https://account.apple.com/account/manage",
    appPasswordHelp: "Sign-In and Security → App-Specific Passwords.",
  },
  aol: {
    id: "aol",
    name: "AOL Mail",
    imap: { host: "imap.aol.com", port: 993 },
    smtp: { host: "smtp.aol.com", port: 465 },
    appPasswordUrl: "https://login.aol.com/account/security",
    appPasswordHelp: "Account security → Generate app password.",
  },
  fastmail: {
    id: "fastmail",
    name: "Fastmail",
    imap: { host: "imap.fastmail.com", port: 993 },
    smtp: { host: "smtp.fastmail.com", port: 465 },
    appPasswordUrl: "https://app.fastmail.com/settings/security/apps",
    appPasswordHelp: "Settings → Privacy & Security → App passwords (IMAP + SMTP access).",
  },
  custom: {
    id: "custom",
    name: "Other (IMAP)",
    imap: { host: "", port: 993 },
    smtp: { host: "", port: 465 },
  },
};

export interface MailAccount {
  id: string;
  email: string;
  provider: ProviderId;
  imapHost: string;
  createdAt: number;
}
