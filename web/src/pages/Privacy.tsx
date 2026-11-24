import { Link, Text } from "@fldr/ui";
import type { ReactNode } from "react";
import { css } from "../../styled-system/css";
import { Heading, Page, stack } from "../ui";

const Part = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={stack("1")}>
    <Text variant="heading" as="h2">
      {title}
    </Text>
    {children}
  </section>
);

export function Privacy() {
  return (
    <Page>
      <Heading description="mail-mcp connects your mailbox to the AI assistant you choose. It's open source, so you can check everything below in the code.">
        Privacy
      </Heading>
      <div className={stack("6")}>
        <Part title="What we store">
          <ul className={css({ listStyle: "disc", pl: "5", display: "flex", flexDir: "column", gap: "1" })}>
            <Text as="li">Your sign-in email address.</Text>
            <Text as="li">
              For each mailbox you connect: its address, server settings, and app password. App passwords are encrypted (AES-256-GCM) before
              they're saved.
            </Text>
            <Text as="li">Which assistants you've authorized and what access level you gave them.</Text>
          </ul>
        </Part>
        <Part title="What we don't store">
          <Text>
            We don't store or log your emails. Messages are fetched from your mail provider when your assistant asks for them and passed straight
            through. We don't use your mail for anything else, and we don't sell or share data.
          </Text>
        </Part>
        <Part title="Who sees your mail">
          <Text>Your mail provider, and the AI assistant you authorize. What that assistant does with your mail is covered by its own privacy policy.</Text>
        </Part>
        <Part title="Infrastructure">
          <Text>mail-mcp runs on Cloudflare Workers, with data in Cloudflare D1. Sign-in emails are sent with Cloudflare Email.</Text>
        </Part>
        <Part title="Removing your data">
          <Text>
            Removing a mailbox deletes its stored credentials immediately. You can also revoke the app password with your provider at any time,
            which cuts off access straight away.
          </Text>
        </Part>
      </div>
      <Link href="/">Back</Link>
    </Page>
  );
}
