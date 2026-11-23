import { Button as BaseButton } from "@base-ui/react/button";
import { Field } from "@base-ui/react/field";
import type { ComponentProps, ReactNode } from "react";
import { css, cx } from "../styled-system/css";

const buttonBase = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  h: "9",
  px: "4",
  rounded: "md",
  fontWeight: "medium",
  cursor: "pointer",
  transition: "opacity 0.15s",
  _disabled: { opacity: 0.5, cursor: "default" },
});

const variants = {
  primary: css({ bg: "accent", color: "accentFg", _hover: { opacity: 0.9 } }),
  ghost: css({ color: "muted", _hover: { color: "fg" } }),
  danger: css({ color: "danger", _hover: { textDecoration: "underline" }, px: "0", h: "auto" }),
};

export function Button({ variant = "primary", className, ...props }: ComponentProps<typeof BaseButton> & { variant?: keyof typeof variants }) {
  return <BaseButton {...props} className={cx(buttonBase, variants[variant], className as string)} />;
}

const input = css({
  w: "full",
  h: "9",
  px: "3",
  rounded: "md",
  border: "1px solid",
  borderColor: "border",
  bg: "surface",
  color: "fg",
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "1px" },
});

export function TextField({ label, description, ...props }: ComponentProps<typeof Field.Control> & { label: string; description?: ReactNode }) {
  return (
    <Field.Root className={css({ display: "flex", flexDir: "column", gap: "1.5" })}>
      <Field.Label className={css({ fontSize: "sm", fontWeight: "medium" })}>{label}</Field.Label>
      <Field.Control {...props} className={input} />
      {description && <Field.Description className={css({ fontSize: "sm", color: "muted" })}>{description}</Field.Description>}
    </Field.Root>
  );
}

export const ErrorText = ({ children }: { children: ReactNode }) =>
  children ? <p className={css({ color: "danger", fontSize: "sm" })}>{children}</p> : null;

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx(css({ bg: "surface", border: "1px solid", borderColor: "border", rounded: "lg", p: { base: "5", md: "6" } }), className)}>{children}</div>
);

export const Page = ({ children }: { children: ReactNode }) => (
  <main className={css({ maxW: "560px", mx: "auto", px: "4", py: { base: "8", md: "16" }, display: "flex", flexDir: "column", gap: "6" })}>
    {children}
  </main>
);

export const Heading = ({ children }: { children: ReactNode }) => <h1 className={css({ fontSize: "2xl", fontWeight: "semibold" })}>{children}</h1>;
