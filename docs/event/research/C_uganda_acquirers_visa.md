# C. Uganda card acquirers, PSP terminals and Visa sponsorship — market research

Prepared 18 Nov 2026 for Nimbus POS / Omakase (Visa-sponsored concert, Kampala). All pages read 18 Nov 2026 unless stated.

## Evidence marks

- **[V]** I opened the page myself and the claim is on it. Where the page is press rather than the provider's own site, I say "press".
- **[2H]** Second hand: seen only as a search-result title/snippet, or a page I could not open.
- **[PK]** My prior knowledge (training data up to mid-2026), not re-checked today.
- **[P]** My inference from the evidence. Treat as a hypothesis to confirm.
- **UNKNOWN** Not found. I have not guessed.

Research budget was about 30 searches/page reads. Most bank sites were NOT opened individually (Stanbic, Equity, KCB, Centenary, Standard Chartered, I&M, NCBA, Ecobank, Housing Finance); their rows are mostly [PK]/UNKNOWN and say so.

## Headline findings

1. **"Direct integration with Visa" is not a route a merchant POS can take.** Visa does not give merchants or POS vendors a transaction feed; the data path is terminal -> acquirer (bank/PSP) -> Visa. [PK] What Nimbus needs is (a) the acquirer's transaction report or callback, and (b) its own tender record per sale. Visa can already see its own card volume at the event's merchant IDs; it cannot see Mastercard, cash, mobile money or basket items. Only the POS can supply those. [P]
2. **Pesapal is the only provider for which I found public documentation of a terminal -> third-party-system callback that carries the card scheme.** Its POS "Wireless Connection" doc shows an HTTP POST to the merchant's URL after each successful terminal payment with `"payment_option":"Visa"`. [V]
3. **Absa Uganda publicly offers an "Integrated POS (PinPad)"** "Designed for ease of integration into a retailer's cash till systems", and accepts Visa, Mastercard, Maestro, Amex and UnionPay. No public spec. [V]
4. **Visa is publicly tied to a Kampala concert on 28 Nov 2026**: Joshua Baraka's "B'rakaland EA" at Lugogo Hockey Grounds (Visa named him its first Ugandan brand ambassador on 5 Nov 2026). [V, press] If this is the client's event, the lead time is 10 days, not 2-3 weeks. [P] I have not confirmed it is the same event.
5. **Visa's named contact for Uganda**: Victor Makere, Country Manager for Tanzania, Uganda, Rwanda and Burundi. [V, press]

---

## 1. Who provides card POS terminals to merchants in Uganda (as at Nov 2026)

| Provider | Terminal type | Schemes | API / POS-ECR integration | Portal/report showing card scheme | Stated fees (MDR) | Onboarding / KYC |
|---|---|---|---|---|---|---|
| **Absa Bank Uganda** | Electronic POS (WiFi/GPRS), mPOS (GPRS/3G standalone), Integrated POS (PinPad); SoftPOS "Mobi Tap" (2023) | Visa, Mastercard, Maestro, Amex, UnionPay [V] | YES in principle: Integrated POS "Designed for ease of integration into a retailer's cash till systems" [V]; spec not public | "Access to detailed POS batch reports to help with reconciliation" [V]; scheme column UNKNOWN | Not published [V] | Form on site, "we will contact you" [V]; time UNKNOWN |
| **DTB Uganda** | POS machine with MoMo pay on it | Visa, Mastercard [V] | Not mentioned [V] | No portal mentioned; "all transaction statements are shared via email on daily basis" [V]; scheme column UNKNOWN | "Merchant service fee is between 2%-2.5%"; no monthly charge [V] | IDs, photos, incorporation cert, MemArts, TIN, trading licence, Form 7/20, settlement account [V]; time UNKNOWN |
| **dfcu Bank (with Pesapal)** | Pesapal terminals, NFC, dual network | Visa, Amex, Mastercard + mobile money [V] | "POS integration" listed as feature [V]; see Pesapal | "Superior reconciliation and reporting" [V] | Machine UGX 550,000 one-off; MDR not on page [V] | Incorporation/registration cert, URA TIN, director ID, UGX and USD accounts [V]; time UNKNOWN |
| **Pesapal Uganda** (licensed PSP) | Connected POS (SP630 Pro, Android smart), Mobile POS / Mini-POS (Sabi mPOS, pairs with phone) [V] | Visa, Mastercard [V]; mobile money per meta description [V]; Amex via dfcu [V]; UnionPay UNKNOWN | YES: "Integrate with any 3rd party POS system" [V]; developer docs public (section 2) | "Access real-time reports on one dashboard" [V]; callback carries scheme [V] | Not published [V] | "Same Day Setup", "Next Day Settlement" [V]; KYC not on page |
| **Stanbic Bank Uganda** | Traditional and Android POS [PK]; FlexiPay wallet/merchant pay [2H] | Visa, Mastercard, UnionPay [PK] | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN. Large event track record via FlexiPay (Kampala Restaurant Week, Afrigo at 50, Jazz Safari) [2H/V press] |
| **Equity Bank Uganda** | Traditional/Android POS [PK] | Visa, Mastercard [PK]; Amex/UnionPay UNKNOWN for Uganda | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| **KCB Bank Uganda** | POS [PK] | Visa, Mastercard [PK]; Verve possibly [2H, may be Kenya] | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| **Centenary, Standard Chartered, I&M, NCBA, Ecobank, Housing Finance** | UNKNOWN whether each actively acquires merchants in Uganda; not opened | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| **Interswitch East Africa (Uganda)** | Switch/processor; terminals reach merchants mainly through member banks [PK] | Verve plus bank-dependent [PK] | Developer APIs exist for online/Quickteller [PK]; card-present Uganda UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| **DPO Pay (Network International)** | Online gateway; card machines in some markets [PK]; Uganda terminal availability UNKNOWN | Visa, Mastercard, Amex online [PK] | Online API yes [PK]; terminal UNKNOWN | Portal yes [PK]; scheme column UNKNOWN | UNKNOWN | UNKNOWN |
| **Flutterwave Uganda** | Online only as far as I know [PK]; holds a Ugandan payments licence [2H] | Visa, Mastercard online [PK] | Online API yes; no Uganda card terminal known [PK] | Dashboard yes [PK] | UNKNOWN for UG | UNKNOWN |
| **MTN MoMo Pay / Airtel Money merchant** | Merchant code (USSD/QR), not card terminals | Mobile money only (card acceptance not mentioned on MTN merchant page [V]) | MTN MoMo Open API collections [PK] | UNKNOWN | MTN: merchant receives full amount, no charge [V] | MTN: self-register by USSD *165*17#, code by SMS [V] |
| **Yo! Payments, Xente, Tingg/Cellulant** | Online/mobile money aggregation; no card terminals known [PK] | n/a | Online APIs [PK] | n/a | UNKNOWN | UNKNOWN |
| **Kazang** | Not known to operate in Uganda [PK] | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| **SafeBoda and others** | Not relevant to card-present acquiring [PK] | | | | | |

Sources:
- Absa: https://www.absa.co.ug/corporate-and-investment/merchant-services/
- DTB: https://dtbu.dtbafrica.com/service/DTB-POS-Acquiring
- dfcu/Pesapal: https://dfcugroup.com/business-banking/dfcu-pesapal-partnership/
- Pesapal UG POS: https://www.pesapal.com/ug/business/pos
- MTN merchant: https://mtn.co.ug/momo/merchant/
- Flutterwave licence (title only, 2H): https://finextra.com/pressarticle/102048/flutterwave-expands-african-footprint-with-ugandan-payments-licence
- KCB/Verve (title only, 2H): https://myverveworld.com/blog/verve-benefits-are-now-activated-for-kcb-merchants-and-pos-payments-are/

---

## 2. Documented ways for a third-party POS to trigger a terminal payment or receive a callback with card type

### Pesapal — YES, documented (the strongest find)

**POS overview** (https://developer.pesapal.com/how-to-integrate/point-of-sale/api-reference) [V]:
- Wireless Connection: Sabi machines send transaction data over the internet by an "HTTP POST REST (Representational State Transfer) API"; the merchant gives Pesapal an SSL URL and Pesapal posts to it for each successful payment.
- Wired Connection: the till's host computer is cabled to a PDQ/PinPad, sends the transaction request to the device and gets a response. Access is restricted; documentation is given on request to Pesapal support after you hold a developer account.

**Wireless Connection** (https://developer.pesapal.com/how-to-integrate/point-of-sale/wireless-connection) [V]:
- "Pesapal will then initiate an HTTP POST request to the merchant system".
- Notification sample fields include `"id":10463`, `"amount":1.0`, `"payment_option":"Visa"`, `"currency":"KES"`, `"confirmation_code":"test10"`.
- Field description: `payment_option` "Represents the payment option used by the customer e.g. Visa, MasterCard, Mpesa".
- Pesapal sends Consumerkey/Consumersecret headers; your endpoint returns `"status":"200"`.
- Verify by POST to `https://ext.pesapal.com/api/transactions/verifytransaction` with an `APIKey` header (key issued after you give Pesapal your server IP). Verification sample includes `"payment_option": "MasterCard"`, `"merchant_ref"`, `"transaction_date"`, `"status_description": "completed"`.

Limits [V/P]:
- The wireless flow is terminal-initiated: the cashier keys the amount on the terminal and Nimbus is told afterwards. It is a callback, not a "push amount to terminal" command. Matching to a bill relies on `merchant_ref` or amount+time. How `merchant_ref` is entered on the terminal is not documented. UNKNOWN.
- The sample shows no terminal ID, RRN, masked PAN or auth code. Whether they can be added: UNKNOWN, ask Pesapal.
- Sample currency is KES. Availability of this POS callback for Uganda merchants and UGX: UNKNOWN, though the Uganda POS page says "Integrate with any 3rd party POS system". [V]
- Till-triggered (wired) integration exists but its docs are private.

**E-commerce API 3.0 GetTransactionStatus** (https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus) [V]:
- `payment_method`: "Can be through CARD, MPESA, MTN, TIGO etc."
- Sample: `"payment_method": "Visa"`, `"payment_account": "476173**0010"`, `"confirmation_code": "6513008693186320103009"`.
- `payment_account`: "Masked card number or phone number used during payment."
- So yes, API 3.0 returns the scheme and masked card. But this is the online checkout API, not the terminal path. Whether a Sabi terminal sale is queryable through it: UNKNOWN.

### Absa Uganda — integration offered, not documented publicly
"Integrated POS (PinPad) ... Designed for ease of integration into a retailer's cash till systems" [V]. Protocol, whether the response carries scheme, and lead time: UNKNOWN. In my experience bank integrated-PinPad projects take weeks of certification [PK]; unlikely inside this deadline [P].

### DPO Pay — online only as far as documented
The online verifyToken response includes a card-type field and last four digits [PK, not re-read today]. No terminal trigger/callback doc found for Uganda: UNKNOWN.

### Flutterwave — online only
The verify-transaction response includes `card.type` (e.g. VISA/MASTERCARD), first 6 and last 4 [PK, not re-read today]. No card-present terminal product in Uganda that I know of [PK]. Not useful for bank-terminal payments at tills.

### Interswitch
Developer APIs exist for online payments [PK]. A Uganda terminal-to-third-party-POS interface: UNKNOWN.

### Banks other than Absa
No public developer documentation found for Stanbic, Equity, KCB, DTB or others: UNKNOWN. DTB emails daily statements [V].

---

## 3. Tap to Phone / SoftPOS in Uganda

- **Absa Mobi Tap** launched July 2023: turns an NFC smartphone into a card acceptor for MSMEs; app on Google Play (the article also says App Store); merchants without NFC can buy an Absa Mobi Tap device; card payments go straight to the merchant's Absa account; Absa says it gives a digital record of transactions. Scheme partner, transaction limits, PIN-on-glass, fees and sign-up time are not stated. [V, press] https://pctechmag.com/2023/07/absas-mobi-tap-functionality-turns-smartphones-into-pos-machines/
- **A Ugandan bank launch explicitly branded "Visa Tap to Phone"**: not found. UNKNOWN. My first query "Visa Tap to Phone Uganda" returned contactless-card launches (Stanbic, Absa, Standard Chartered) and Visa Pay, not a Tap to Phone merchant product.
- **Visa Pay Uganda** is a Visa consumer wallet app: send/receive money to mobile numbers and "a Virtual Visa Card at no cost". The page's bank list and FAQ answers were empty when read; merchant acceptance is not described. [V] https://africa.visa.com/pay-with-visa/visa-pay-uganda.html . A Nile Post piece titled "Visa Pay Promises More Innovative Payment Innovations in Uganda" exists [2H, not opened].
- **Events**: an opinion piece by a "Senior Manager, Digital Financial Services" (employer not named) says Milege World Music Festival attendees paid for entry by tapping phones. [V, press] https://www.monitor.co.ug/uganda/oped/letters/digital-payments-are-now-revolutionizing-the-event-scene-5209298
- Phones: NFC Android is the stated requirement for Mobi Tap [V]; minimum Android version UNKNOWN.
- Practical view [P]: SoftPOS is a workable overflow device but poor as the main till terminal at a concert bar: contactless only, limits above which PIN is needed are unknown, and per-device reporting is unknown.

---

## 4. Visa as event sponsor

### What is confirmed for Uganda
- 5 Nov 2026: Visa named singer Joshua Baraka its first Ugandan brand ambassador. Visa "will play a key role" in his B'rakaland EA concert on 28 Nov at Lugogo Hockey Grounds and plans to use it for entertainment and digital payment experiences. Quoted: Victor Makere, Visa Country Manager for Tanzania, Uganda, Rwanda and Burundi. No partner bank and no cardholder perk is named. [V, press] https://allafrica.com/stories/202611060599.html
- Card/wallet-linked ticket discounts are an established pattern in Kampala: Jazz Safari 2017 gold tickets UGX 100,000 by FlexiPay or Visa/Mastercard versus UGX 130,000 cash (Stanbic). [V, press] https://observer.ug/lifestyle-entertainment/jazz-safari-goes-cashless/
- Other titles seen but not opened [2H]: Stanbic 60% off Vumbula Uganda Festival tickets; FlexiPay discounts for Afrigo at 50; I&M Mastercard offer for an ABBA tribute show; dfcu/Visa "Tujaguze" campaign; MTN MoMo partnership with Blankets and Wine 2024; Stanbic FlexiPay at Kampala Restaurant Week.
- Specific Visa deals with Nyege Nyege, Blankets and Wine or the Rolex Festival: not found. UNKNOWN.

### What Visa typically asks for [PK, global pattern; not verified for this event]
- "Official/preferred payment partner" branding at tills and on terminals; at flagship properties (Olympics, FIFA World Cup) Visa is the only card accepted on site.
- Cardholder perks: presale or discounted tickets, a Visa-only fast lane or bar, discounts or freebies when paying with Visa, contactless-first messaging.
- Measurable outcomes: Visa transaction count and value, share of contactless, new-to-card usage, sometimes issuer-bank breakdown.

Ask Omakase for the sponsorship contract's reporting clause. Whether Visa is "preferred" or "exclusive" here changes the till design (if exclusive, Mastercard must be declined or hidden). UNKNOWN for this event.

### What data sponsors get and from whom [PK/P]
- Visa already holds every Visa transaction processed at the event's merchant IDs through its own network. To isolate the event it needs the merchant/terminal IDs and time window from the acquirer.
- The acquirer (bank/PSP) holds all card transactions on its terminals by scheme, time, amount, terminal ID, RRN and auth code. It is the source for "Visa vs Mastercard".
- Nobody but the POS holds cash, mobile money and item-level baskets. "Which items were bought with Visa" can only come from Nimbus POS tagging each sale's tender as Visa and, ideally, storing the slip's RRN/auth code for reconciliation.
- Cardholder identity is not shared with organisers.

### Who to contact
- Visa: Victor Makere's country team (TZ/UG/RW/BI) [V, press]. Visa's East Africa hub is in Nairobi [PK]. A direct Kampala office address/phone: UNKNOWN. Fastest route [P]: the Visa marketing contact already on Omakase's sponsorship thread; ask them to name the acquiring partner for the event and to request fast-track terminals.
- Acquirers: Absa merchant services (form on page) [V]; dfcu 0800 222000 [V]; Pesapal Uganda (pesapal.com/ug) [V]; DTB [V]; Stanbic UNKNOWN contact.

---

## 5. Mobile money at events (brief)

- **MTN MoMoPay**: merchant self-registers by USSD *165*17# or *155#; merchant code arrives by SMS; receiving is free: "No, you will not be charged. You will receive the full amount paid by the customer." Paying another merchant has a banded flat tariff from 25 (1-2,500) to 2,000 (1,000,001-5,000,000), currency not stated on page (UGX presumably [P]). [V] https://mtn.co.ug/momo/merchant/
- Customer-side fee for paying a merchant: not stated on that page; UNKNOWN. Merchant cash-out/bank sweep fees: UNKNOWN.
- Confirmation: SMS to the merchant line, plus the customer's SMS [PK]. At a loud, congested venue SMS delay is the main operational risk [P]; cashiers should confirm on the merchant handset, not the customer's screen.
- **API**: MTN MoMo Open API (momodeveloper.mtn.com) has a Collections product: request-to-pay prompt to the customer's phone, status polling and callback [PK]. Production keys need MTN Uganda go-live KYC; realistic lead time is longer than this event allows [PK/P]. Aggregators (Pesapal, Yo!, Flutterwave, DPO) expose MTN/Airtel collections through one API [PK].
- **Airtel Money / Airtel Pay**: merchant codes and an Airtel Africa developer API for collections exist [PK]. Fees and onboarding: UNKNOWN (not opened).
- Pesapal and DTB terminals also take mobile money on the same device [V], which would bring MoMo into the same report.

---

## 6. Regulation in brief

### National Payment Systems Act, 2020 (Act 15) — text read on ULII, version dated 4 Sep 2020
https://ulii.org/en/akn/ug/act/2020/15/eng@2020-09-04 [V]
- s.6(1): "A person shall not offer a payment service, operate a payment system or issue a payment instrument without a licence issued by the central bank in accordance with this Act."
- s.1: "payment service provider" is "a person who is licensed under section 9 of this Act to provide a payment service." "payment service" lists categories including "services enabling cash deposits or withdrawals" and "execution of payment transactions." "payment system" is "a system used to effect a transaction through the transfer of monetary value".
- s.8(1)(e) makes "provision of technological services to facilitate switching, routing, clearing or data management" a licensable payment-system object.
- No express exemption for software vendors that do not touch funds.

Reading [P]: a POS that only records that a sale was paid on a licensed bank's terminal does not execute payment transactions, hold funds, issue instruments, switch, route or clear. On the plain words it is not offering a payment service. But "data management" in s.8(1)(e) is broad, and there is no explicit carve-out, so the formal answer is **UNKNOWN**; I found no Bank of Uganda guidance either way. If Nimbus later receives callbacks or drives terminals, it acts as the merchant's software vendor under the acquirer's licence [P]. Amendments after 2020 and the 2021 Regulations were not read: UNKNOWN.

### Data Protection and Privacy Act, 2019
Not opened today; everything here is [PK]/[P].
- The Act covers information from which a person can be identified, and requires collectors/processors of personal data to register with the Personal Data Protection Office (under NITA-U). [PK]
- Card brand plus last 4 digits, with no name or phone, does not identify a person on its own; risk is low [P]. Combined with time, terminal and basket it is still not identifying without the bank's records [P].
- It becomes personal data if linked to a named customer (loyalty, receipts by phone/email, mobile money numbers). Mobile money payer numbers are personal data [P]; keep them out of the Visa report.
- Report to Visa in aggregates only. Whether Nimbus is already registered with PDPO: UNKNOWN.
- Card-data security (PCI) is covered by the other agent.

---

## 7. Practical shortlist: 6-10 terminals on site in under 3 weeks

Ranking is my judgement [P].

### Route 1 — Ask Visa to bring its acquiring bank
Visa is the sponsor and wants Visa volume measured, so it has the leverage to get a member bank to deploy temporary event terminals. Ask the Visa contact which acquirer it works with for this concert. Likely candidates: Absa (five schemes, integrated-till product) [V], Stanbic (event track record) [2H], DTB (published 2-2.5% MDR, daily emailed statements) [V].
- Scheme data: from the bank's next-day batch/settlement report, mapped terminal ID -> till in Nimbus.
- Risk: bank onboarding normally takes longer than 3 weeks unless escalated; settlement account at that bank may be required (DTB says so) [V].

### Route 2 — Pesapal Sabi terminals (direct, or through dfcu)
"Same Day Setup", "Next Day Settlement", Visa and Mastercard plus mobile money, and a documented callback with `payment_option` = Visa/MasterCard [V]. This is the only route with a documented path to automatic Visa tagging in Nimbus POS.
- Risk: callback set-up needs Pesapal to register your URL and issue an API key by server IP; Uganda/UGX support for the POS callback is unconfirmed; dfcu lists a UGX 550,000 one-off per machine [V] (10 machines = UGX 5.5m; rental option UNKNOWN).

### Route 3 — Use terminals the two vendors (or venue) already hold, and capture tender in Nimbus POS
No new onboarding. The cashier picks the tender in Nimbus (Visa / Mastercard / other card / cash / MTN / Airtel) and types the slip's RRN or auth code and last 4. Next morning, reconcile against the acquirer's report by RRN, amount and time. Add one or two SoftPOS phones (Absa Mobi Tap) as overflow.
- This is the fallback that works regardless of provider, and it is the only way to get "items bought with Visa" in every scenario.
- Risk: cashier mis-tagging under pressure; mitigated by the next-morning reconciliation and by making the tender buttons large and scheme-coloured.

Recommended combination [P]: pursue Route 2 and Route 1 in parallel this week, and build Route 3's tender capture now because every route needs it.

### Questions to ask each provider
1. Can we have one terminal per till (6-10), each with its own terminal ID, under one or two merchant IDs (one per vendor)? Can spares be supplied?
2. How many days from signed forms to terminals in hand? Is there a temporary/event merchant arrangement? What KYC do the two vendors (or Omakase as merchant of record) need?
3. Can we get a transaction export by 08:00 the next morning with: card scheme, date/time, amount, terminal ID, merchant ID, RRN, auth code, masked PAN, approved/declined/reversed? In CSV/Excel? From a portal we log into, or emailed?
4. Is there an API, webhook or ECR/integrated-till mode so the POS can receive the result (and scheme) per transaction? What is in the payload? How long to enable it? Sandbox?
5. Can the cashier enter a bill/reference number on the terminal that appears in the report/callback?
6. Offline behaviour: what happens if mobile data drops? Dual SIM / WiFi? Any offline or deferred authorisation and floor limit? Who carries the risk? Will the bank put a technician on site?
7. Contactless limit without PIN; are Amex/UnionPay/Verve switched on; are mobile wallets (Apple/Google Pay) accepted?
8. Settlement: which account, which bank, T+1 or later, UGX only or USD too; can each vendor settle to its own account; weekend/holiday timing.
9. Fees: MDR per scheme (local vs international cards), terminal rental or purchase, deposit, minimum monthly fee, chargeback handling.
10. Can the terminal also take MTN/Airtel mobile money, and does that appear in the same report?
11. For Visa/Omakase: is Visa "preferred" or "exclusive"; what exact report (fields, format, deadline) does Visa want; which acquirer does Visa want used; will Visa fund terminals or cardholder discounts; who applies the discount (POS price rule or bank cashback)?

---

## 8. The ten facts I am least sure of

1. That the client's concert is the 28 Nov B'rakaland EA show. It fits (Visa, Kampala, concert) but the brief says 2-3 weeks, and 28 Nov is 10 days away.
2. That Pesapal's POS wireless callback is live for Uganda merchants in UGX; the doc sample is in KES.
3. That Pesapal's callback can carry terminal ID, RRN or masked PAN; the public sample shows none.
4. Whether any Ugandan bank has launched a Visa-branded "Tap to Phone"; I found only Absa Mobi Tap (2023), scheme partner unstated, and I do not know if Mobi Tap is still actively offered in 2026.
5. Stanbic, Equity and KCB scheme lists, integration options and reporting: prior knowledge only; their sites were not opened.
6. That DPO Pay, Flutterwave, Interswitch and Kazang have no merchant card terminals in Uganda; absence of evidence, not confirmation.
7. "Same Day Setup" from Pesapal is marketing copy; real time for 10 terminals plus KYC for two vendors is unknown.
8. The NPS Act conclusion that a record-only POS needs no licence; it is my reading, with no BoU guidance found, and I did not read post-2020 amendments or the 2021 Regulations.
9. The Data Protection and Privacy Act view on brand + last 4; from memory, Act not re-read.
10. What Visa will actually ask for at this event (preferred vs exclusive, perks, report format); global pattern only, and DTB's 2-2.5% MDR may not reflect what other acquirers or an event deal would charge.

Also uncertain: MTN's customer-side MoMoPay fee and merchant cash-out cost; the Flutterwave and DPO response field names quoted from memory.
