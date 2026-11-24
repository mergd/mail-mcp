import { Banner, LayerCard, Text } from "@fldr/ui";
import { WarningCircleIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { css } from "../styled-system/css";

export const stack = (gap: "1" | "2" | "3" | "4" | "6" = "4") => css({ display: "flex", flexDir: "column", gap });

export const Page = ({ children }: { children: ReactNode }) => (
  <main className={css({ maxW: "560px", mx: "auto", px: "4", py: { base: "8", md: "16" }, display: "flex", flexDir: "column", gap: "6" })}>
    {children}
  </main>
);

export const Heading = ({ children, description }: { children: ReactNode; description?: ReactNode }) => (
  <div className={stack("1")}>
    <Text variant="heading" size="lg" as="h1">
      {children}
    </Text>
    {description && <Text variant="secondary">{description}</Text>}
  </div>
);

/** A titled card: fldr's LayerCard with the title in the secondary layer. */
export const Section = ({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) => (
  <LayerCard>
    <LayerCard.Secondary className={css({ justifyContent: "space-between" })}>
      <span>{title}</span>
      {actions}
    </LayerCard.Secondary>
    <LayerCard.Primary>{children}</LayerCard.Primary>
  </LayerCard>
);

export const ErrorBanner = ({ children }: { children: ReactNode }) =>
  children ? (
    <div role="alert">
      <Banner variant="error" size="sm" icon={<WarningCircleIcon />} description={children} />
    </div>
  ) : null;

/** Rows separated by hairlines, for lists inside a Section. */
export const Rows = ({ children }: { children: ReactNode }) => (
  <ul className={css({ display: "flex", flexDir: "column", divideY: "1px", divideColor: "kumo.hairline", my: "-2" })}>{children}</ul>
);

export const Row = ({ title, detail, action }: { title: ReactNode; detail: ReactNode; action: ReactNode }) => (
  <li className={css({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "3", py: "2" })}>
    <div className={css({ minW: 0 })}>
      <Text truncate>{title}</Text>
      <Text variant="secondary" size="sm" truncate>
        {detail}
      </Text>
    </div>
    {action}
  </li>
);
