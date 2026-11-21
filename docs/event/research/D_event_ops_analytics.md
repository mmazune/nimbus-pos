# D. Event operations and analytics: Nimbus POS at a Visa-sponsored concert, Kampala

Prepared 18 Nov 2026. Event expected in about 2-3 weeks (exact date UNKNOWN). T = event day.

## Evidence legend and honest caveats

- [V] = I opened the page (all read 18 Nov 2026) and it states this itself. Most pages are vendor or marketing blogs, so [V] means "the page says so", not "independently proven".
- [2H] = second-hand: the page cites no source, cites another party, or is an anecdote.
- [PK] = my prior knowledge, no source opened. [P] = planning assumption I made. UNKNOWN = not found.
- Search budget: I ran 7 searches and opened 16 pages. I did NOT open vendor guides from Weezevent, Tappit, Glownet, PlayPass, Yoco, SumUp, Lightspeed, Toast or Billfold. Two fetches failed: Pollstar's Billfold article (kept redirecting, nothing read) and Square's help article 5146 (the UK page returned only card-acceptance content, no event tips). So Square-for-events guidance is not cited.
- Biggest gap: I found NO sourced per-till transactions-per-hour benchmark. The only per-bartender figure (~200 drinks/hr) is an illustrative scenario in a blog. The till-count model in section 1 therefore rests on [P] assumptions you should replace with your own dry-run measurements.

Sources opened (all read 18 Nov 2026):
- S1 https://www.ticketfairy.com/blog/2025/08/24/festival-beverage-strategy-throughput-without-trouble/
- S2 https://www.intellitix.com/blog/why-cashless-tech-matters
- S3 https://www.ticketfairy.com/blog/cashless-at-scale-offline-fallback-strategies-for-large-festivals
- S4 https://www.ticketfairy.com/blog/event-pos-systems-in-2026-tech-strategies-for-shorter-lines-higher-sales (read first 100,000 of 124,626 characters only)
- S5 https://accessallareas.pages.dev/blog/2026-03-16-cashless-payments-festivals-problems-solutions/
- S6 https://kolonell.com/en/blog/ussd-payment-timeout-fallback-low-connectivity-kampala-2026
- S7 https://liveforce.co/blog/how-to-calculate-staffing-ratios/
- S8 https://festivalpro.com/festival-management/5508/news/2026/4/23/Managing-Cashless-Payment-System-Outages-for-Music-Festivals.html
- S9 https://noqgroup.com/resources/news-and-insights/why-festival-till-systems-must-be-offline-ready
- S10 https://help.howler.co.za/l/en/article/c13nacsisi-dashboard-guide-7-3-bar-sales-analysis
- S11 https://www.ticketfairy.com/blog/counting-the-money-festival-settlement-reconciliation
- S12 https://noqgroup.com/resources/news-and-insights/festival-spending-habits-insights-from-pos-data
- S13 https://www.ticketfairy.com/blog/feeding-50000-per-hour-festival-food-court-design-strategies.md
- S14 https://peppermintbars.co.uk/data-and-insights-festival-bar-commercial-performance/ (no usable numbers; not relied on)

---

## 1. Throughput numbers

### 1a. What the sources say

| Figure | Value | Source | Tag |
|---|---|---|---|
| Contactless tap transaction | "roughly two to three seconds" | S2 (Intellitix) | [V] vendor claim |
| Card tap, same range | 2-3 seconds | S5 | [2H] no source |
| Cash transaction with change | 15-30 seconds | S5 | [2H] unsourced |
| Terminal approval time on a reliable network | 1-2 seconds | S4 | [2H] |
| Cashless cuts transaction time | "up to 50%" | S4 | [2H] unsourced |
| Per-head spend with faster lines / cashless | +15-30% (S2, S4); +15-40% revenue (S4) | S2, S4 | [2H] study not named |
| Stadium F&B benchmark | roughly 1 POS per 200-250 attendees | S4 | [2H] stadium, not concert; not sourced |
| Illustrative bar throughput | ~200 drinks/hr per bartender; 10 vs 5 pours/min | S1 | [2H] explicitly illustrative |
| Festival bar staffing | 1 bartender per 60-75 attendees at peak (page's own example, "not a published benchmark"); general bars 1 per 75-100 | S7 | [2H] |
| Peak timing | Most transactions 4pm-10pm; alcohol spikes 30-45 min before main-stage sets | S12 | [2H] |
| Spare device reserve | at least 10% of deployed units | S4 | [2H] |
| Mobile money (USSD/STK) failure before confirmation on slow links | 10-18% | S6 (Kampala-framed marketing blog, no method) | [2H] |
| Mobile money confirmation time | average 45 s before, 22 s after the vendor's changes | S6 | [2H] |
| Mobile money prompt approval time, Uganda, at a crowded event | UNKNOWN | none | UNKNOWN |
| Per-till transactions per hour at festival bars | UNKNOWN (no sourced benchmark) | S1, S4, S13 checked; none gives one | UNKNOWN |

### 1b. Service time by payment type [P] (replace with dry-run timings)

Total till time = order entry + payment + handover. Order entry assumed 8 s for a limited menu with big tiles.

| Payment | Payment step [P] | Total per transaction [P] | Basis |
|---|---|---|---|
| Cash | ~20 s (count, change; S5 says 15-30 s) | ~28 s | S5 [2H] + 8 s [P] |
| Card on separate bank terminal | ~12 s (amount keyed on terminal, tap, approve; the 2-3 s tap is only part) | ~20 s | S2 [V] + [P] |
| Mobile money prompt | ~35 s (customer types number or scans, prompt, PIN, till sees confirmation); plus 10-18% retry/failed attempts | ~45 s | S6 [2H] + [P] |
| Pre-sold token/QR scan (optional lever) | ~3 s | ~11 s | [P] |

Assumed tender mix [P]: 50% cash, 25% card, 25% mobile money. The real Ugandan mix is UNKNOWN. A Visa sponsorship may push card share up.
Weighted average = 0.5(28) + 0.25(20) + 0.25(45) = about 30 s per transaction, about 119 per till per hour at 100% busy. At 75% utilisation (a queueing safety margin, [PK] standard practice: queues explode above ~85% utilisation) the planning rate is **r = 90 transactions per till per hour for drinks**, [P]. Use r = 70 as a conservative case. For food I assume r = 60 [P] because of more items and longer handover.

### 1c. Till-count rule

Tills needed = ceil( A x d x s ÷ k ÷ r )

- A = people on site at peak (use 85% of tickets sold [P], or gate scans)
- d = drinks per head per peak hour across ALL attendees (including non-drinkers) [P]
- s = share of that demand served by your vendor (1.0 if no other bars; UNKNOWN, ask Omakase)
- k = drinks per transaction (2.0 base [P]; combos and 2-for-1 bundles push it up)
- r = transactions per till per hour (90 base [P])

Food tills = ceil( A x f ÷ r_food ), f = food transactions per head per peak hour (0.15 base [P]), r_food = 60 [P].

### 1d. Worked table (s = 1.0, A = attendance on site at peak, k = 2.0)

Drinks tills:

| Attendance | Case | d | r | Drinks/hr | Tx/hr | Tills |
|---|---|---|---|---|---|---|
| 2,000 | Low | 0.5 | 90 | 1,000 | 500 | 6 |
| 2,000 | Base | 0.8 | 90 | 1,600 | 800 | **9** |
| 2,000 | Base, conservative rate | 0.8 | 70 | 1,600 | 800 | 12 |
| 2,000 | High | 1.2 | 90 | 2,400 | 1,200 | 14 |
| 5,000 | Low | 0.5 | 90 | 2,500 | 1,250 | 14 |
| 5,000 | Base | 0.8 | 90 | 4,000 | 2,000 | **23** |
| 5,000 | Base, conservative rate | 0.8 | 70 | 4,000 | 2,000 | 29 |
| 5,000 | High | 1.2 | 90 | 6,000 | 3,000 | 34 |

Food tills (r_food = 60):

| Attendance | f low 0.10 | f base 0.15 | f high 0.25 |
|---|---|---|---|
| 2,000 | 4 | **5** | 9 |
| 5,000 | 9 | **13** | 21 |

Reading the table honestly:
- 6-10 tills in total is NOT enough for 5,000 people at base assumptions. Ten drinks tills at base serve about 10 x 90 x 2 = 1,800 drinks/hr, which is about 2,250 attendees at d = 0.8.
- At 2,000 people, about 9 drinks + 5 food tills is the base need, so 6-10 tills total only works if the demand is at the low case, or if vendors take only part of the crowd (s < 1), or if you apply the levers below.
- Levers that change the answer most: (1) raise k with combos (3-drink buckets); (2) pre-sold tokens/QR cut service to about 11 s and r to about 180 [P]; (3) separate order point from pick-up so pourers do not block the cashier; (4) roaming cashiers with handhelds [S4 recommends]; (5) cap the menu. If r rises from 90 to 180, 5,000-attendee base need falls from 23 to about 12 drinks tills.
- Recommendation: agree the real attendance and s with Omakase now; if A is above 3,000 and s is near 1.0, plan on 14+ drinks tills or tokens. This is the most decision-critical open question.
- Queueing reference: [PK] Little's law (queue length = arrival rate x wait) and multi-server queue behaviour; I did not open a source for it. S1 and S13 give only illustrative wait times.

---

## 2. What makes event tills fast: 12 rules

1. **Cut the menu.** Handful of best-sellers so cashiers do not scroll; one BBQ stall reportedly went from 12 items to 5 (S4 [V] for the advice; the stall story [2H]). Cap at 3-5 mains per stall (S13 [V], author's suggestion, unsourced). Nimbus: single screen, no scrolling, no category drill-down.
2. **Big tiles or hotkeys.** S4 [V]: programmable hotkeys or product photos on the POS screen.
3. **No modifiers at the till.** Sell "Beer", not "Beer, cold, with lime, no ice". Mix variants as separate tiles only if there are very few. [PK/P], consistent with rules 1-2.
4. **Preset combos.** Bundles raise k (drinks per transaction), which is the strongest throughput lever in the formula. [P]; S1 gives a "two-drink-per-order rule" as an illustrative pacing example [2H].
5. **Round prices.** Prices in multiples of UGX 1,000 or 5,000 avoid change-making and speed cash (S5 [2H] shows cash is 15-30 s versus 2-3 s for tap). [P] for the rounding itself.
6. **Standardise names, categories and prices across booths** (S4 [V]).
7. **Split roles: one person takes order and payment, runners or pourers fill it** (S4 [V]). Position the POS on the customer side and pick-up a step away (S4 [V]); separate order and collection sides for food (S13 [V], no distances given).
8. **Single-file line feeding several cashiers, with barriers or floor markers** (S4 [V]).
9. **Customer-side payment device and "have your money ready" signage.** S4 [V]: keep the payment device within the attendee's reach, signage asking people to have card or wristband ready; let attendees pay on a side pad while the cashier serves the next person.
10. **Pre-pour and pre-prepare before the rush** (S4 [V]). Pre-pour beer into cups in the 30-45 min before main-stage sets (S12 [2H] says alcohol sales spike then).
11. **Floating supervisors and roaming handheld staff to serve the line and satellite points to spread demand** (S4 [V]). Supervisor also approves voids so cashiers never leave the till.
12. **Pre-printed QR codes or tokens for pre-sold bundles** and a printed MoMo QR/merchant code on big signage (S6 [2H] recommends a QR path as more robust than real-time USSD on poor links). Pre-orders and off-peak promotions smooth demand (S4 [V]). Tokens are the lever that most reduces per-transaction time (section 1d). Pre-pay and clear signage so card, cash and MoMo lanes are separate [P]: a dedicated cash-only or MoMo-only till stops one slow tender blocking the rest.

Bonus: shade and task lighting so staff can operate devices quickly (S4 [V]).

---

## 3. Failure cases: risk register

Likelihood and cost ratings are [P] unless a source is named. Cost formula: lost sales per hour = live tills x tx/hr x average basket. Example [P] only, basket UGX 20,000 UNKNOWN: 9 tills x 90 x 20,000 = about UGX 16.2M per hour of full outage.

| # | Scenario | Likelihood | Cost | Control |
|---|---|---|---|---|
| 1 | Mobile network congested; cloud POS cannot reach server | High (S5 [2H]: rural towers overwhelmed by 10,000-50,000 extra phones; S8 [V]: connectivity is the most common outage cause) | Up to full-till stoppage; S9 [V] says a 5-minute outage can cost "thousands" | Local-first POS: sells and queues offline; own LAN and router; dual-SIM (section 4); outage script and 10-minute blackout drill (S3 [V]) |
| 2 | Single router or Wi-Fi access point dies | Medium | Whole site on local LAN stops | Two routers, spare AP, UPS; tablets with cellular fallback; spare pre-configured devices (S3 [V]) |
| 3 | Tablets run out of battery | High over a 6-10 hr shift | One till lost per tablet | Power bank or charging dock per till, swap schedule, spares at least 10% (S4 [2H]) |
| 4 | Bank card terminal offline or declines (own SIM, same congested network) | High | Card share of sales (assumed 25%) pushed to cash or MoMo, longer queues | Spare terminals; dual-SIM or Wi-Fi terminals if bank allows; offline cap per card is a vendor feature (S3 example £50 [V]); whether Ugandan acquirers allow offline authorisation UNKNOWN; sign "card down, cash or MoMo" |
| 5 | Mobile money prompt fails or confirms late; customer says paid, till shows nothing | High (S6 [2H]: 10-18% fail on slow links; confirmation about 22-45 s) | Slow lines, disputes, loss if drink given before confirmation | Serve only after confirmation; cashier checks merchant SMS or app; retries 15/30/60 s apart and check status before retry (S6 [2H]); QR fallback; supervisor handles disputes |
| 6 | MTN or Airtel network or merchant platform outage | Low-medium | Loses that wallet's share (assumed 12% each) | Accept both MTN and Airtel; cash and card fallback; check status with provider before event (details UNKNOWN) |
| 7 | Cash shrinkage, miscount, wrong change at speed | High | Typically small per till but accumulates; no benchmark found | Float count at open and close; drops; round prices; pre-counted bags; variance review (section 5). S11 [V] lists register mistakes, missing cash bag, skimming as causes |
| 8 | Staff theft, void abuse, no-sale drawer opens, free drinks to friends | Medium | UNKNOWN; hits margin and trust | Individual PINs; supervisor-PIN for voids; void/discount rate KPI per cashier; spot checks; stock-vs-sales variance. S11 [V]: example of 100 cocktails sold vs 120 bottles depleted |
| 9 | Stock-outs (water, ice, popular brand, cups) | High | Lost sales plus angry crowd; S11 [2H] cites water sold out by 8 PM at one bar | Opening stock count; reorder points per SKU; runner to store; live low-stock alert; sell-out mark in POS so tile greys out |
| 10 | Double charging (card tapped twice, MoMo re-prompt, offline replay on sync) | Medium | Refunds, chargebacks, sponsor embarrassment | Idempotency keys per attempt; check payment status before retry (S6 [2H]); encrypted data and timestamps catch duplicates on sync (S3 [V]); refund only to original tender with supervisor |
| 11 | Offline sync loses or duplicates transactions; counts differ from server | Medium | Reports wrong; S3 [V] example 500 pints poured vs 490 payments registered | Count check device vs server after each outage; re-sync stragglers (S3 [V]); unique transaction IDs |
| 12 | Power failure at site or generator fails | Medium | All devices eventually down; S3 [V] Galway: vendor on battery kept selling while neighbours scrambled | UPS for router/switch/server; power banks; fuel check; ask venue for dual feeds |
| 13 | Storm or heavy rain damages devices; tower knocked out | Medium | S5 [2H]: unnamed northern NSW festival, about Feb 2026, thunderstorm took out the tower, payments down 45 min, about 5,000 people affected; a cashbox pizza truck kept trading | Rain covers, tents (S3 [V]), paper and cash fallback, waterproof bags |
| 14 | Crowd surge, queue crush, aggression at the counter | Medium | Safety risk and staff walk-offs | Barriers and single-file lines, security at tills, pre-event "tap and go" signage; stop-sale authority sits with organiser |
| 15 | Large cash accumulating at tills; theft or robbery | Medium | Potentially large | Scheduled cash drops to a manager and safe, tamper-evident bags, escorted movement |
| 16 | Counterfeit notes or wrong denominations | Low-medium | UNKNOWN | Training, UV pen, small float of coins/small notes, refuse damaged notes |
| 17 | Card scheme not captured, so sponsor KPIs (Visa share) cannot be reported | High unless designed for (card terminals are separate from the POS) | Sponsor report incomplete | Cashier taps a "Visa / Mastercard / other" sub-tender at the POS, or import the bank terminal batch report (details with the card-scheme agent) |
| 18 | Serving intoxicated customers or minors | Medium | Licence and reputational; S1 [2H] cites a Swedish study where 27% of staged intoxicated patrons were served | Organiser licence conditions, ID checks, serve limits, supervisor refusals logged (void reason "refused") |
| 19 | Device or cash theft, device lost | Low-medium | Replacement and disruption | Device lock, remote sign-out, tethers or lanyards, serial register |
| 20 | Known past incidents for context | n/a | S3 [2H]: Reading Festival 2021 (year only), card machines down and stalls turned customers away; Download Festival 2015, an RFID system crashed and fans could not buy water or food. No primary source opened | Use as training anecdotes only, not as verified facts |

---

## 4. Offline practice

What event vendors describe (all [V] vendor claims unless noted):
- Local-first POS that stores transactions and syncs on reconnect; staff verify offline counts match server (S3, S8, S9).
- Open-loop mobile POS (Square, Zettle) queues card swipes locally until signal returns; closed-loop RFID keeps balance on the wristband so no network is needed to authorise (S3). Nimbus is neither; it needs its own queue.
- Offline spending cap per customer (example £50) and transaction limits until connectivity returns (S3, S8).
- A segregated, secure payment network separate from festival-goer traffic; multiple connectivity paths: Wi-Fi, 4G/5G routers, backup SIMs from different carriers; UPS; real-time monitoring of transaction success rate, latency and device connectivity (S8).
- Staff outage script: recognise, switch to offline, communicate, escalate, keep serving (S3). 10-minute simulated blackout as a drill (S3).
- Paper fallback and a manager decision on temporary cash or IOU vouchers in a full failure (S3).
- Nightly reconciliation of sales against inventory and cash (S3).

Architecture for Nimbus POS [P]/[PK]:
- Whether Nimbus POS today supports offline sales, a persistent local queue, idempotent sync and conflict-safe IDs is UNKNOWN (the code-audit agent covers it). Minimum viable: tablets keep the order and a client-generated unique ID in local storage; sync with retry; server rejects duplicate IDs.
- Better: a small local server (laptop or mini-PC on UPS) on the site LAN that tills talk to, which then syncs to the cloud. Tills keep working with the internet down. Dependence on the venue's public Wi-Fi is zero.
- Mobile money and card are not offline-capable by nature: MoMo needs the network; bank terminals have their own links. Plan "network down" as "cash only plus offline queue", and say so on signage.
- Starlink: availability, licensing and venue approval in Uganda UNKNOWN (not searched). Treat as optional; verify before relying on it.
- Multi-SIM: use MTN and Airtel data SIMs in dual-SIM routers. Both may still saturate if the same tower is overloaded. Ask the venue about fixed fibre or point-to-point link and ask a carrier for a temporary cell on wheels (S3 mentions carriers bringing COWs [V], without detail).

Kit list for a 6-10 till site (quantities for 10 tills; scale down) [P] unless noted:

| Item | Qty | Notes |
|---|---|---|
| POS tablets (configured, Nimbus logged out) | 10 + 2 spare | Spare at least 10% (S4 [2H]); label per till |
| Tablet stands / cases | 12 | Anti-slip, theft tether |
| Power banks 20,000 mAh+ | 12 + 4 spare | Or mains charging dock at each till |
| Multiport charging hubs, extension cords, surge protectors | 6 | Weather-proof where outside |
| 4G/5G dual-SIM routers | 2 + 1 spare | One per vendor zone; MTN + Airtel SIMs |
| Backup data SIMs with bundles (each carrier) | 4 | Check balance the day before |
| Local server (laptop or mini-PC) + UPS | 1 + 1 spare | On site LAN |
| PoE switch, Wi-Fi access points, Ethernet cables | 1 + 2 + spare | Hidden SSID for tills only |
| UPS for router, switch, server | 3 | S3, S8 [V] |
| Bank card terminals (from acquirer) | 1 per card-accepting till + 2 spare | Spare paper rolls; other agent covers banks |
| Receipt printers | None at tills by default | Customers rarely need receipts; offer SMS or none. One thermal printer per food kitchen for order tickets, if Nimbus supports printing (UNKNOWN) |
| Cash floats | per till; amount UNKNOWN | [P] about UGX 300,000 in small notes per till; set when prices are final |
| Cash boxes, tamper-evident bags, safe or lockbox | 10 + 1 | Count table, calculator, counterfeit pen |
| Lanyards / ID per role | 1 per staff | Colour by role (cashier, pourer, runner, supervisor, tech) |
| Paper backup | pre-numbered order pads, pens, clipboards, IOU forms | S3 [V] pads and pens |
| Signage | menu boards, "card/cash/MoMo", printed MoMo QR | Big, readable at distance |
| Radios or WhatsApp group | 1 per supervisor | |
| Tents, rain covers, waterproof bags | as needed | S3 [V] |
| Tool kit | tape, zip ties, headlamps, spare cables | |
| Generator and fuel | UNKNOWN who supplies | Ask Omakase and venue |

---

## 5. Staffing and controls

Sources: S11 [V] for cash-up; the rest is [PK]/[P] standard retail control practice.

- **Logins:** each cashier has an individual PIN, never shared; role-based rights (cashier, supervisor, manager). Auto-logout after idle time. Shift start and end recorded.
- **Floats:** two-person count at issue, signed; same float for every till; record denomination breakdown. Cash drops to a manager when till cash passes a threshold [P], recorded with bag number.
- **Staff per till** [P]: 1 cashier plus 1-2 pourers or runners (drinks); 1 supervisor per 4 tills; 1 cash controller; 1 roaming technician per site. For contrast, S7's festival example is 1 bartender per 60-75 attendees [2H].
- **Voids, refunds, discounts:** only with supervisor PIN; reason code required; refunds only to the original tender; discounts only from preset buttons; every void and no-sale reported by cashier. Void/discount rate per cashier is a KPI (section 6).
- **Cash-up per till per shift:** close the register, print or export the till Z-report, count cash blind (counter does not see expected), compare with POS cash total, record variance; two signatures. S11 [V]: physically count drawers and batch card terminals before staff leave; vendors sign off.
- **Tolerance:** S11 gives no numeric threshold. [P] investigate any till with cash variance above 0.5% of the till's cash sales or above a fixed UGX amount to be agreed.
- **End-of-night reconciliation (three-way):**
  1. Cash: sum of counted cash across tills = POS cash tender total, minus drops and floats.
  2. Card: bank terminal batch or settlement report per terminal = POS card tender per till. Settlement can lag 1-3 business days (S5 [2H]).
  3. Mobile money: provider merchant statement (MTN and Airtel) = POS mobile money total.
  Any difference goes into a variance register with owner and resolution. Also stock check: units sold vs stock depleted (S11 [V]) and offline queue count equals server count (S3 [V]).
- **Close:** vendors sign off settlement statements and records are archived (S11 [V]).
- **Tax receipts:** whether the vendors need URA EFRIS-compliant e-receipts is UNKNOWN, not researched; confirm with Omakase and the vendors.

---

## 6. KPI dictionary (25 metrics)

Required data per transaction: transaction ID, timestamp, till, cashier, vendor, line items (SKU, quantity, price, category, brand), tender, card scheme and network where applicable, status (complete, void, refund), discount, offline flag.
Tags: **[B]** needs item brand tagging; **[S]** needs card scheme capture; **[A]** needs attendance data from the organiser; **[K]** needs stock counts.
Metric style follows what Howler (S10 [V]), Ticket Fairy (S4 [V]) and Intellitix (S2 [V]) publish: total sales, transactions, average spend, sales per hour, top 10 products and stations, sales by ticket type, vendor performance, stock depletion.

| # | KPI | Formula | Tag |
|---|---|---|---|
| 1 | Gross sales | Sum of line value of completed transactions before discounts | |
| 2 | Net sales | Gross sales - discounts - refunds | |
| 3 | Transactions | Count of completed transactions | |
| 4 | Average basket | Net sales / transactions | |
| 5 | Items per basket | Sum of quantities / transactions | |
| 6 | Sales by payment method | Net sales grouped by tender: cash, card, MTN MoMo, Airtel Money; also as % of net | |
| 7 | Card share | Card net sales / net sales (also by transaction count) | |
| 8 | Scheme share | Visa (or Mastercard, other) card net sales / card net sales | [S] |
| 9 | Visa average basket vs cash average basket | (Visa net / Visa transactions) and (cash net / cash transactions); ratio of the two | [S] |
| 10 | Items per basket by payment type | Sum of quantities by tender / transactions by tender (and by scheme for Visa) | [S] for Visa row |
| 11 | Mobile money share | MoMo net sales / net sales, split MTN vs Airtel | |
| 12 | Top 10 items | Rank SKUs by units and by revenue | |
| 13 | Top brands by category | Within each category (whisky, gin, beer...), rank brands by units and revenue | [B] |
| 14 | Brand share of category | Brand units / category units | [B] |
| 15 | Sales per hour curve | Net sales per 15-min or hourly bucket by timestamp | |
| 16 | Peak hour and peak 15 minutes | Bucket with maximum net sales; also max transactions per minute | |
| 17 | Sales per till and per cashier | Net sales and transactions per till ID and cashier ID; transactions per hour worked | |
| 18 | Vendor split | Net sales by vendor (food vs drinks) / total net | |
| 19 | Attach rate (food with drinks) | Customers buying both / customers buying drinks. Needs a customer link (shared token, wristband, phone number), so with separate vendors it is UNKNOWN. Proxy: food transactions / drinks transactions per hour | proxy only |
| 20 | Void rate and refund rate | Voids (count and value) / transactions; refunds value / gross; per cashier | |
| 21 | Discount and comp rate | Discount value / gross sales | |
| 22 | Stock sold vs brought | Units sold / (opening + received) per SKU; variance = opening + received - closing - sold | [K] |
| 23 | Trading window | Time from first sale to last sale; sales per trading hour | |
| 24 | Average service time (proxy) | Median time between consecutive transactions per till at peak; better, order-start to paid if the POS stamps both | |
| 25 | Spend per head | Net sales / attendance; also tx per attendee | [A] |

Extra operational KPIs worth tracking (not counted above): payment failure rate (failed attempts / attempts per tender, S6 [2H] benchmark 10-18% for MoMo), offline minutes and % of transactions made offline, cash variance % per till.

Sponsor-relevant (Visa) cluster: 7, 8, 9, 10 need scheme capture; whether tap versus insert versus swipe can be captured is UNKNOWN (depends on bank terminal reports).

---

## 7. One-page sponsor report and live dashboard

### One-page sponsor report (layout in words)
Top band: event name, date, venue, trading hours, organiser and sponsor logos, a one-line headline ("X transactions, UGX Y net sales, Z% by card, Visa share W%").
KPI strip of 6 numbers: net sales, transactions, average basket, card share, Visa share of card, peak hour.
Left half: sales-per-hour chart with peak marked, and sales by payment method as a single stacked bar.
Right half: "Visa panel" with Visa transactions, Visa average basket vs cash average basket, items per basket by tender.
Lower band: top 10 items table plus top brand per category (whisky, gin, beer) and food vs drinks split.
Footer: data notes (what was captured, offline periods, how scheme was identified, any gaps), method and reconciliation status (cash, card, MoMo reconciled yes/no), contact. Keep claims to what the data shows; do not publish uplift versus cash unless the comparison is like-for-like.

### Live dashboard (10 tiles) [P]
1. Net sales so far (running total) and vs target.
2. Sales per 15 minutes line with the current peak marker.
3. Transactions and transactions per minute right now.
4. Payment mix: cash, card, MTN, Airtel.
5. Visa and scheme share of card sales (needs scheme capture).
6. Till status board: online/offline, last-sale age, transactions per hour, queue flag.
7. Vendor split: food vs drinks.
8. Top items and low-stock alerts.
9. Voids, discounts, refunds with per-cashier outlier flag (organiser only, not sponsor).
10. Sync and connectivity health: pending offline queue, last successful sync, devices offline.
Sponsor view shows tiles 1-5 and 7; organiser view shows all. S2 and S4 [V] list similar live views (sales, vendor performance, near-capacity vendors, line formation).

---

## 8. Run sheet (T = event day)

**T-14 to T-12:** Confirm attendance estimate, s (share of crowd served), number of tills (section 1), venue power, venue connectivity, layout and queue zones. Lock menus, prices (round), combos and SKU list with brand and category tags. Confirm tender setup: bank terminals delivered, MTN and Airtel merchant accounts live. Confirm legal items (EFRIS, licences). Order kit. Decide cash float amount.
**T-11 to T-8:** Configure devices, user accounts, PINs, roles, tills, vendors. Load menus. Enable offline mode and test it. Set up card scheme tagging at tender and brand tags. Draft the dashboard and the report template with the sponsor.
**T-7:** Staff recruitment confirmed; training pack; cash procedures; outage script. Freeze menu and code (change freeze unless a critical bug).
**T-6 to T-5:** Staff training session with role-play: sell, void, refund, MoMo failure, card down, offline. Dry run at an office or similar site, timing each tender (replace [P] service times with measurements).
**T-4:** Load test: simulate peak transaction rate on all tills and local server at once; 10-minute network blackout drill and reconnect (S3 [V] drill); check duplicate handling. Fix and retest.
**T-3:** Pre-event packing, label devices, charge everything, SIMs topped up, backups on spare devices, printed signage and QR.
**T-2:** Site recce or early access: Wi-Fi/router placement, signal check on MTN and Airtel at tills, power points, lighting, cash room.
**T-1:** Build site. Test every till end to end including a small real payment per tender. Stock count signed. Floats counted and issued plan ready. Final briefing.
**T (event day):** Open early. Float issue with two-person count; opening stock. Hourly check: sync health, battery swap, stock, cash drop. Pre-pour before headliner. Outage script on standby. Monitor dashboard. Log every incident with time. Last sale then close tills, cash-up per till, Z-reports, three-way reconciliation (section 5), stock count, secure cash in safe or bank drop, back up data, sign-offs.
**T+1:** Bank terminal batches and MoMo statements reconciled; variance register closed or escalated; refunds done; export data. Preliminary numbers to organiser.
**T+2:** Final one-page sponsor report and organiser report delivered; incident log; debrief; archive records (S11 [V]). Settlement per vendor agreements.

---

## 9. The ten facts I am least sure of

1. Per-till transactions per hour: no sourced benchmark found. 90/hr (drinks) and 60/hr (food) are [P] from my timing assumptions. Measure in the dry run.
2. Mobile money prompt approval time in Uganda at a crowded venue: UNKNOWN. The 22-45 s and 10-18% failure figures come from an unverified marketing blog (S6) with no method.
3. Cash with change takes 15-30 s: from S5, unsourced.
4. Drinks per head per peak hour (0.8 base): no event source opened; it is a [P]. It drives the till count more than anything else.
5. Real attendance and how much of it the two vendors serve (s): UNKNOWN. If there are other bars, till needs fall; if not, 6-10 tills is short for 5,000.
6. Tender mix at a Kampala concert (cash, card, MTN, Airtel): UNKNOWN; 50/25/25 is [P].
7. Whether Nimbus POS has real offline mode, a local queue, idempotent sync: UNKNOWN (code audit agent).
8. Starlink legality/availability and whether Ugandan bank terminals or MoMo can work offline: UNKNOWN; not researched. Bank terminals' scheme capture is with the card-scheme agent.
9. Past incidents (Reading 2021, Download 2015, the northern NSW storm outage) are second-hand, unnamed or undated, and sit in vendor-marketing blogs; the 15-30% spend uplift and "up to 50%" faster claims are unsourced.
10. Tax and licensing: URA EFRIS receipt requirement for the vendors, alcohol licence conditions, and any sponsor data-sharing or privacy duties in Uganda are UNKNOWN. Not researched.
