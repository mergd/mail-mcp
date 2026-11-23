export type AccessLevel = "read" | "organize" | "full";

export const levelScopes: Record<AccessLevel, string[]> = {
  read: ["mail.read"],
  organize: ["mail.read", "mail.write"],
  full: ["mail.read", "mail.write", "mail.send"],
};

export const levelLabels: Record<AccessLevel, { title: string; detail: string }> = {
  read: { title: "Read only", detail: "Search and read messages" },
  organize: { title: "Read & organize", detail: "Also move, archive, flag, delete and draft. Cannot send email." },
  full: { title: "Full access", detail: "Everything, including sending email" },
};

export interface GrantProps {
  userId: string;
  accountIds: string[];
  level: AccessLevel;
}
