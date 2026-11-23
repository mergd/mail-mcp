import { css } from "../../styled-system/css";
import { Card, Heading, Page } from "../ui";

const prose = css({ display: "flex", flexDir: "column", gap: "4", "& h2": { fontWeight: "semibold", mt: "2" }, "& a": { color: "accent" } });

export function Privacy() {
  return (
    <Page>
      <Heading>Privacy</Heading>
      <Card className={prose}>
        <p>mail-mcp connects your mailbox to the AI assistant you choose. It's open source, so you can check everything below in the code.</p>

        <h2>What we store</h2>
        <ul>
          <li>Your sign-in email address.</li>
          <li>For each mailbox you connect: its address, server settings, and app password. App passwords are encrypted (AES-256-GCM) before they're saved.</li>
          <li>Which assistants you've authorized and what access level you gave them.</li>
        </ul>

        <h2>What we don't store</h2>
        <p>
          We don't store or log your emails. Messages are fetched from your mail provider when your assistant asks for them and passed straight
          through. We don't use your mail for anything else, and we don't sell or share data.
        </p>

        <h2>Who sees your mail</h2>
        <p>
          Your mail provider, and the AI assistant you authorize. What that assistant does with your mail is covered by its own privacy policy.
        </p>

        <h2>Infrastructure</h2>
        <p>mail-mcp runs on Cloudflare Workers, with data in Cloudflare D1. Sign-in emails are sent with Cloudflare Email.</p>

        <h2>Removing your data</h2>
        <p>
          Removing a mailbox deletes its stored credentials immediately. You can also revoke the app password with your provider at any time,
          which cuts off access straight away.
        </p>
      </Card>
      <a href="/" className={css({ fontSize: "sm", color: "muted" })}>
        Back
      </a>
    </Page>
  );
}
