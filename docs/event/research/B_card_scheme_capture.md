# B. Card scheme capture for Nimbus POS (concert tills)

Date read for every URL below: 18 Nov 2026.
Marks: [V] opened and read; [2H] found but not opened or blocked; [PK] from memory, not checked today; [P] my proposal or reasoning; UNKNOWN.
Scope: mechanics only. Which Ugandan bank or PSP, fees, lead times and Visa sponsorship rules belong to the other agent.

Short answer: the POS cannot learn the scheme from the terminal unless the acquirer that owns the terminal cooperates. In 2-3 weeks the workable route is a "Visa / Mastercard / Other" button at the till plus a typed approval code, backed by an after-the-event match against the acquirer's transaction report. There is no "direct integration with Visa" for a merchant till.

## 1. How a card's scheme is identified

| Identifier | What it is | Values | Where it appears | Mark |
|---|---|---|---|---|
| BIN / IIN | Leading digits of the card number (PAN) | Visa: starts with 4. Mastercard: 51-55 and 2221-2720. Amex: 34, 37. UnionPay: 62. JCB: 3528-3589. Discover: 6011, 644-649, 65 | Masked PAN on receipt and in acquirer reports (usually first 6 + last 4) | [PK]. Mastercard's own "BIN account range table" page was linked from https://www.mastercard.com/za/en/personal/get-support/frequently-asked-questions.html but not opened [2H] |
| BIN length | 6 or 8 digits | PCI SSC's truncation FAQ covers both 6- and 8-digit BINs | Affects how many digits may be kept | [V] https://www.pcisecuritystandards.org/faqs/1091/ |
| EMV AID | Application identifier the chip or contactless card selects | A0000000031010 Visa Debit/Credit; A0000000032010 Visa Electron; A0000000033010 Visa Interlink; A0000000041010 Mastercard Credit/Debit; A0000000043060 Maestro; A00000002501 American Express; A0000000651010 JCB; A0000001523010 Discover; A000000333010101 UnionPay Debit | Printed on most chip receipts as "AID"; returned by integrated terminals | [V] https://www.eftlab.com/knowledge-base/complete-list-of-application-identifiers-aid (secondary list, not EMVCo; page read to 100k of 127k characters) |
| Application label | Text name stored on the chip, for example "VISA DEBIT" | Free text set by the issuer | Receipt line near the AID | [PK] |
| Scheme / brand field | Acquirer's own classification | "VISA", "MASTERCARD" and so on | Settlement and transaction reports, integrated-terminal responses | [PK] for reports; [V] for Adyen and Stripe (section 2) |

Which identifier to trust. One nexo/EPAS vendor's developer guide warns that the receipt's card name "is not definitive", calls the IIN "the most reliable way", and notes that the AID exists only for chip and contactless transactions while swipes give only the masked number. [V] https://westpay.github.io/EPAS-Client-Library/articles/identifying_cards.html

What a terminal receipt normally shows [PK, not checked against a Ugandan slip]: merchant name, merchant ID (MID), terminal ID (TID), date and time, amount and currency, masked PAN, application label, AID, entry mode (chip / contactless / swipe), approval (auth) code, RRN (12-digit retrieval reference number), STAN or batch and invoice number, response code.

What an acquirer transaction or settlement report normally shows [PK]: MID, TID, transaction date and time, settlement date, amount, scheme, masked PAN, auth code, RRN, transaction type (sale / void / refund), status, fee. The exact columns for the concert's acquirer are UNKNOWN. Ask for a sample file now.

Caveats [PK]:
- Phone and watch wallets present a device card number, so the last 4 on the slip can differ from the last 4 on the customer's plastic card.
- A card can carry two schemes (co-badged); the AID actually selected decides.
- The physical logo on the card is the weakest signal. A phone shows none.

## 2. Ways a POS can learn the scheme, simplest to deepest

| # | Method | Data you get | Effort | Lead time | PCI impact | Failure modes |
|---|---|---|---|---|---|---|
| a | Cashier taps "Visa / Mastercard / Other" on the POS after reading the terminal slip or screen | Scheme only, self-reported | About 1 dev-day [P] | Days [P] | None: a brand name is not account data [P] | Mis-taps under queue pressure; phone wallets hide the logo; cashiers default to the first button; nothing to audit against |
| b | Cashier types auth code (6 characters), last 4 or RRN from the slip | A join key for later matching; scheme only if also picked | 1-2 dev-days [P] | Days [P] | Last 4 alone is inside PCI SSC's permitted truncation [V, FAQ 1091]; auth code and RRN are not account data [PK]. Never offer a free-text card field | Typing errors; slows the queue (RRN is 12 digits, so prefer the auth code) [P]; skipped when busy |
| c | After the event, import the acquirer's transaction report and match on TID + amount + time (+ RRN or auth code) | Authoritative scheme, masked PAN, auth code, RRN for every card payment | 2-4 dev-days for importer and matcher [P] | Report available after settlement, typically next day [PK]; exact timing UNKNOWN | None if the file holds only masked PANs [V, FAQs 1091 and 1117] | Hand-keyed wrong amounts; clock drift; same amount repeated; terminals shared between tills; voids and reversals; report format unknown until seen |
| d | Semi-integrated ECR: POS pushes the amount, terminal returns the result | Scheme, masked PAN, auth code, reference, receipt lines, in real time | Weeks, plus acquirer certification [P] | UNKNOWN; realistically 1-3 months [P] | POS still sees no full PAN, but a terminal linked to the POS no longer fits SAQ B's "not connected to any other systems" [V]; a B-IP or P2PE route is the acquirer's call [PK] | Acquirer refuses or has no ECR build; pairing or network drops mid-sale; every till stops taking cards if the link fails without a manual fallback |
| e | Android smart terminal (Sunmi, PAX A920, Nexgo) with the POS on the device, calling the bank's payment app | Same as (d), via the payment app's result | Weeks; needs the acquirer's intent/SDK spec and app signing or whitelisting [PK] | UNKNOWN | As (d); the POS shares a device with the payment app, so the acquirer sets the rules [PK] | Acquirer will not load third-party apps; small screen for a bar menu; battery; one device per till |
| f | SoftPOS / Tap to Phone SDK | As (d), contactless only | Weeks to months; the SDK comes from an acquirer or solution provider [V] | UNKNOWN | Payment app is the provider's certified component [PK] | Contactless only; PIN and amount-limit rules UNKNOWN for Uganda; phone NFC reliability in a crowd |
| g | Online gateway, payment link or QR instead of a terminal | Scheme and last 4 from the gateway API or webhook [PK] | Days to weeks if the gateway is already integrated [P] | Days to weeks [P] | Hosted page keeps the POS away from card data [PK] | Card-not-present: customer types card details on a phone, slower, more declines, usually higher fees, needs customer data coverage at the venue [PK] |

Protocols behind (d) and what was actually verified:
- Adyen Terminal API. The payment response carries `PaymentBrand`, `MaskedPan`, card country code and an `AdditionalResponse` string. [V] https://docs.adyen.com/point-of-sale/basic-tapi-integration/make-a-payment/paymentresponsenexo. That page shows `ProtocolVersion` 3.0 and a `SaleToPOIResponse` root, which is the nexo Retailer shape, but the page itself does not name nexo [V for the fields, PK for the nexo attribution].
- Stripe Terminal. `CardPresentDetails` exposes `brand`, `last4`, `funding`, `country`, `network`, `receiptDetails` and `retrievalReferenceNumber`. [V] https://stripe.dev/stripe-terminal-android/external/com.stripe.stripeterminal.external.models/-card-present-details/index.html. Stripe does not onboard Ugandan merchants [PK].
- Visa Acceptance (Cybersource) PAX app, Local mode. The POS talks to the app on the PAX terminal over local Wi-Fi through a single WebSocket (`wss://terminal-ip:port/`), and the final `PaymentResponse` includes a masked PAN and preformatted receipts. Cloud and Standalone modes also exist. [V] https://developer.visaacceptance.com/docs/vas/en-us/sis-pax/integration/all/rest/sis-pax/semi-integrated-pymnt-svcs-intro.html (read to 100k of 271k characters). Availability through a Ugandan acquirer UNKNOWN.
- Paystack Terminal. The POS creates a payment request, then pushes it with `POST /terminal/:terminal_id/event` (`type: invoice`, `action: process`) and learns the outcome by webhook (`charge.success`, `paymentrequest.success`). The documented sample payload shows `channel: pos` but no card brand or last 4. [V] https://paystack.com/docs/terminal/push-payment-requests/. Whether brand is returned in live payloads: UNKNOWN. Paystack does not operate in Uganda [PK].
- nexo Retailer (ISO 20022 family), OPI, ZVT (German-speaking markets), PAX POSLink / BroadPOS, Verifone and Ingenico/Worldline ECR interfaces: [PK], none opened today.
- Flutterwave, Pesapal, DPO Pay / Network International and Interswitch terminal APIs: not opened; UNKNOWN whether any exposes an ECR or push-to-terminal interface in Uganda.

Who must cooperate. The payment application on the terminal belongs to the acquirer or PSP. The ECR interface exists only if their build has it switched on, and they decide whether a third-party POS may pair with it [PK]. The terminal maker (PAX, Sunmi, Nexgo) cannot grant this on its own [PK].

## 3. Is there a "direct integration with Visa" for a merchant POS?

No. A merchant reaches Visa only through an acquirer [PK].

What Visa Direct is. Visa's developer documentation describes Visa Direct for Card as part of its money-movement portfolio: pull and push APIs over VisaNet using card credentials. The push is an Original Credit Transaction (OCT) and the pull is an Account Funding Transaction (AFT). Listed uses are P2P transfers, payouts to sellers and gig workers, insurance and gaming payouts, wallet and prepaid top-ups. The originator must be a licensed Visa acquirer or a third-party originator sponsored by one. The page says nothing about purchase acceptance at a point of sale. [V] https://developer.visa.com/capabilities/visa_direct/docs

Why it is not this. Visa Direct moves money to or from a card account. It does not authorise a purchase at a till, it does not report on purchases, and it covers no Mastercard traffic [P, from the page above].

What Visa offers that is relevant:
- Tap to Phone. Visa supplies a contactless kernel for NFC Android devices; solution providers or acquirers build the payment app, and sellers get it by downloading that app. [V] https://africa.visa.com/visa-everywhere/innovation/connected-commerce/tap-to-phone.html
- Visa Acceptance (formerly Cybersource) acceptance-device and semi-integrated solutions, as in section 2. [V] URL above. It is a gateway product that still needs an acquirer [PK].
- Visa Developer APIs in general are aimed at issuers, acquirers and their sponsored partners [PK]. No merchant-level "my transactions by scheme" API from Visa was found; UNKNOWN whether one exists.

What a sponsor like Visa can get. Visa sees its own card transactions as network messages: amounts, merchant ID, time. It does not see baskets, and it does not see Mastercard or cash [PK]. So "which items were bought with Visa" can only come from the POS joined to acquirer data [P]. Whether Visa would hand an event sponsor its network data for one merchant is UNKNOWN and a commercial question for the other agent.

## 4. Matching method for option (c)

All of this section is [P]; no published source was found for the algorithm or the rates.

Set-up before the event:
- One terminal per till. Store `till_id -> TID` in the POS.
- The POS records, per card payment: till, cashier, amount, timestamp at the moment the cashier confirms "card approved", plus the optional scheme button and auth code.
- Sync POS clocks. Note each terminal's clock offset on the day with one test sale per till.
- Confirm the timezone of the acquirer's report (EAT, UTC+3, or UTC).

Algorithm:
1. Normalise the report to rows of {TID, local time, amount in whole UGX, scheme, masked PAN, auth code, RRN, type, status}. Drop declines. Pair each void or reversal with its sale and remove both.
2. Pass 1, exact: TID + auth code (or RRN) where the cashier typed one. Use the median time gap of these matches as that terminal's clock offset.
3. Pass 2, unique: TID + exact amount + time within 2 minutes after offset correction, accepted only when exactly one POS payment and one report row qualify.
4. Pass 3, duplicates: when several payments of the same amount on one TID fall in the window, sort both sides by time and pair first with first. A single terminal handles one sale at a time, so order is preserved. Use last 4 where captured. If all candidates share a scheme, the scheme total is right even when the pairing is not.
5. Pass 4, repair: widen to 10 minutes. Then allow an amount mismatch on TID + sequence position to catch hand-keyed errors, and flag each one for review. Send the rest to a manual queue.
6. Control totals: per TID per day, POS card total against the report total and against the terminal's end-of-day batch slip. Explain any difference before publishing scheme figures.

Expected automatic match rates:
- Own terminal per till, auth code typed: about 99% or better.
- Own terminal per till, no typed key: about 95-99%, the rest ambiguous same-amount pairs or keying errors.
- Terminals shared between tills: materially lower, perhaps 80-95%, because ordering no longer separates same-amount sales.
These are estimates, not measurements. Round bar prices make repeated amounts common, which is why the per-till terminal and the typed auth code matter.

Items bought with Visa. Report at order level: every line on an order whose matched card payment is Visa. For split tenders, either allocate lines pro rata by value or list split orders separately, and state which rule was used.

## 5. PCI DSS: what the POS may store

- Truncated card numbers. PCI SSC FAQ 1091 (dated June 2022) accepts "first 8, any other 4" for 16-digit Visa, Mastercard, JCB, UnionPay and Discover numbers, and "first 6, last 4" for 15-digit Amex. Last 4 alone, or first 6 + last 4, is inside that limit. [V] https://www.pcisecuritystandards.org/faqs/1091/
- Scope. FAQ 1117 (September 2021) says systems holding only truncated PANs may be out of scope if they are adequately segmented from the cardholder data environment and store, process or transmit no other cardholder data or sensitive authentication data. It also warns that mixing truncation formats for the same PAN can pull an environment back into scope. [V] https://www.pcisecuritystandards.org/faqs/1117/
- Other cardholder data. FAQ 1222 (June 2025) names cardholder name, expiry date and service code as cardholder data that must be protected when stored with the PAN or present in the cardholder data environment. Nimbus needs none of them, so do not store them. [V] https://www.pcisecuritystandards.org/faqs/1222/
- Never store the full PAN, CVV/CVC, track or chip data, or PIN. Sensitive authentication data may not be kept after authorisation. [PK]; the FAQ 1222 page links to the SAD FAQ but that text was not opened [2H].
- Brand, auth code, RRN, TID, MID, time and amount are not account data under PCI DSS definitions. [PK]; the standard's own table was not opened.

What "SAQ B / standalone terminal" means. The SAQ B eligibility list (PCI DSS v4.0 edition, April 2022) requires: only imprint machines or standalone dial-out terminals; terminals not connected to any other system in the merchant environment; terminals not connected to the internet; no account data stored electronically; any retained account data on paper only. [V] https://listings.pcisecuritystandards.org/documents/PCI-DSS-v4-0-SAQ-B.pdf. The current edition is v4.0.1 [PK, not opened].

Consequences for Nimbus [P]:
- Options a, b and c keep the terminal standalone. The POS records an outcome and never touches card data. The merchant's SAQ type is unchanged and Nimbus stays out of scope.
- IP-connected standalone terminals fall under SAQ B-IP, and PCI SSC has guidance treating cellular standalone terminals like dial-out ones for SAQ B [PK, not opened]. The acquirer confirms which SAQ applies.
- Option d over a local network connects the terminal to the POS, which breaks the "not connected to any other systems" criterion. The usual routes are a PCI-listed P2PE solution or the acquirer's own ruling [PK]. Get this in writing before building.
- Guard rails: constrain the last-4 field to exactly 4 digits and the auth code to 6 characters; never provide a free-text "card number" field; never photograph slips into the POS; import only reports that contain masked PANs.

## 6. Recommendation

For the 2-3 week deadline [P]. Do not touch the payment flow. Ship (a) + (b) + (c) together: a mandatory three-button scheme choice on every card payment, read from the terminal slip rather than the card; an optional 6-character auth code field; one terminal per till with the TID mapped in the POS; and an importer and matcher for the acquirer's transaction report. Ask the acquirer this week for a sample report file with scheme, masked PAN, auth code, RRN, TID and timestamp columns, and for how soon after the event it can be downloaded. Promise the organiser live cash-versus-card totals and provisional scheme splits from the buttons, with final Visa / Mastercard / other figures and items-by-scheme after reconciliation, expected the next day. Run a one-night rehearsal at a real bar to measure match rate before the concert. Anything deeper needs the acquirer's certification and will not land in three weeks.

For three months later [P]. Move to (d) or (e) with whichever acquirer or PSP offers a documented ECR or push-to-terminal interface in Uganda: the POS sends the amount, which removes hand-keying errors, and receives scheme, masked PAN, auth code and reference in real time. Prefer a cloud or app-to-app link over a local-network link, for PCI and for venue Wi-Fi reasons, and get the acquirer's written view of the merchant's SAQ type first. Keep the report import from (c) as the permanent reconciliation control and keep the manual button as the fallback when the link drops. Treat SoftPOS as a queue-busting supplement only.

## 7. The ten facts I am least sure of

1. Which columns the Ugandan acquirer's report contains (scheme? RRN? time to the second?) and when it is available. UNKNOWN.
2. Whether any Ugandan acquirer or PSP exposes an ECR or push-to-terminal interface to a third-party POS at all. UNKNOWN; not researched here.
3. The match rates in section 4. My estimates, no measurement behind them.
4. That auth code and RRN are outside PCI DSS "account data". From memory; the standard was not opened.
5. That cellular or IP standalone terminals keep the merchant on SAQ B or B-IP, and how a semi-integrated link changes that. From memory; the acquirer decides.
6. Mastercard's exact ranges (51-55, 2221-2720). From memory; Mastercard's own table was not opened.
7. What the terminal slips at this event will print (AID, application label, RRN). From memory of typical EMV receipts.
8. Whether Paystack Terminal returns card brand in live `charge.success` payloads. The documented sample does not show it.
9. That the Adyen response shape is nexo Retailer. The fields were verified; the page does not name the standard.
10. Whether Visa would give an event sponsor merchant-level network data, and whether any Visa merchant reporting API exists. UNKNOWN.

Also not verified: PAX POSLink, OPI, ZVT, Verifone and Ingenico specifics; Sunmi and Nexgo app-to-app intents; and the UnionPay AID, which the list I read gives as A000000333010101 rather than a 7-byte form.
