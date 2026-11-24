import { Banner, LayerCard, Text } from "@fldr/ui";
import { WarningCircleIcon, type Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { css } from "../styled-system/css";

export const stack = (gap: "1" | "2" | "3" | "4" | "6" = "4") => css({ display: "flex", flexDir: "column", gap });

export const Page = ({ children }: { children: ReactNode }) => (
  <main className={css({ maxW: "560px", mx: "auto", px: "4", py: { base: "8", md: "16" }, display: "flex", flexDir: "column", gap: "6" })}>
    {children}
  </main>
);

export const Heading = ({ children, description, icon }: { children: ReactNode; description?: ReactNode; icon?: ReactNode }) => (
  <div className={css({ display: "flex", gap: "3", alignItems: "flex-start" })}>
    {icon}
    <div className={stack("1")}>
      <Text variant="heading" size="lg" as="h1">
        {children}
      </Text>
      {description && <Text variant="secondary">{description}</Text>}
    </div>
  </div>
);

/** A titled card: fldr's LayerCard with the title in the secondary layer. */
export const Section = ({ title, icon, actions, children }: { title: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode }) => (
  <LayerCard>
    <LayerCard.Secondary className={css({ justifyContent: "space-between" })}>
      <span className={css({ display: "flex", alignItems: "center", gap: "2", minW: 0 })}>
        {icon}
        {title}
      </span>
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

export const Row = ({ icon, title, detail, action }: { icon?: ReactNode; title: ReactNode; detail: ReactNode; action: ReactNode }) => (
  <li className={css({ display: "flex", alignItems: "center", gap: "3", py: "2.5" })}>
    {icon}
    <div className={css({ minW: 0, flex: 1 })}>
      <Text truncate>{title}</Text>
      <Text variant="secondary" size="sm" truncate>
        {detail}
      </Text>
    </div>
    {action}
  </li>
);

/** A small icon in a recessed tile, for rows without a brand logo. */
export const IconTile = ({ icon: I, size = 32 }: { icon: Icon; size?: number }) => (
  <span
    aria-hidden
    className={css({ flexShrink: 0, display: "grid", placeItems: "center", rounded: "md", bg: "kumo.recessed", color: "kumo.text.subtle" })}
    style={{ width: size, height: size }}
  >
    <I size={Math.round(size * 0.5)} />
  </span>
);
