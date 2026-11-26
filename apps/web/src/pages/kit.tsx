import type { GetServerSideProps } from "next";
import Head from "next/head";
import { useEffect, useState, type ReactNode } from "react";

import {
  ActionTile,
  Banner,
  BottomBar,
  Button,
  Card,
  Chip,
  Field,
  HeaderBand,
  ItemTile,
  Key,
  MeasureRow,
  NewTabTile,
  OptionTile,
  OrderHeader,
  OrderLine,
  Pill,
  RoundAction,
  Row,
  RowGroup,
  Segmented,
  Sheet,
  SquareAction,
  Stepper,
  Switcher,
  TabBar,
  TableTile,
  Text,
  TouchHeader,
  phoneSections,
  terminalSections,
  type ButtonTone,
  type KitDemo,
  type PhoneRole,
  type TerminalRole,
  type TextVariant,
} from "@/components/kit";
import { Frame, SoloContext } from "@/components/kit-gallery/Frame";
import { CompactWall, RoomyWall } from "@/components/kit-gallery/Walls";

/**
 * /kit — the U0 kit gallery. Served only when NEXT_PUBLIC_KIT_GALLERY=1 at
 * build time; otherwise a 404. Every piece in every state, the bars per role
 * inside device-wide frames, and the two tile walls. All names and figures are
 * made up. `?only=<frame id>` renders one frame alone at its real size.
 */
type KitPageProps = { only: string | null };

export const getServerSideProps: GetServerSideProps<KitPageProps> = async ({ query }) => {
  if (process.env.NEXT_PUBLIC_KIT_GALLERY !== "1") return { notFound: true };
  return { props: { only: typeof query.only === "string" ? query.only : null } };
};

const STATES: readonly { key: string; caption: string; demo?: KitDemo; disabled?: boolean }[] = [
  { key: "idle", caption: "Idle" },
  { key: "pressed", caption: "Pressed", demo: "pressed" },
  { key: "focus", caption: "Keyboard focus", demo: "focus" },
  { key: "disabled", caption: "Disabled", disabled: true },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-kit-16">
      <Text variant="h" as="h2" id={`${id}-h`}>
        {title}
      </Text>
      {children}
    </section>
  );
}

/** One specimen: the piece, then its caption. `m` names it for the measuring spec. */
function S({ m, caption, children, wide = false }: { m?: string; caption: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={["flex flex-col gap-kit-8", wide ? "w-full" : ""].join(" ")}>
      <div data-m={m} className={["flex items-start", wide ? "w-full flex-col" : ""].join(" ")}>
        {children}
      </div>
      <Text variant="small" tone="muted">
        {caption}
      </Text>
    </div>
  );
}

function Wrap({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-kit-20">{children}</div>;
}

const TEXT: readonly [TextVariant, string, string][] = [
  ["title", "Title · 28/34 800", "Floor"],
  ["titleLg", "Laptop title · 30/36 800", "Menu items"],
  ["h", "Heading · 22/28 700", "Table 12"],
  ["row", "Row title · 17/24 700", "Main hall"],
  ["body", "Body · 16/22", "Beef burger with chips"],
  ["sup", "Supporting · 14/20", "3 guests · open 1 h 05"],
  ["small", "Small · 13/18", "Sent 19:42"],
  ["bar", "Bar label · 12/16 600", "Reservations"],
  ["cap", "Caps label · 12/16 700", "Not sent"],
  ["ticket", "Extra · kitchen ticket line · 20/26 600", "2 Beef burger"],
  ["key", "Extra · keypad key · 26/32 700", "000"],
  ["big", "Extra · big amount · 40/44 800", "UGX 98,000"],
];

const TONES: readonly ButtonTone[] = ["filled", "tonal", "text", "danger"];
const TONE_WORD: Record<ButtonTone, string> = { filled: "Send", tonal: "New tab", text: "Cancel", danger: "Void item" };

const TERMINAL: readonly { role: TerminalRole; name: string; counts: Record<string, number> }[] = [
  { role: "waiter", name: "Waiter", counts: { ready: 2 } },
  { role: "cashier", name: "Cashier", counts: {} },
  { role: "supervisor", name: "Supervisor", counts: { approvals: 4 } },
  { role: "kitchen", name: "Kitchen or bar screen", counts: { tickets: 8, store: 1 } },
  { role: "storeKeeper", name: "Store keeper", counts: { requests: 3 } },
];

const PHONE: readonly { role: PhoneRole; name: string; current: string; counts: Record<string, number> }[] = [
  { role: "waiter", name: "Waiter", current: "floor", counts: { ready: 2 } },
  { role: "manager", name: "Manager", current: "today", counts: { approvals: 4 } },
  { role: "owner", name: "Owner", current: "today", counts: { alerts: 3 } },
  { role: "accountant", name: "Accountant", current: "costs", counts: { costs: 12 } },
];

const noop = () => undefined;

function Gallery() {
  const [seg, setSeg] = useState("mine");
  const [field, setField] = useState("");
  return (
    <main className="mx-auto flex w-full flex-col gap-kit-32 px-kit-16 py-kit-24">
      <header className="flex flex-col gap-kit-4">
        <Text variant="title">The kit</Text>
        <Text variant="body" tone="muted">
          Every piece in every state. Sample names and figures only.
        </Text>
      </header>

      <Section id="text" title="Text">
        <Card padding="regular">
          <div className="flex flex-col gap-kit-12">
            {TEXT.map(([v, caption, sample]) => (
              <div key={v} className="flex flex-wrap items-baseline gap-kit-16">
                <Text variant={v} as="p">
                  {sample}
                </Text>
                <Text variant="small" tone="muted">
                  {caption}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section id="button" title="Button">
        {(["touch", "laptop"] as const).map((size) => (
          <Wrap key={size}>
            {TONES.flatMap((tone) =>
              STATES.map((st) => (
                <S key={`${tone}-${st.key}`} m={`button-${size}-${tone}-${st.key}`} caption={`${tone} · ${size === "touch" ? 52 : 44} · ${st.caption}`}>
                  <Button tone={tone} size={size} demo={st.demo} disabled={st.disabled} icon={tone === "tonal" ? "plus" : undefined}>
                    {TONE_WORD[tone]}
                  </Button>
                </S>
              )),
            )}
          </Wrap>
        ))}
      </Section>

      <Section id="actions" title="SquareAction and RoundAction">
        <Wrap>
          {STATES.map((st) => (
            <S key={`sq-${st.key}`} m={`square-${st.key}`} caption={`Square 52 · ${st.caption}`}>
              <SquareAction icon="more" label="Table actions" demo={st.demo} disabled={st.disabled} />
            </S>
          ))}
          {STATES.map((st) => (
            <S key={`r48-${st.key}`} m={`round-48-${st.key}`} caption={`Round 48 · ${st.caption}`}>
              <RoundAction icon="plus" label="One more" demo={st.demo} disabled={st.disabled} />
            </S>
          ))}
          {STATES.map((st) => (
            <S key={`r44-${st.key}`} m={`round-44-${st.key}`} caption={`Round 44 · ${st.caption}`}>
              <RoundAction icon="minus" label="One fewer" size="small" demo={st.demo} disabled={st.disabled} />
            </S>
          ))}
          <S m="round-filled" caption="Round 48 · filled">
            <RoundAction icon="ready" label="Call" tone="filled" />
          </S>
          <S m="round-label" caption="Round with its word">
            <RoundAction icon="ready" label="Call" showLabel />
          </S>
        </Wrap>
      </Section>

      <Section id="chip" title="Chip and Segmented">
        <Wrap>
          <S m="chip-idle" caption="Chip · idle">
            <Chip label="Terrace" count={16} />
          </S>
          <S m="chip-current" caption="Chip · current">
            <Chip label="Main hall" count={32} current />
          </S>
          <S m="chip-pressed" caption="Chip · pressed">
            <Chip label="Bar" count={10} demo="pressed" />
          </S>
          <S m="chip-focus" caption="Chip · keyboard focus">
            <Chip label="VIP" count={6} demo="focus" />
          </S>
          <S m="chip-disabled" caption="Chip · disabled">
            <Chip label="Tabs" count={0} disabled />
          </S>
        </Wrap>
        <Wrap>
          <S m="seg" caption="Segmented · current raised (tap to change)">
            <Segmented
              label="Whose tables"
              value={seg}
              onChange={setSeg}
              options={[
                { key: "mine", label: "My tables · 6" },
                { key: "all", label: "All tables" },
              ]}
            />
          </S>
          <S m="seg-pressed" caption="Segmented · pressed">
            <Segmented label="Menu" value="food" demo="pressed" options={[{ key: "food", label: "Food" }, { key: "drinks", label: "Drinks" }]} />
          </S>
          <S m="seg-focus" caption="Segmented · keyboard focus">
            <Segmented label="Menu" value="food" demo="focus" options={[{ key: "food", label: "Food" }, { key: "drinks", label: "Drinks" }]} />
          </S>
          <S m="seg-disabled" caption="Segmented · a disabled choice">
            <Segmented
              label="Period"
              value="today"
              options={[
                { key: "today", label: "Today" },
                { key: "week", label: "Week" },
                { key: "month", label: "Month", disabled: true },
              ]}
            />
          </S>
          <S m="seg-fill" caption="Segmented · full width" wide>
            <Segmented label="Whose tables" value="mine" fill options={[{ key: "mine", label: "My tables · 6" }, { key: "all", label: "All tables" }]} />
          </S>
        </Wrap>
      </Section>

      <Section id="card" title="Card, Row and Pill">
        <Wrap>
          <div data-m="card" className="w-full">
            <Card label="Team on now">
              <RowGroup>
                <Row initials="AK" title="Amina K." line="6 tables · UGX 412,000" trailing={<Pill tone="green">On</Pill>} onClick={noop} />
                <Row initials="BO" title="Brian O." line="5 tables · pressed" trailing={<Pill tone="brand">Break</Pill>} onClick={noop} demo="pressed" />
                <Row initials="GN" title="Grace N." line="4 tables · keyboard focus" trailing={<Pill tone="amber">Late</Pill>} onClick={noop} demo="focus" />
                <Row initials="DS" title="David S." line="Disabled" trailing={<Pill tone="neutral">Off</Pill>} disabled />
                <Row title="Printer" line="Settings row · 56" size="settings" trailing={<Pill tone="red">Offline</Pill>} />
              </RowGroup>
            </Card>
          </div>
        </Wrap>
        <Wrap>
          {(["green", "amber", "red", "neutral", "brand"] as const).map((t) => (
            <S key={t} m={`pill-${t}`} caption={`Pill · ${t}`}>
              <Pill tone={t}>{t === "green" ? "Free" : t === "amber" ? "Bill" : t === "red" ? "Late" : t === "neutral" ? "Reserved" : "Open"}</Pill>
            </S>
          ))}
        </Wrap>
      </Section>

      <Section id="switcher" title="Switcher and Stepper">
        <Wrap>
          <S m="switcher" caption="Switcher · idle" wide>
            <Switcher label="Main hall" detail="· 12 free" previousLabel="Previous area" nextLabel="Next area" onPrevious={noop} onNext={noop} onOpen={noop} />
          </S>
          <S m="switcher-pressed" caption="Switcher · pressed" wide>
            <Switcher label="Terrace" detail="· 4 free" previousLabel="Previous area" nextLabel="Next area" onPrevious={noop} onNext={noop} onOpen={noop} demo="pressed" />
          </S>
          <S m="switcher-first" caption="Switcher · first area (previous disabled)" wide>
            <Switcher label="Bar" detail="· 2 free" previousLabel="Previous area" nextLabel="Next area" onNext={noop} onOpen={noop} demo="focus" />
          </S>
        </Wrap>
        <Wrap>
          <S m="stepper" caption="Stepper · idle">
            <Stepper value="8" noun="tables" onDecrease={noop} onIncrease={noop} />
          </S>
          <S m="stepper-pressed" caption="Stepper · pressed">
            <Stepper value="1.5 kg" noun="kilograms" onDecrease={noop} onIncrease={noop} demo="pressed" />
          </S>
          <S m="stepper-focus" caption="Stepper · keyboard focus">
            <Stepper value="4" noun="seats" onDecrease={noop} onIncrease={noop} demo="focus" />
          </S>
          <S m="stepper-min" caption="Stepper · at the least (minus disabled)">
            <Stepper value="1" noun="items" onIncrease={noop} />
          </S>
        </Wrap>
      </Section>

      <Section id="field" title="Field">
        <div className="grid grid-cols-1 gap-kit-20 md:grid-cols-2">
          <Field label="Note for the kitchen" placeholder="No onions" value={field} onChange={setField} hint="The kitchen sees this on the ticket." />
          <Field label="Guest name" value="Kato" demo="focus" onChange={noop} />
          <Field label="Amount" value="98,000" inputMode="numeric" size="laptop" onChange={noop} required />
          <Field label="Reference" value="Not needed for cash" disabled />
          <Field label="Phone" value="+256 700 000 1" error="That number is too short." inputMode="tel" onChange={noop} />
        </div>
      </Section>

      <Section id="tiles" title="TableTile">
        <div className="grid grid-cols-2 gap-kit-12 md:grid-cols-4 xl:grid-cols-8">
          <div data-m="tile-roomy">
            <TableTile density="roomy" name="4" state="free" detail="2 seats" />
          </div>
          <TableTile density="roomy" name="2" state="open" detail="4 guests · 42 min" who="You" amount="86,000" />
          <TableTile density="roomy" name="3" state="open" others detail="2 guests · 18 min" who="Brian O." amount="54,000" />
          <TableTile density="roomy" name="23" state="notSent" detail="3 items not sent" who="You" amount="19,000" />
          <TableTile density="roomy" name="6" state="late" detail="Food 26 min late" who="You" amount="61,000" />
          <TableTile density="roomy" name="12" state="bill" detail="3 guests · 1 h 05" who="You" amount="97,500" />
          <TableTile density="roomy" name="7" state="reserved" detail="20:00 · 6 guests" />
          <TableTile density="roomy" name="15" state="cleaning" detail="4 seats" />
          <TableTile density="roomy" name="Tab 3" tab state="open" detail="Standing · 1 h 04" who="You" amount="54,000" />
          <NewTabTile density="roomy" />
          <TableTile density="roomy" name="9" state="open" detail="Pressed" who="You" amount="24,000" demo="pressed" />
          <TableTile density="roomy" name="17" state="open" detail="Keyboard focus" who="You" amount="45,000" demo="focus" />
          <TableTile density="roomy" name="21" state="reserved" detail="Disabled" disabled />
        </div>
        <Text variant="small" tone="muted">
          Roomy · 108 · free, open and mine, open and someone else&apos;s, not sent, late, bill, reserved, cleaning, a tab, new tab, pressed,
          focus, disabled
        </Text>
        <div className="grid grid-cols-2 gap-kit-10 md:grid-cols-5 xl:grid-cols-7">
          <div data-m="tile-compact">
            <TableTile density="compact" name="4" state="free" short="2 seats" />
          </div>
          <TableTile density="compact" name="2" state="open" who="You" short="42 min" />
          <TableTile density="compact" name="3" state="open" others who="Brian O." short="18 min" />
          <TableTile density="compact" name="23" state="notSent" who="You" short="3 items" />
          <TableTile density="compact" name="6" state="late" who="You" short="26 min" />
          <TableTile density="compact" name="12" state="bill" who="You" short="1 h 05" />
          <TableTile density="compact" name="7" state="reserved" short="20:00" />
          <TableTile density="compact" name="15" state="cleaning" short="4 seats" />
          <TableTile density="compact" name="Tab 3" tab state="open" who="You" short="1 h 04" />
          <NewTabTile density="compact" />
          <TableTile density="compact" name="9" state="open" who="You" short="Pressed" demo="pressed" />
          <TableTile density="compact" name="17" state="open" who="You" short="Focus" demo="focus" />
          <TableTile density="compact" name="21" state="reserved" short="Disabled" disabled />
        </div>
        <Text variant="small" tone="muted">
          Compact · 84 · the same states
        </Text>
        <div className="grid grid-cols-3 gap-kit-10" style={{ maxWidth: 390 }}>
          <div data-m="tile-phone">
            <TableTile density="phone" name="6" state="late" short="26 min" />
          </div>
          <TableTile density="phone" name="23" state="notSent" short="3 items" />
          <TableTile density="phone" name="12" state="bill" short="1 h 05" />
          <TableTile density="phone" name="2" state="open" short="42 min" />
          <TableTile density="phone" name="1" state="free" short="4 seats" />
          <TableTile density="phone" name="14" state="free" short="Pressed" demo="pressed" />
        </div>
        <Text variant="small" tone="muted">
          Phone · 84 · three across, as Floor-Phone (time top right, the state below)
        </Text>
      </Section>

      <Section id="options" title="OptionTile and ItemTile">
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-4">
          <div data-m="option-48">
            <OptionTile label="Whisky" current />
          </div>
          <OptionTile label="Gin" />
          <OptionTile label="Vodka" demo="pressed" />
          <OptionTile label="Rum" demo="focus" />
          <OptionTile label="Tequila" disabled />
          <div data-m="option-64">
            <OptionTile label="Cash" second="UGX 98,000" current />
          </div>
          <OptionTile label="Mobile money" second="MTN or Airtel" />
          <OptionTile label="Card" second="Terminal" demo="pressed" />
          <div data-m="option-96">
            <OptionTile label="Wasted" second="Dropped or spoilt" icon="soldOut" current />
          </div>
          <OptionTile label="Staff meal" icon="ready" />
          <OptionTile label="Returned" icon="receive" demo="focus" />
          <OptionTile label="Other" icon="more" disabled />
        </div>
        <Text variant="small" tone="muted">
          Option tile · 48, 64 with a second line, 96 with an icon · current, idle, pressed, focus, disabled
        </Text>
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-5">
          <div data-m="item">
            <ItemTile name="Beef burger" price="28,000" />
          </div>
          <ItemTile name="Pork ribs" price="35,000" left={3} />
          <ItemTile name="Lamb chops" price="40,000" soldOut />
          <ItemTile name="Chips" price="8,000" demo="pressed" />
          <ItemTile name="Goat stew" price="26,000" demo="focus" />
        </div>
        <Text variant="small" tone="muted">
          Item tile · 96 · plain, a few left, sold out, pressed, focus
        </Text>
      </Section>

      <Section id="order" title="MeasureRow and OrderLine">
        <div className="grid grid-cols-1 gap-kit-8 lg:grid-cols-2">
          <div data-m="measure-row">
            <MeasureRow
              name="Blended Scotch"
              measures={[
                { key: "tot", label: "Tot", price: "8,000" },
                { key: "double", label: "Double", price: "15,000" },
                { key: "bottle", label: "Bottle", price: "180,000" },
              ]}
            />
          </div>
          <MeasureRow
            name="Single malt 12 · pressed and focus"
            demo={{ key: "double", look: "pressed" }}
            measures={[
              { key: "tot", label: "Tot", price: "16,000" },
              { key: "double", label: "Double", price: "30,000" },
            ]}
          />
          <MeasureRow
            name="Irish whiskey · keyboard focus"
            demo={{ key: "tot", look: "focus" }}
            measures={[
              { key: "tot", label: "Tot", price: "9,000" },
              { key: "double", label: "Double", price: "17,000" },
            ]}
          />
        </div>
        <div className="max-w-full" style={{ width: 372 }}>
          <Card label="Order for table 12">
            <div data-m="order-line">
              <OrderLine quantity={2} name="Lager 500 ml" price="12,000" state="notSent" />
            </div>
            <OrderLine quantity={1} name="Blended Scotch" choices="Double · Cola" price="15,000" state="notSent" demo="pressed" />
            <OrderLine quantity={1} name="Beef burger" choices="Medium · No onions" price="28,000" state="sent" />
            <OrderLine quantity={2} name="Chips" price="16,000" state="sent" demo="focus" />
            <OrderLine quantity={1} name="Chicken wings" choices="Voided · sent back" price="24,000" state="voided" />
          </Card>
        </div>
        <Text variant="small" tone="muted">
          Order line · not sent, pressed, sent, focus, voided
        </Text>
      </Section>

      <Section id="action-tiles" title="ActionTile and Key">
        <div className="grid grid-cols-1 gap-kit-8 md:grid-cols-2 xl:grid-cols-3">
          <div data-m="action-tile">
            <ActionTile icon="floor" title="Move table" line="To a free table, the order goes with it" />
          </div>
          <ActionTile icon="staff" title="Join tables" line="Put two tables on one bill" demo="pressed" />
          <ActionTile icon="approvals" title="Discount" line="Needs a supervisor" demo="focus" />
          <ActionTile icon="soldOut" title="Void the table" line="Every line, with a reason" danger />
          <ActionTile icon="cashierTill" title="Take payment" line="Cashier only" disabled />
        </div>
        <div className="grid grid-cols-3 gap-kit-8" style={{ maxWidth: 360 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0"].map((k, i) => (
            <div key={k} data-m={i === 0 ? "key" : undefined}>
              <Key label={k} demo={k === "5" ? "pressed" : k === "9" ? "focus" : undefined} />
            </div>
          ))}
          <Key label="Del" name="Delete" disabled />
        </div>
        <Text variant="small" tone="muted">
          Key · 100 · 5 pressed, 9 focus, Del disabled
        </Text>
      </Section>

      <Section id="banner" title="Banner">
        <Banner tone="amber" title="Lamb chops are finished and burger buns are low." detail="The request to Main store is written for you." action={{ label: "We have it", onClick: noop }} />
        <Banner tone="red" title="The printer in the kitchen is not answering." detail="Tickets are kept and print when it is back." action={{ label: "Try again", onClick: noop }} />
      </Section>

      <Section id="headers" title="TouchHeader, OrderHeader and HeaderBand">
        <Frame id="touch-header" label="Touch header · 64" width={1280} height={64}>
          <div data-m="touch-header">
            <TouchHeader
              title="Floor"
              context="Main hall · 17 of 32 tables open · as at 19:42"
              searchLabel="Find a table or a tab"
              person={{ name: "Amina K.", role: "Waiter", station: "Terminal 01" }}
              homeHref="#"
            />
          </div>
        </Frame>
        <Frame id="order-header" label="Order header · 60, with back" width={1280} height={60}>
          <div data-m="order-header">
            <OrderHeader
              backLabel="Floor"
              title="Table 12"
              context="3 guests · open 1 h 05 · Amina K."
              searchLabel="Search the whole menu"
              initials="AK"
              personName="Amina K."
            />
          </div>
        </Frame>
        <Wrap>
          <Frame id="band" label="Header band · phone" width={390} height={106}>
            <HeaderBand
              title="Floor"
              summary="6 tables are yours · as at 19:42"
              actions={[
                { icon: "search", label: "Find a table" },
                { icon: "plus", label: "New tab" },
              ]}
            />
          </Frame>
          <Frame id="band-record" label="Header band · record, with back" width={390} height={88}>
            <HeaderBand title="Table 12" summary="3 guests · open 1 h 05" onBack={noop} backLabel="Back to the floor" />
          </Frame>
        </Wrap>
      </Section>

      <Section id="bars" title="BottomBar · terminal roles">
        {TERMINAL.map((r) =>
          ([1024, 1280, 1920] as const).map((w) => (
            <Frame key={`${r.role}-${w}`} id={`bar-${r.role}-${w}`} label={`${r.name} · ${terminalSections[r.role].length} sections`} width={w} height={76}>
              <div data-kit-bar="terminal" data-kit-bar-width={w} data-kit-bar-sections={terminalSections[r.role].length}>
                <BottomBar sections={terminalSections[r.role]} currentKey={terminalSections[r.role][0].key} counts={r.counts} />
              </div>
            </Frame>
          )),
        )}
        <Frame id="bar-states" label="Bar states · Reservations pressed, Me keyboard focus" width={1280} height={76}>
          <div className="flex flex-col">
            <BottomBar sections={terminalSections.waiter} currentKey="floor" counts={{ ready: 2 }} demo={{ key: "reservations", look: "pressed" }} />
          </div>
        </Frame>
        <Frame id="bar-states-focus" label="Bar states · Me keyboard focus" width={1280} height={76}>
          <div className="flex flex-col">
            <BottomBar sections={terminalSections.waiter} currentKey="ready" counts={{ ready: 2 }} demo={{ key: "me", look: "focus" }} />
          </div>
        </Frame>
      </Section>

      <Section id="tabbars" title="TabBar · phone roles">
        <Wrap>
          {PHONE.map((r) => (
            <Frame key={r.role} id={`tabbar-${r.role}`} label={`${r.name} · phone`} width={390} height={84}>
              <div data-kit-bar="phone" data-kit-bar-sections={phoneSections[r.role].length}>
                <TabBar sections={phoneSections[r.role]} currentKey={r.current} counts={r.counts} />
              </div>
            </Frame>
          ))}
          <Frame id="tabbar-states" label="Phone bar states · Reports pressed, More focus" width={390} height={84}>
            <TabBar sections={phoneSections.manager} currentKey="today" counts={{ approvals: 4 }} demo={{ key: "reports", look: "pressed" }} />
          </Frame>
        </Wrap>
      </Section>

      <Section id="sheets" title="Sheet">
        <Wrap>
          <Frame id="sheet-bottom" label="Sheet · bottom · phone" width={390} height={844}>
            <HeaderBand title="Table 12" summary="3 guests · open 1 h 05" onBack={noop} />
            <Sheet
              placement="bottom"
              title="Beef burger"
              summary="UGX 28,000 · with chips"
              onClose={noop}
              footer={
                <>
                  <Stepper value="1" noun="burgers" onDecrease={noop} onIncrease={noop} />
                  <Button tone="filled" fill>
                    Add · UGX 31,000
                  </Button>
                </>
              }
            >
              <div className="grid grid-cols-3 gap-kit-8">
                <OptionTile label="Rare" />
                <OptionTile label="Medium" current />
                <OptionTile label="Well done" />
              </div>
              <Field label="Note for the kitchen" placeholder="No onions" />
            </Sheet>
          </Frame>
          <Frame id="sheet-middle" label="Sheet · middle · terminal" width={1280} height={800}>
            <Sheet
              placement="middle"
              title="Table 12 · actions"
              summary="Amina K. · open 1 h 05"
              onClose={noop}
              footer={
                <Button tone="text" onClick={noop}>
                  Cancel
                </Button>
              }
            >
              <div className="grid grid-cols-2 gap-kit-8">
                <ActionTile icon="floor" title="Move table" line="To a free table, the order goes with it" />
                <ActionTile icon="staff" title="Join tables" line="Put two tables on one bill" />
                <ActionTile icon="approvals" title="Discount" line="Needs a supervisor" />
                <ActionTile icon="soldOut" title="Void the table" line="Every line, with a reason" danger />
              </div>
            </Sheet>
          </Frame>
          <Frame id="sheet-wide" label="Sheet · wide · over the menu" width={1280} height={800}>
            <Sheet placement="wide" title="Split the bill" summary="UGX 98,000 · 3 guests" onClose={noop} footer={<Button tone="filled">Split in 3 · UGX 32,667 each</Button>}>
              <div className="grid grid-cols-3 gap-kit-8">
                <OptionTile label="Evenly" second="By the number of guests" current />
                <OptionTile label="By item" second="Each pays their own" />
                <OptionTile label="By amount" second="Type what each pays" />
              </div>
            </Sheet>
          </Frame>
          <Frame id="sheet-side" label="Sheet · side · laptop" width={1440} height={900}>
            <div className="h-kit-app-bar flex-none bg-kit-primary" />
            <Sheet placement="side" title="Table 12" summary="Open 1 h 05 · Amina K." onClose={noop} footer={<Button tone="filled" fill>Take payment</Button>}>
              <RowGroup>
                <Row title="Beef burger" line="Medium · No onions" trailing={<Text variant="body">28,000</Text>} />
                <Row title="Chips" line="2 portions" trailing={<Text variant="body">16,000</Text>} />
              </RowGroup>
            </Sheet>
          </Frame>
        </Wrap>
      </Section>

      <Section id="walls" title="Tile walls">
        <RoomyWall />
        <CompactWall />
      </Section>
    </main>
  );
}

export default function KitPage({ only }: KitPageProps) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Let the frames measure their width first, then flag the page for the spec.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <SoloContext.Provider value={only}>
      <Head>
        <title>Kit · Nimbus POS</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div data-kit-ready={ready ? "yes" : "no"} className="min-h-screen bg-kit-canvas text-kit-text font-kit">
        {only === "wall-roomy" ? <RoomyWall /> : only === "wall-compact" ? <CompactWall /> : <Gallery />}
      </div>
    </SoloContext.Provider>
  );
}
