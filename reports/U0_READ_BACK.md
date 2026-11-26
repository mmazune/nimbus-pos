# U0 read-back — foundations

Session: Opus, branch `rebuild/main`, base `27790c1`. `design/screens/kit.css` present. moses-build-standards v5 loaded (§0, §3.2, §5A, §8 read).
Baseline (26 Nov 2026, before any change): web lint **0**, typecheck **0**, build **0**, **69** route lines in the build table. [live]

## Tokens: where each `kit.css` value lives
- One file, `apps/web/src/styles/kit-tokens.css`, imported at the top of `globals.css`. Every name starts `--kit-`.
- Colours (22): canvas, card, primary, primary-2, on-primary, on-primary-muted, tonal, tonal-2, field, text, muted, link, line, red/red-t, amber/amber-t, green/green-t, neutral-t, plus the two literals kit.css hides inside rules: `tile-other` `#E9EAF1` (`.tbl.other`) and `scrim` `rgb(0 0 51 / .42)`. → `--kit-color-*`, Tailwind `kit.*` colours (`bg-kit-canvas`, `text-kit-muted`).
- Shadows (3): card, small, up → `--kit-shadow-*`, Tailwind `shadow-kit-*`.
- Radii: 20 card, 16 card-lg/tile, 14 control, 12 seg/opt/measure, 9 seg button, 8 qty/mark, 28 sheet, 3, 2, full → `--kit-radius-*`, `rounded-kit-*`.
- Sizes and gaps (every px in kit.css: 2…760) → `--kit-size-*` / `--kit-space-*`, exposed as Tailwind `spacing` keys `kit-*` so h, w, min-h, p, gap all read them (`h-kit-button`, `gap-kit-12`).
- Type: the seven styles, `title-lg` (30/36, laptop page title, in kit.css), `cap`, the three extras (ticket line 20/26, key 26/32, big 40/44) and the component sizes kit.css sets inside rules (tile number 26/28 and 22/24, nav label 17/24, option 15, price 15/22, measure 14/18, measure price 12/14, item 16/20, stat 26/32, ticket number 28/32) → `--kit-type-<name>-{size,line,weight,track}`, Tailwind `text-kit-<name>` (size + line + weight in one key).

## px beside the scaled root (R10)
The root `html` font-size rule (`clamp(13.5px, 0.625vh + 9.25px, 16px)`) stays exactly as it is. Every kit token is absolute px, and kit pieces use only `kit-*` keys, never the rem-based default spacing (`--space-*`) or default `text-*`. So a kit piece measures the same at 1024×768 and 1920×1080; old screens keep scaling. Existing tokens, Tailwind keys and the root rule are untouched; the `kit` keys are additive.

## Kit pieces and their drawing
Text (all) · Button filled/tonal/text/danger 52 & 44 (Order-Terminal foot, Main "New tab") · SquareAction 52 (Supervisor-Table, Order-Terminal) · RoundAction 48/44 (Order-Phone-Item stepper, Floor-Phone band) · Chip (Main area chips) · Segmented (Main, Floor-Phone) · Card · Row (kit.css `.row`) · Sheet bottom (Order-Phone-Item), middle/wide/side (kit.css `.sheet.mid/.wide/.side`, Cashier-Pay) with scrim · Pill five tones (Table-Tile) · Switcher (Floor-Phone) · HeaderBand (Floor-Phone) · Field · TouchHeader 64 (Main, Floor-1024) · OrderHeader 60 with back (Order-Terminal) · BottomBar (Nav-Roles, Main) · TabBar (Floor-Phone, Manager/Owner/Accountant phone) · TableTile roomy/compact × 9 states (Table-Tile) · OptionTile 48/64/96 (Order-Terminal groups, kit.css `.opt.tall/.xl`) · ItemTile plain/"3 left"/sold out (Order-Empty) · Banner amber/red + one button (Kitchen-Store) · MeasureRow (Order-Terminal) · OrderLine not sent/sent/voided (Order-Terminal) · Stepper (Kitchen-Store, Manager-Floor) · ActionTile plain/danger (Supervisor-Table) · Key 100 (Cashier-Pay).

## Bar sections (R9 + drawings), Phosphor through the registry
Terminal bar, icon 28: Floor `SquaresFour` · Reservations `CalendarCheck` · Ready `CallBell` · Me `UserCircle` · Receipts `Receipt` · Till `CashRegister` · Approvals `ShieldCheck` · Team `UsersThree` · Tickets `Ticket` · Done `Check` · Sold out `Prohibit` · Store `Warehouse` · Requests `Tray` · Stock `Package` · Receive `TrayArrowDown` · Count `ClipboardText`.
Phone bar, icon 24: manager Today `Sun` · Floor · Approvals · Reports `ChartBar` · More `DotsThree`; owner Today · Branches `Storefront` · Reports · Alerts `Bell` · More; accountant Today · Costs `Coins` · Purchases `ShoppingCart` · Reports · More; waiter as the terminal four.
Regular weight idle, fill current. New glyph names are added to `role-icon-config.ts` / `role-icons.ts` (additive keys only; the registry stays the one place a glyph is chosen).

## Contradictions and which document won
1. Phone bar icon: prompt says 28 px for bar sections; Nav-Roles says 24 px over a 12 px label on a phone. **Drawing wins**: 28 terminal, 24 phone.
2. "Seven styles" vs kit.css component text at 15, 14, 26, 22 px etc. **kit.css wins** for its own components; they become named component type tokens, not free sizes.
3. kit.css has no focus or pressed style; the prompt requires both. Added as tokens: focus = 2 px card ring + 2 px link ring (reads on white and on navy, skill §5A.6 "2 px focus ring"); pressed = existing `primary-2` (filled, bars) and `tonal-2` (tonal), `canvas` on white surfaces. No new colour values.
4. Floor-1024 draws 32 compact tiles; the prompt asks for a 7 × 5 wall of 35. **Prompt wins** for the gallery (it is a fit test); 35 fit by arithmetic (768 − 64 − 76 − 32 − 60 = 536 ≥ 5 × 84 + 4 × 10 = 460).
5. Owner and accountant phone sections are not in R9; Nav-Roles says "their own five". **The drawings `Owner-Phone-Today` and `Accountant-Phone-Costs` win.**
6. Prompt forbids changing "shell"; the icon registry lives in `pos-shell/`. Taken as: additive registry entries are allowed (the prompt routes icons through it), no existing entry changes.

## Questions (default taken, work continues)
- Q1 Gallery frames 1920 wide in a 1280 viewport would scroll sideways. Default: frames are scaled down to fit with a CSS transform; sizes are measured as layout px (`offsetHeight`), which a transform does not change.
- Q2 The gallery switch is read at build time (`NEXT_PUBLIC_*` is inlined). Default: `getServerSideProps` returns `notFound` unless it is `1`; the proof build sets it, the final build does not.
- Q3 Route count after U0: 70 (the new `/kit`). Default: accepted, it is the one new route.
