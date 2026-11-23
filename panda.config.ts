import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda"],
  preflight: true,
  include: ["./web/src/**/*.{ts,tsx}"],
  outdir: "web/styled-system",
  jsxFramework: "react",
  conditions: { extend: { dark: "@media (prefers-color-scheme: dark)" } },
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          bg: { value: { base: "#fafaf9", _dark: "#141413" } },
          surface: { value: { base: "#ffffff", _dark: "#1e1e1c" } },
          fg: { value: { base: "#1c1917", _dark: "#f5f5f4" } },
          muted: { value: { base: "#78716c", _dark: "#a8a29e" } },
          border: { value: { base: "#e7e5e4", _dark: "#33312e" } },
          accent: { value: { base: "#1d4ed8", _dark: "#60a5fa" } },
          accentFg: { value: { base: "#ffffff", _dark: "#0b1220" } },
          danger: { value: { base: "#b91c1c", _dark: "#f87171" } },
        },
      },
    },
  },
  globalCss: {
    body: { bg: "bg", color: "fg", fontFamily: "system-ui, -apple-system, sans-serif", fontSize: "15px", lineHeight: "1.5" },
  },
});
