# DESIGN.md — Nimbus POS Cashier Workspace Design System Extension

Status: Draft v1  
Date: 2026-07-01  
Extends: global Nimbus POS `DESIGN.md`  
Role: Cashier

## 1. Purpose

This file extends the global Nimbus POS design system for cashier-specific payment, receipt, till, split, refund, and closeout workflows.

Source basis:
- Uploaded waiter docs were used as the structure template: AGENTS.md, DESIGN.md, waiter_design.md, waiterui.md, WAITER_LIFECYCLE.md.
- Uploaded Nimbus audit/register resources were used for cashier-relevant routes: endpoint register, role endpoint matrix, master audit, gap register, workflow map.
- Live Windows repo path was not mounted in this environment, so exact DTOs/seed permissions must be verified in `C:\Users\arman\Desktop\nimbus-pos` before coding.


## 2. Cashier mood

The cashier workspace should feel premium, exact, safe, controlled, fast, readable, and calm. It should not feel like a public checkout, finance dashboard, waiter map, neon SaaS panel, or fake terminal simulator.

## 3. Palette usage

Use global tokens only. Token names are unchanged; their **values** were rebranded in Aug 2026 to the Nimbus POS Brand Identity guide — canonical Navy Blue `--color-brand-navy-900` `#000033`, with `--color-brand-navy-950` `#000024` and `--color-brand-navy-800` `#1E1E52` as derived shade/tint; `--color-brand-white` `#FFFFFF`; `--color-brand-silver` `#B3B4AF` (brand Light Grey); `--color-brand-graphite` `#6B6B6B` (brand Dark Grey, sampled from the guide's swatch — the guide's printed hex is a typo). See `docs/BRAND_IDENTITY.md`.

| UI area | Token usage |
|---|---|
| Header | `--color-brand-navy-950` |
| Active bottom nav / primary action | `--color-brand-navy-900` |
| Page background | `--color-page-bg` |
| Cards/panels/drawers | `--color-surface`, `--color-surface-raised` |
| Secondary controls | `--color-surface-muted`, graphite text |
| Paid/settled | success tokens |
| Bill requested / pending / shift or till warning | warning tokens |
| Failed/denied/variance/refund risk | danger tokens |
| Closed/inactive/stub metadata | neutral tokens |

Payment status treatment:
- Outstanding: warning surface.
- Partially paid: info surface with remaining amount.
- Settled/Paid: success surface.
- Failed payment: danger surface.
- Pending provider/adapter: warning with caveat tag, never success.

## 4. Typography

Use Inter Variable or the existing fallback. Use tabular numbers for prices, totals, paid, outstanding, cash received, change due, float, expected cash, counted cash, variance, table/order numbers, timers, and current time.

| Element | Guidance |
|---|---|
| Page title | `text-2xl`, 600/700 |
| Checkout total/outstanding | `numeric-xl`, 700 |
| Order card title | `text-lg`, 600 |
| Tender method labels | `text-base`, 600 |
| Caveats | `text-sm`, 500/600 |
| Till variance | `numeric-lg`, 700 |

No thin weights. No decorative serif fonts.

## 5. Interaction laws and principles

Apply these because cashier workflows handle money:

- **Fitts’s Law**: primary payment/close buttons are 48–56px high and easy to hit.
- **Hick’s Law**: keep nav to 4 items; progressively disclose split/merge/refund/advanced actions.
- **Law of Proximity**: group totals, tender, method, reference, and submit in one payment panel.
- **Jakob’s Law**: use familiar POS patterns: queue/list, sticky checkout panel, receipt drawer.
- **Tesler’s Law**: payment complexity belongs in backend + clear UI states, not fake success.
- **Error prevention**: confirm close, refund, safe drop, reconcile, split/merge.
- **Recognition over recall**: method cards show availability and caveats.
- **Immediate feedback**: every write says what is happening and what happened.

## 6. Shell layout

Header height: 64px. Bottom nav height: 76–84px. Main padding: 20–24px.

Header:
- left: logo (44×44 white brand tile — renders the shipped steering-wheel logomark via `components/pos-shell/NimbusLogomark.tsx`, see `docs/BRAND_IDENTITY.md` §2.6), branch, terminal;
- center: current time;
- right: shift chip, till chip, cashier avatar/name, logout.

Bottom nav:
1. Queue
2. Receipts
3. Till
4. Me

No Floor, Menu, More, or hidden nested menus.

## 7. Queue and checkout layout

At 1440×900:
- queue/list area: 60–65%;
- sticky checkout/payment panel: 35–40%;
- receipt drawer: 420–560px;
- split/refund drawer: 560–760px.

Queue cards show order number, table/takeaway, waiter/server, bill state, payment state, total, paid, outstanding, requested/updated time, and Open checkout.

## 8. Payment panel rules

Required payment panel structure:
1. Order identity.
2. Totals: subtotal, tax, discount, total.
3. Settlement: paid, outstanding, tender amount.
4. Payment method cards.
5. Method-specific fields.
6. Caveat/blocked reason.
7. Primary action.
8. Close/receipt/split secondary actions.

Payment methods:
- Cash: requires active till; show amount received and change due.
- Card: manual reference/stub only; show `STUB — no live hardware traffic`.
- MTN/Airtel: provider-gated/manual-reference only; show `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`.
- PesaPal: excluded from diner checkout.

## 9. Receipt drawer rules

Show branch/org, receipt/order number, table/order type, server, line items, subtotal, tax, discounts, total, payment summary, paid, outstanding, footer, and history.

Actions:
- Reprint: metadata/request only.
- Send: pending/no adapter only.

Caveats:
- `Metadata only — no print-driver invocation`
- `PENDING — no live email/SMS/WhatsApp adapter`

## 10. Till screen rules

Till states:
- no shift, no till, till open, reconciling, variance, till closed, maintenance, training.

Show opening float, cash payments, safe drops, expected cash, counted cash, variance, and last action. Cash payment is blocked unless till is open.

## 11. Loading and state copy

Use skeletons for queue, checkout, receipt drawer, receipt list, till summary, Me profile.

Empty:
- Queue: `No bills waiting for checkout.`
- Receipts: `No receipts found for this filter.`
- Till: `No active till session.`

Success:
- `Payment recorded.`
- `Order closed.`
- `Split bill recorded.`
- `Receipt reprint requested.`
- `Receipt send recorded as pending.`
- `Safe drop recorded.`
- `Till reconciled.`

Blocked:
- `Shift not started — settlement actions disabled.`
- `Till not open — cash payments disabled.`
- `Mobile-money payment execution is pending MTN/Airtel provider confirmation.`
- `Card terminal is stub-only. Use manual reference.`

## 12. Accessibility

Minimum text contrast 4.5:1, visible focus, 44px minimum touch target, status not color-only, accessible labels on icon buttons, reduced-motion support, readable at 1280×800, disabled actions include reasons.

## 13. Icons

Use Phosphor Icons only. Icons use `currentColor`.

Suggested:
- Queue: `ListChecks` or `Queue`
- Receipts: `Receipt`
- Till: `CashRegister`
- Me: `UserCircle`
- Cash: `Money`
- Card: `CreditCard`
- Mobile money: `DeviceMobile`
- Pending provider: `WarningDiamond`
- Split: `ArrowsSplit` / `Scales`
- Reprint: `Printer`
- Refund: `ArrowCounterClockwise`
- Safe drop: `Vault`
- Reconcile: `Calculator`

Locked safety boundaries:
- Public diner MTN/Airtel mobile-money execution remains `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`.
- MTN/Airtel may appear only as provider-gated or manual-reference-only if the backend DTO supports safe local manual reference capture.
- PesaPal is owner SaaS subscription billing only; it must never appear as diner checkout.
- Receipt send remains `PENDING — no live email/SMS/WhatsApp adapter`.
- Printer routes/reprint are metadata/request only: `Metadata only — no print-driver invocation`.
- Card terminal pairing is `STUB — no live hardware traffic`; no acquirer/card-terminal traffic.
- No fake provider credentials, no fake live delivery, no fake printed/terminal approved states.
