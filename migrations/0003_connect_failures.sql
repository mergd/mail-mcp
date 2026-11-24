-- Failed mailbox logins per address, so repeated bad passwords can't get the user's account locked by their provider.
CREATE TABLE connect_failures (
  email TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
