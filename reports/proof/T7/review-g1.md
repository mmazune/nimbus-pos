# Look review, group 1 (fresh reviewer)

References looked at first: `Main.png`, `Supervisor-Void.png`. All 16 PNGs opened and looked at one by one.
Scale: 0 to 2 per point; pass = 20 of 24 with no zero.

| Drawing | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total | Findings (short) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Lock-PIN | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 23 | The delete key icon looks like "undo" (curved arrow). Otherwise clean: the note about kept items is good. |
| Lock-PIN-Phone | 2 | 1 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 20 | Loses the "kept while locked" note (table 23 has 3 items not sent). Keypad sits on bare canvas under a big empty top. The same undo-looking delete icon. No logo. |
| Lock-Wrong-PIN | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 23 | Red dots and a plain message are clear. It does not show whether the dots clear for the next try. Same delete icon. |
| Lock-Wrong-PIN-Phone | 2 | 1 | 1 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 19 | The error line runs edge to edge and nearly touches both 16 px gutters. Big empty top. No note about unsent items. Same delete icon. |
| PIN-Set-Own | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 22 | No "Start over" or back to step 1 if the first four were wrong (Clear only clears this step). Same delete icon. |
| PIN-Set-Own-Phone | 2 | 1 | 2 | 2 | 1 | 2 | 1 | 1 | 2 | 2 | 2 | 1 | 19 | The Done/Now step list and the "not 1234 or your birthday" advice are gone. No start over and no way out. Keypad is pushed to the bottom under a big empty area. Same delete icon. |
| Shift-Start | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 23 | Strong: one navy button and a tonal link. The header says "Terminal 01" twice (left and right). |
| Shift-Start-Phone | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 22 | No lock or "not you?" control, so the wrong person cannot leave. No logo in the header. |
| Floor-Shift-Not-Started | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 23 | Banner plus a single navy "Start my shift" works well. "as at 16:52" is stiff wording. |
| Floor-Shift-Not-Started-Phone | 2 | 2 | 1 | 2 | 2 | 1 | 2 | 2 | 1 | 1 | 2 | 2 | 20 | Shows only the 12 free tables, but the banner says "look only" and desktop shows every table, so open tables are hidden. Every card repeats a green "Free" chip that adds nothing. There is no My/All switch. Bottom-bar labels are about 12 px and "Reservations" is cramped. The Ready badge sits on the icon. |
| Cashier-Floor | 1 | 2 | 2 | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 20 | The bottom bar shows **Receipts**, but the locked cashier nav is Floor · Till · Me. It opens on "All tables" instead of "Bill · 3", and bill tables look the same as all the others, so the cashier's job is not obvious. Every waiter name is bold black and competes with the amounts. |
| Cashier-Floor-Phone | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | **0** | 2 | 2 | 19 | **No amount on any card**: the cashier cannot see bill sizes. The "All tables" view leaves out free tables, and there is no way to change zone. Receipts is in the nav (locked nav is Floor · Till · Me). It opens on All, not Bill. |
| Floor-Tabs | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 22 | Six cards and then two-thirds of the screen is empty. The helper "It is numbered by itself" is clumsy. |
| Floor-Tabs-Phone | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 23 | New tab appears twice: a "+" in the header and the filled button. The list rows are good. |
| Tab-Name | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 23 | The sheet follows the Void reference. The copy is wordy: "It is numbered by itself…" and a long rule sentence next to the guest stepper. |
| Tab-Name-Phone | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 23 | The quick-pick chips have no "Or pick one" label. "Numbered by itself" is odd wording. Close is the X only (acceptable). |

## Breaks use / wording
- Cashier-Floor-Phone: there are no money amounts, so a cashier cannot pick a bill by size. This is the main use break.
- Cashier-Floor and Cashier-Floor-Phone: the Receipts tab goes against the locked cashier nav (Floor · Till · Me).
- PIN-Set-Own-Phone and Shift-Start-Phone: no way back or out (dead end for a mistyped first PIN or the wrong person).
- The delete key on every keypad uses an undo-style curved arrow. Use a backspace (delete-left) icon.
- Wording to change: "It is numbered by itself" (Floor-Tabs, Tab-Name, Tab-Name-Phone) and "as at 16:52". No developer terms or codes were found.

## Fix before pass
- **Cashier-Floor-Phone (19, a zero on numbers):** show the bill amount (UGX) on every card. Open on "Bill · 3" first. Add free tables, or rename the view. Add a zone switcher. Replace the bottom bar with Floor · Till · Me.
- **Lock-Wrong-PIN-Phone (19):** give the error two lines inside the gutters ("That PIN is not right." / "2 tries left, then a 5-minute wait."). Put the keypad in a white card or move it up. Bring back a short line about unsent items. Use a backspace icon.
- **PIN-Set-Own-Phone (19):** add the Done/Now step marker (or "Step 2 of 2" with the advice line). Add a tonal "Start over" link. Move the keypad up instead of leaving the empty top. Use a backspace icon.
- Borderline passes worth fixing in the same pass: Cashier-Floor (20: nav and Bill-first view), Floor-Shift-Not-Started-Phone (20: show all tables and drop the repeated Free chips), Lock-PIN-Phone (20: the unsent-items note).
