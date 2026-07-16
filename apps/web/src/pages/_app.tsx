import type { AppProps } from "next/app";
import Head from "next/head";

import { AppProviders } from "@/components/providers/AppProviders";
import "@/styles/globals.css";

export default function NimbusApp({ Component, pageProps }: AppProps) {
  return (
    <AppProviders>
      <Head>
        <title>Nimbus POS</title>
        <meta
          name="description"
          content="Nimbus POS desktop-first waiter workspace foundation."
        />
        <meta name="viewport" content="width=1280, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </AppProviders>
  );
}
