export type ProviderId = "icloud" | "gmail" | "yahoo" | "aol" | "fastmail" | "zoho" | "custom";

export interface Server {
  host: string;
  port: number;
}

export interface Provider {
  id: ProviderId;
  name: string;
  imap: Server;
  smtp: Server;
  /** The provider doesn't file SMTP-sent mail itself, so we append a copy to Sent. */
  appendSent: boolean;
  /** Address domains that belong to this provider. Custom domains are matched by MX records instead. */
  domains: string[];
  /** Settings to use when the address is on the user's own domain. */
  customDomain?: { imap?: Server; smtp?: Server; usernameHint?: string };
  appPasswordUrl?: string;
  /** How to get an app password, one step per item. */
  steps: string[];
  note?: string;
}

export const providers: Record<ProviderId, Provider> = {
  icloud: {
    id: "icloud",
    name: "iCloud Mail",
    imap: { host: "imap.mail.me.com", port: 993 },
    smtp: { host: "smtp.mail.me.com", port: 587 },
    appendSent: true,
    domains: ["icloud.com", "me.com", "mac.com"],
    customDomain: { usernameHint: "For custom domains, sign in with your @icloud.com address, not the custom one." },
    appPasswordUrl: "https://account.apple.com/account/manage",
    steps: [
      "Make sure two-factor authentication is on for your Apple Account. App passwords require it.",
      "Go to account.apple.com → Sign-In and Security → App-Specific Passwords.",
      "Click +, name it “mail-mcp”, and confirm with your Apple Account password.",
      "Copy the password (it looks like xxxx-xxxx-xxxx-xxxx). Apple only shows it once.",
    ],
    note: "Your normal Apple Account password won't work.",
  },
  gmail: {
    id: "gmail",
    name: "Gmail",
    imap: { host: "imap.gmail.com", port: 993 },
    smtp: { host: "smtp.gmail.com", port: 465 },
    appendSent: false,
    domains: ["gmail.com", "googlemail.com"],
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    steps: [
      "Turn on 2-Step Verification for your Google Account.",
      "Open myaccount.google.com/apppasswords.",
      "Enter the name “mail-mcp” and click Create.",
      "Copy the 16-character password.",
    ],
    note: "Workspace admins can turn app passwords off. If your assistant already has a Google connector, you may prefer that.",
  },
  yahoo: {
    id: "yahoo",
    name: "Yahoo Mail",
    imap: { host: "imap.mail.yahoo.com", port: 993 },
    smtp: { host: "smtp.mail.yahoo.com", port: 465 },
    appendSent: false,
    domains: ["yahoo.com", "ymail.com", "rocketmail.com", "yahoo.co.uk", "yahoo.ca", "yahoo.com.au", "yahoo.fr", "yahoo.de"],
    appPasswordUrl: "https://login.yahoo.com/account/security",
    steps: [
      "Go to Yahoo Account Info → Account Security.",
      "Click “Generate app password” (or “Manage app passwords”).",
      "Name it “mail-mcp”, click Generate, and copy the password.",
    ],
  },
  aol: {
    id: "aol",
    name: "AOL Mail",
    imap: { host: "imap.aol.com", port: 993 },
    smtp: { host: "smtp.aol.com", port: 465 },
    appendSent: false,
    domains: ["aol.com", "aim.com"],
    appPasswordUrl: "https://login.aol.com/account/security",
    steps: [
      "Go to AOL Account Info → Account Security.",
      "Click “Generate app password”, choose “Other app”, and name it “mail-mcp”.",
      "Copy the password.",
    ],
  },
  fastmail: {
    id: "fastmail",
    name: "Fastmail",
    imap: { host: "imap.fastmail.com", port: 993 },
    smtp: { host: "smtp.fastmail.com", port: 465 },
    appendSent: false,
    domains: ["fastmail.com", "fastmail.fm", "fastmail.net", "fastmail.org"],
    appPasswordUrl: "https://app.fastmail.com/settings/security/apps",
    steps: [
      "Open Settings → Privacy & Security → App passwords.",
      "Click “New app password” and give it IMAP and SMTP access.",
      "Name it “mail-mcp” and copy the password.",
    ],
  },
  zoho: {
    id: "zoho",
    name: "Zoho Mail",
    imap: { host: "imap.zoho.com", port: 993 },
    smtp: { host: "smtp.zoho.com", port: 465 },
    appendSent: true,
    domains: ["zoho.com", "zohomail.com"],
    customDomain: { imap: { host: "imappro.zoho.com", port: 993 }, smtp: { host: "smtppro.zoho.com", port: 465 } },
    appPasswordUrl: "https://accounts.zoho.com/home#security/app_password",
    steps: [
      "In Zoho Mail, open Settings → Mail Accounts → IMAP and turn IMAP access on.",
      "Go to accounts.zoho.com → Security → App Passwords → Generate New Password.",
      "Name it “mail-mcp” and copy the password.",
    ],
    note: "Accounts in Zoho's EU data center use imap.zoho.eu and smtp.zoho.eu (under Server settings).",
  },
  custom: {
    id: "custom",
    name: "Other (IMAP)",
    imap: { host: "", port: 993 },
    smtp: { host: "", port: 465 },
    appendSent: true,
    domains: [],
    steps: [
      "Look up your provider's “IMAP settings” and “app password” help pages.",
      "If your account uses two-step sign-in, create an app password. Otherwise use your normal password.",
      "Check the server settings below. We filled in what we could find.",
    ],
  },
};

/** Providers that can't be connected with a password, with what to tell the user. */
export const unsupported = [
  {
    name: "Outlook / Microsoft 365",
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com", "passport.com"],
    note: "Microsoft has turned off password sign-in for IMAP. Use your assistant's built-in Outlook / Microsoft 365 connector instead.",
  },
  {
    name: "Proton Mail",
    domains: ["proton.me", "protonmail.com", "protonmail.ch", "pm.me"],
    note: "Proton only allows IMAP through Proton Mail Bridge on your own computer, so a hosted service can't connect.",
  },
];

/** Result of looking up an email address's provider. */
export interface Detected {
  provider: ProviderId;
  /** Set when the provider can't be connected here. */
  unsupported?: { name: string; note: string };
  customDomain: boolean;
  imap?: Server;
  smtp?: Server;
  usernameHint?: string;
}

export interface MailAccount {
  id: string;
  email: string;
  provider: ProviderId;
  imapHost: string;
  createdAt: number;
}
