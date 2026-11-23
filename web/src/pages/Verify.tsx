import { useEffect, useRef, useState } from "react";
import { api, navigate } from "../api";
import { Card, ErrorText, Page } from "../ui";

export function Verify() {
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(location.hash.slice(1));
    const next = params.get("next") ?? "/";
    history.replaceState(null, "", "/auth/verify");
    api("/auth/verify", { body: { token: params.get("token") } }).then(
      // /authorize is served by the worker, so it needs a full page load.
      () => (next.startsWith("/authorize") ? location.assign(next) : navigate(next.startsWith("/") && !next.startsWith("//") ? next : "/")),
      (err: Error) => setError(err.message),
    );
  }, []);

  return (
    <Page>
      <Card>
        {error ? (
          <>
            <ErrorText>{error}</ErrorText>
            <a href="/login">Request a new link</a>
          </>
        ) : (
          <p>Signing you in…</p>
        )}
      </Card>
    </Page>
  );
}
