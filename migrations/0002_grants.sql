-- Mirror of OAuth grants. KV list() lags ~30s+, so this is the source of truth
-- for listing grants and for revocation checks on every MCP request.
CREATE TABLE grants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  redirect_host TEXT NOT NULL,
  level TEXT NOT NULL,
  account_ids TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX grants_user ON grants(user_id);
