import { Apple, Gmail, MicrosoftOutlook, ProtonMail } from "@fldr/ui/brands";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { css, cx } from "../styled-system/css";
import type { ProviderId } from "../../src/shared/providers";

type IconId = ProviderId | "outlook" | "proton";

const tile = css({
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  rounded: "md",
  fontWeight: "semibold",
  lineHeight: 1,
  userSelect: "none",
});
const neutral = css({ bg: "kumo.base", color: "kumo.text.default", ring: "1px solid", ringColor: "kumo.hairline" });

// svgl has no official marks for these, so they get a monogram in the brand colour.
const monograms: Partial<Record<IconId, { text: string; bg: string }>> = {
  yahoo: { text: "Y!", bg: "#6001d2" },
  aol: { text: "Aol", bg: "#111111" },
  fastmail: { text: "F", bg: "#0067b9" },
  zoho: { text: "Z", bg: "#e42527" },
};

const marks: Partial<Record<IconId, (size: number) => ReactNode>> = {
  icloud: (s) => <Apple width={s} height={s} />,
  gmail: (s) => <Gmail width={s} height={s} />,
  outlook: (s) => <MicrosoftOutlook width={s} height={s} />,
  proton: (s) => <ProtonMail width={s} height={s} />,
};

export function providerIconId(name: string): IconId {
  if (/outlook|microsoft/i.test(name)) return "outlook";
  if (/proton/i.test(name)) return "proton";
  return "custom";
}

/** A provider's logo in a square tile. */
export function ProviderIcon({ id, size = 32 }: { id: IconId; size?: number }) {
  const box = { width: size, height: size };
  const mono = monograms[id];
  if (mono)
    return (
      <span aria-hidden className={tile} style={{ ...box, background: mono.bg, color: "#fff", fontSize: size * (mono.text.length > 2 ? 0.32 : 0.42) }}>
        {mono.text}
      </span>
    );
  const mark = marks[id];
  return (
    <span aria-hidden className={cx(tile, neutral)} style={box}>
      {mark ? mark(Math.round(size * 0.56)) : <EnvelopeSimpleIcon size={Math.round(size * 0.5)} />}
    </span>
  );
}
