import { defineConfig } from "@pandacss/dev";
import { kumoPreset } from "@fldr/ui/panda";

// Components come from @fldr/ui; Panda is only for page layout, on fldr's tokens.
export default defineConfig({
  presets: ["@pandacss/preset-base", "@pandacss/preset-panda", kumoPreset],
  preflight: false,
  include: ["./web/src/**/*.{ts,tsx}"],
  outdir: "web/styled-system",
  jsxFramework: "react",
  globalCss: {
    body: { bg: "kumo.canvas", color: "kumo.text.default" },
  },
});
