import type { AppProps } from "next/app";
import Head from "next/head";

import { AppProviders } from "@/components/providers/AppProviders";

// Self-hosted Inter (variable, woff2, `font-display: swap`). The app no longer
// depends on a system-installed Inter. `next/font/google` is the usual choice,
// but this sandbox/build network blocks fonts.googleapis.com, so the font is
// bundled from npm instead and served from the app's own `_next/static` output.
// Exposed family name is "Inter Variable" — keep it first in the CSS stack
// (globals.css `body` + tailwind.config.ts `fontFamily.sans`), with plain
// "Inter" second so a system-installed Inter is still honoured.
import "@fontsource-variable/inter";
import "@/styles/globals.css";

export default function NimbusApp({ Component, pageProps }: AppProps) {
  return (
    <AppProviders>
      <Head>
        <title>Nimbus POS</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/brand/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
        <link rel="manifest" href="/brand/manifest.webmanifest" />
        <meta property="og:title" content="Nimbus POS" />
        <meta
          property="og:description"
          content="Nimbus POS — the operating system for restaurants, bars, and hospitality teams."
        />
        <meta property="og:image" content="/brand/og-image.png" />
        <meta
          name="description"
          content="Nimbus POS — the operating system for restaurants, bars, and hospitality teams."
        />
        <meta name="theme-color" content="#000033" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </AppProviders>
  );
}
