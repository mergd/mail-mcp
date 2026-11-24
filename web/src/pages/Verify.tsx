import { Link, Loader, Text } from "@fldr/ui";
import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { api, navigate } from "../api";
import { ErrorBanner, Page, stack } from "../ui";

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
      {error ? (
        <div className={stack("3")}>
          <ErrorBanner>{error}</ErrorBanner>
          <Link href="/login">Request a new link</Link>
        </div>
      ) : (
        <div className={css({ display: "flex", alignItems: "center", justifyContent: "center", gap: "2" })}>
          <Loader />
          <Text variant="secondary">Signing you in…</Text>
        </div>
      )}
    </Page>
  );
}
