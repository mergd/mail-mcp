import { useEffect, useRef, useState } from "react";
import { api, navigate } from "../api";
import { Card, ErrorText, Page } from "../ui";

export function Verify() {
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = location.hash.slice(1);
    history.replaceState(null, "", "/auth/verify");
    api("/auth/verify", { body: { token } }).then(
      () => navigate("/"),
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
