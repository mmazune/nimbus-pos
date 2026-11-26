import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Config } from "tailwindcss";

/*
 * U0 kit keys. Every key below is read from src/styles/kit-tokens.css, so the
 * Tailwind names and the CSS variables cannot drift apart. All kit values are
 * absolute px (R10) — they never follow the viewport-scaled root font size.
 *   colours   --kit-color-<n>   -> bg-kit-<n>, text-kit-<n>
 *   sizes     --kit-size-<n>    -> h-kit-<n>, w-kit-<n>, min-h-kit-<n> ...
 *   gaps      --kit-space-<n>   -> p-kit-<n>, gap-kit-<n> ...
 *   radii     --kit-radius-<n>  -> rounded-kit-<n>
 *   depth     --kit-shadow-<n>  -> shadow-kit-<n>
 *   type      --kit-type-<n>-*  -> text-kit-<n> (size + line + weight + tracking)
 *   weights   --kit-weight-<n>  -> font-kit-<n>
 */
const kitTokenNames = Array.from(
  readFileSync(join(__dirname, "src/styles/kit-tokens.css"), "utf8").matchAll(/(--kit-[a-z0-9-]+)\s*:/g),
  (m) => m[1],
);
function kitGroup(prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of kitTokenNames) {
    if (name.startsWith(prefix)) out[`kit-${name.slice(prefix.length)}`] = `var(${name})`;
  }
  return out;
}
const kitColors = Object.fromEntries(
  Object.entries(kitGroup("--kit-color-")).map(([k, v]) => [k.slice("kit-".length), v]),
);
const kitFontSize: Record<string, [string, { lineHeight: string; fontWeight: string; letterSpacing?: string }]> = {};
for (const name of kitTokenNames) {
  const m = /^--kit-type-(.+)-size$/.exec(name);
  if (!m) continue;
  const t = m[1];
  const tracked = t === "title" || t === "title-lg" || t === "big" || t === "tile-no" || t === "tile-no-c";
  kitFontSize[`kit-${t}`] = [
    `var(--kit-type-${t}-size)`,
    {
      lineHeight: `var(--kit-type-${t}-line)`,
      fontWeight: `var(--kit-type-${t}-weight)`,
      ...(tracked ? { letterSpacing: "var(--kit-track-tight)" } : t === "cap" ? { letterSpacing: "var(--kit-track-cap)" } : {}),
    },
  ];
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kit: kitColors,
        brand: {
          "navy-950": "rgb(var(--color-brand-navy-950-ch) / <alpha-value>)",
          "navy-900": "var(--color-brand-navy-900)",
          "navy-800": "var(--color-brand-navy-800)",
          white: "rgb(var(--color-brand-white-ch) / <alpha-value>)",
          silver: "var(--color-brand-silver)",
          graphite: "var(--color-brand-graphite)",
        },
        page: "var(--color-page-bg)",
        surface: {
          DEFAULT: "var(--color-surface)",
          raised: "var(--color-surface-raised)",
          muted: "var(--color-surface-muted)",
          navy: "var(--color-surface-navy)",
        },
        border: {
          subtle: "var(--color-border-subtle)",
          strong: "var(--color-border-strong)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        status: {
          success: "rgb(var(--color-status-success-ch) / <alpha-value>)",
          "success-surface": "var(--color-status-success-surface)",
          warning: "rgb(var(--color-status-warning-ch) / <alpha-value>)",
          "warning-surface": "var(--color-status-warning-surface)",
          danger: "rgb(var(--color-status-danger-ch) / <alpha-value>)",
          "danger-surface": "var(--color-status-danger-surface)",
          info: "rgb(var(--color-status-info-ch) / <alpha-value>)",
          "info-surface": "var(--color-status-info-surface)",
          neutral: "var(--color-status-neutral)",
          "neutral-surface": "var(--color-status-neutral-surface)",
        },
        role: {
          waiter: "var(--color-role-waiter)",
          "waiter-soft": "var(--color-role-waiter-soft)",
          cashier: "var(--color-role-cashier)",
          "cashier-soft": "var(--color-role-cashier-soft)",
          supervisor: "var(--color-role-supervisor)",
          "supervisor-soft": "var(--color-role-supervisor-soft)",
          manager: "var(--color-role-manager)",
          "manager-soft": "var(--color-role-manager-soft)",
        },
        focus: "var(--color-focus-ring)",
        // Track B2 dashboard chart series — see globals.css for the ramp rationale.
        chart: {
          "series-1": "var(--color-chart-series-1)",
          "series-2": "var(--color-chart-series-2)",
          "series-3": "var(--color-chart-series-3)",
          "series-4": "var(--color-chart-series-4)",
          track: "var(--color-chart-track)",
        },
        skeleton: {
          base: "var(--color-skeleton-base)",
          highlight: "var(--color-skeleton-highlight)",
        },
      },
      fontSize: kitFontSize,
      fontWeight: kitGroup("--kit-weight-"),
      opacity: kitGroup("--kit-opacity-"),
      transitionTimingFunction: { kit: "var(--kit-ease)" },
      transitionDuration: kitGroup("--kit-duration-"),
      fontFamily: {
        kit: ["var(--kit-font)"],
        sans: [
          // Bundled self-hosted variable Inter (@fontsource-variable/inter,
          // imported in src/pages/_app.tsx) first; a system-installed "Inter"
          // second; then the system stack. Keep aligned with globals.css `body`.
          "\"Inter Variable\"",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Segoe UI\"",
          "sans-serif",
        ],
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
        ...kitGroup("--kit-size-"),
        ...kitGroup("--kit-space-"),
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        ...kitGroup("--kit-radius-"),
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        panel: "var(--shadow-panel)",
        overlay: "var(--shadow-overlay)",
        focus: "var(--shadow-focus)",
        "focus-inverse": "var(--shadow-focus-inverse)",
        ...kitGroup("--kit-shadow-"),
      },
    },
  },
  plugins: [],
};

export default config;
