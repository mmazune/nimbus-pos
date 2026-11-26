# Nimbus POS drawings

These are the screens the owner asked for on 26 Nov 2026: "by the time you're coding, they should look exactly the same as those pictures."

- `png/` is what each screen looks like, at the size in its row of `SCREENS.md`.
- `html/` is the same screen as plain HTML. Open a file in a browser to measure anything: sizes, gaps, colours, type.
- `kit.css` holds every token and every component the drawings use. It is the source for the app's tokens and kit.
- `SCREENS.md` says which role, which route and which milestone each drawing belongs to.

## Rules a builder holds to

1. Build to the drawing. Same layout, sizes, words, order of things. If the drawing and an older document disagree, the drawing wins; write the difference in your report.
2. The numbers in `kit.css` are the numbers: navy `#000033`, canvas `#F2F3F7`, cards white with radius 20, buttons 52 px high with radius 14, chips 44, table tile 108 px (compact 84), touch header 64, bottom bar 76 with 56 px sections, phone bar 84.
3. One filled button on a screen at most. Tonal for the rest. No outlined buttons. No text cut with "…". Nothing scrolls sideways. Every target is 44 px or more. No text under 12 px.
4. Icons: the drawings use a stand-in line set. The app keeps its one icon set, Phosphor, through the registry in `apps/web/src/components/pos-shell/role-icon-config.ts`: regular weight when idle, fill when current, 28 px in the bottom bar, 24 px elsewhere, 18 px inside buttons.
5. Type is Inter (already in the repo as `@fontsource-variable/inter`). Seven styles: 28/34 800, 22/28 700, 17/24 700, 16/22, 14/20, 13/18, 12/16 600. The kitchen ticket line (20/26), the keypad key (26/32) and the big amount (40/44) are the three allowed extras.
6. Every name, table, item and price in the drawings is made up. Never copy them into seeds or tests as if they were a venue's data; staff in fixtures use the project's fictional cast and phone numbers from `+256 700 000 xxx`.
7. Each drawing was measured before it was approved: no clipped text, nothing outside the frame, no target under 44 px, no text under 12 px. A built screen is measured the same way before it is called done.
