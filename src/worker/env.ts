import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  DB: D1Database;
  EMAIL: SendEmail;
  AUTH_LIMIT: RateLimit;
  MCP_LIMIT: RateLimit;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  ASSETS: Fetcher;
  MASTER_KEY: string;
}

export type AppEnv = { Bindings: Env; Variables: { userId: string } };
