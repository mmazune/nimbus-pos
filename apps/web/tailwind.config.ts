import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
      fontFamily: {
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
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        panel: "var(--shadow-panel)",
        overlay: "var(--shadow-overlay)",
        focus: "var(--shadow-focus)",
        "focus-inverse": "var(--shadow-focus-inverse)",
      },
    },
  },
  plugins: [],
};

export default config;
