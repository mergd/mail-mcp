export interface Env {
  DB: D1Database;
  EMAIL: SendEmail;
  AUTH_LIMIT: RateLimit;
  ASSETS: Fetcher;
  MASTER_KEY: string;
}

export type AppEnv = { Bindings: Env; Variables: { userId: string } };
