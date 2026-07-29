import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          "navy-950": "var(--color-brand-navy-950)",
          "navy-900": "var(--color-brand-navy-900)",
          "navy-800": "var(--color-brand-navy-800)",
          white: "var(--color-brand-white)",
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
          success: "var(--color-status-success)",
          "success-surface": "var(--color-status-success-surface)",
          warning: "var(--color-status-warning)",
          "warning-surface": "var(--color-status-warning-surface)",
          danger: "var(--color-status-danger)",
          "danger-surface": "var(--color-status-danger-surface)",
          info: "var(--color-status-info)",
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
        },
        focus: "var(--color-focus-ring)",
        skeleton: {
          base: "var(--color-skeleton-base)",
          highlight: "var(--color-skeleton-highlight)",
        },
      },
      fontFamily: {
        sans: [
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
      },
    },
  },
  plugins: [],
};

export default config;
