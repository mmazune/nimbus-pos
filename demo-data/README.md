# Nimbus Enterprise Demo Data Pack

Generated for the Nimbus POS / ChefCloud demo workflow.

This pack contains deterministic CSV fixtures for a full enterprise restaurant-group demo. It is designed to be copied into `C:\Users\arman\Desktop\nimbus-pos\demo-data` and then imported by a repo-aware TypeScript importer.

## Scope

Covers organization/branches, users, HR, floor/tables, menu, modifiers, recipes, inventory, suppliers, POS sales history, KDS/device metadata, payments, receipt pending events, reservations, events/tickets, accounting/GL/AP/AR, franchise scorecards, reports, feedback, anomalies, alerts, feature flags, maintenance windows, training sessions, and safe HMS metadata.

## Fixed demo time

- Local demo now: `2026-06-30T12:00:00+03:00`
- Storage convention: UTC ISO timestamps
- History window: `2026-04-01` through `2026-06-30`

## Safety labels preserved

- Public diner mobile-money: `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`
- PesaPal: owner SaaS billing only, not diner checkout
- Receipt send: `PENDING — no live email/SMS/WhatsApp adapter`
- Printer routes: metadata only, no print-driver invocation
- Terminal pairing: `STUB`, no acquirer/card-terminal traffic
- HMS API key row is metadata only; create real demo key through existing dev API later if needed

## How to use

1. Unzip this pack.
2. Copy the `demo-data` folder into the repo root.
3. Give Codex the included `IMPLEMENTATION_PROMPT.md`.
4. Codex should implement a dry-run importer first, then wire a reviewed write-mode.
5. After import, start API + web and open the UI.

Do not run database writes until the importer has passed dry-run validation.

## Local demo QA status

- Demo login credentials are documented in `demo-data/DEMO_LOGIN_CREDENTIALS.md`.
- Recommended waiter demo: `waiter@nimbus.demo` / `Demo1234!` or Quick PIN `246810` at Tapas Downtown.
- Demo actions write only to the configured local demo database.
- Live providers are not called: mobile-money remains provider-gated, receipt delivery remains pending/no-adapter, printer routes are metadata only, and payment terminals are stubs only.
- To reset the demo, rerun the repo seed/import flow after confirming the database URL is local/demo-safe. Never run the demo importer against production.
