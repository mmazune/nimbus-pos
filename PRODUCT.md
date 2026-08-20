# Product

## Register

product

## Users

Restaurant and bar teams operating shared desktop POS terminals, including waiters, cashiers, chefs, supervisors, managers, owners, and specialist back-office roles. The waiter is often standing, working under time pressure, and needs to move from table context to accurate order entry with minimal steps and low error risk.

## Product Purpose

Nimbus POS is a full-depth hospitality operations platform. It connects table service, orders, kitchen and bar dispatch, inventory, reservations, workforce, accounting, reporting, franchise operations, and commercial administration while preserving strict role boundaries and auditable operational truth.

## Brand Personality

Premium, calm, fast, stable, professional, legible, controlled, and operational.

## Brand Identity

Nimbus POS Brand Identity guide (Andimashimwe Rhoda, August 2026). Brand essence: control, confidence, calm, stability. Palette: Navy Blue `#000033` and White as the primary pair, with Light Grey `#B3B4AF` and Dark Grey `#6B6B6B` (sampled from the guide's swatch) as supporting premium accents. Type: Inter only — ExtraBold for display, Regular for body. Logomark: a crisp, geometric steering wheel — the operator is in the driver's seat of their own business — legible from a 16px favicon to a storefront sign; shipped as true vectors under `apps/web/public/brand/` and rendered in-app by `components/pos-shell/NimbusLogomark.tsx`. Wordmark "Nimbus POS" in one-line and stacked variations, plus combination marks. Colors are consumed only through the design tokens in `apps/web/src/styles/globals.css`; never hard-code a hex. Full reference: `docs/BRAND_IDENTITY.md`.

## Anti-references

Do not resemble a generic admin template, consumer delivery app, social product, gaming interface, marketing site, neon or purple SaaS dashboard, glassmorphism experiment, or image-heavy restaurant catalog. Avoid decorative action clutter, invented workflows, fake provider states, and interface state that contradicts the backend.

## Design Principles

1. Keep the operator in context and make the next valid action obvious.
2. Prefer operational truth over optimistic or decorative messaging.
3. Respect management-configured taxonomy and role permissions instead of inventing frontend structure.
4. Reduce steps for common actions while keeping consequential actions deliberate.
5. Make dense service workflows touch-friendly, legible, and resilient at shared-terminal viewports.

## Accessibility & Inclusion

Target WCAG 2.2 AA, visible keyboard focus, non-color status communication, reduced-motion support, 44px minimum targets with 48px preferred POS controls, readable contrast, and reliable use at the documented desktop terminal sizes.
