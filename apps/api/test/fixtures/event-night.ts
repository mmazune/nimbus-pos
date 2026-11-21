/**
 * Deterministic "event night": about 200 sales across two branches and four tills, with
 * the expected totals computed here, from the same list that is posted. H4a reuses it.
 *
 * Amounts are whole shillings held as integers; the API stores Decimal(12,2). No random
 * source other than the seeded generator below, so a failure can be replayed exactly.
 */
export type Tender = 'CASH' | 'CARD' | 'MOMO';
export type BranchKey = 'drinks' | 'food';

export interface FixtureItem {
  sku: string;
  name: string;
  brand: string;
  price: number;
  type: 'FOOD' | 'DRINK';
}

export interface FixturePayment {
  method: Tender;
  tenderedAmount?: number;
  cardScheme?: 'VISA' | 'MASTERCARD' | 'OTHER';
  cardLast4?: string;
  authCode?: string;
  terminalId?: string;
  momoNetwork?: 'MTN' | 'AIRTEL';
}

export interface FixtureSale {
  n: number;
  branch: BranchKey;
  tillCode: string;
  clientSaleId: string;
  lines: { sku: string; quantity: number }[];
  payment: FixturePayment;
  total: number;
  changeDue: number;
}

export const NIGHT_BRANCHES: Record<
  BranchKey,
  { name: string; tills: string[]; items: FixtureItem[] }
> = {
  drinks: {
    name: 'Night Drinks',
    tills: ['DRK-01', 'DRK-02'],
    items: [
      { sku: 'BEER-NILE', name: 'Nile Special 500ml', brand: 'Nile', price: 4000, type: 'DRINK' },
      { sku: 'BEER-BELL', name: 'Bell Lager 500ml', brand: 'Bell', price: 4500, type: 'DRINK' },
      { sku: 'SODA-COLA', name: 'Cola 300ml', brand: 'Coca-Cola', price: 2000, type: 'DRINK' },
      { sku: 'WATER-500', name: 'Water 500ml', brand: 'Rwenzori', price: 1500, type: 'DRINK' },
      {
        sku: 'WHISKY-JW',
        name: 'Whisky tot',
        brand: 'Johnnie Walker',
        price: 10000,
        type: 'DRINK',
      },
    ],
  },
  food: {
    name: 'Night Food',
    tills: ['FOOD-01', 'FOOD-02'],
    items: [
      { sku: 'CHIPS-L', name: 'Chips large', brand: 'House', price: 8000, type: 'FOOD' },
      { sku: 'CHICKEN-Q', name: 'Chicken quarter', brand: 'House', price: 15000, type: 'FOOD' },
      { sku: 'BURGER-1', name: 'Burger', brand: 'House', price: 18000, type: 'FOOD' },
      { sku: 'SAMOSA-1', name: 'Samosa', brand: 'House', price: 1500, type: 'FOOD' },
      { sku: 'JUICE-1', name: 'Fresh juice', brand: 'House', price: 3000, type: 'DRINK' },
    ],
  },
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildEventNight(count = 200, seed = 20261121): FixtureSale[] {
  const rnd = mulberry32(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const alnum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const sales: FixtureSale[] = [];
  for (let n = 1; n <= count; n++) {
    const branch: BranchKey = rnd() < 0.55 ? 'drinks' : 'food';
    const def = NIGHT_BRANCHES[branch];
    const tillCode = def.tills[int(0, def.tills.length - 1)];
    const lines: { sku: string; quantity: number }[] = [];
    const used = new Set<string>();
    for (let i = int(1, 4); i > 0; i--) {
      const item = def.items[int(0, def.items.length - 1)];
      if (used.has(item.sku)) continue;
      used.add(item.sku);
      lines.push({ sku: item.sku, quantity: int(1, 3) });
    }
    const total = lines.reduce(
      (sum, l) => sum + l.quantity * def.items.find((i) => i.sku === l.sku)!.price,
      0,
    );
    const roll = rnd();
    let payment: FixturePayment;
    let changeDue = 0;
    if (roll < 0.45) {
      payment = { method: 'CASH' };
      if (rnd() < 0.75) {
        const tendered = Math.ceil(total / 1000) * 1000 + int(0, 2) * 5000;
        payment.tenderedAmount = tendered;
        changeDue = tendered - total;
      }
    } else if (roll < 0.8) {
      const s = rnd();
      payment = {
        method: 'CARD',
        cardScheme: s < 0.6 ? 'VISA' : s < 0.9 ? 'MASTERCARD' : 'OTHER',
        cardLast4: String(int(0, 9999)).padStart(4, '0'),
        authCode: Array.from({ length: 6 }, () => alnum[int(0, alnum.length - 1)]).join(''),
        terminalId: `TRM-${tillCode}`,
      };
    } else {
      payment = { method: 'MOMO', momoNetwork: rnd() < 0.7 ? 'MTN' : 'AIRTEL' };
    }
    sales.push({
      n,
      branch,
      tillCode,
      clientSaleId: `night-${String(n).padStart(4, '0')}-${seed}`,
      lines,
      payment,
      total,
      changeDue,
    });
  }
  return sales;
}

export interface NightExpected {
  count: number;
  grandTotal: number;
  byTender: Record<Tender, { count: number; total: number }>;
  byCardScheme: Record<'VISA' | 'MASTERCARD' | 'OTHER', { count: number; total: number }>;
  byMomoNetwork: Record<'MTN' | 'AIRTEL', { count: number; total: number }>;
  byBranch: Record<BranchKey, { count: number; total: number }>;
  tills: Record<string, { count: number; cash: number; card: number; momo: number }>;
}

export function expectedNight(sales: FixtureSale[]): NightExpected {
  const z = () => ({ count: 0, total: 0 });
  const e: NightExpected = {
    count: 0,
    grandTotal: 0,
    byTender: { CASH: z(), CARD: z(), MOMO: z() },
    byCardScheme: { VISA: z(), MASTERCARD: z(), OTHER: z() },
    byMomoNetwork: { MTN: z(), AIRTEL: z() },
    byBranch: { drinks: z(), food: z() },
    tills: {},
  };
  for (const s of sales) {
    e.count++;
    e.grandTotal += s.total;
    e.byTender[s.payment.method].count++;
    e.byTender[s.payment.method].total += s.total;
    e.byBranch[s.branch].count++;
    e.byBranch[s.branch].total += s.total;
    if (s.payment.cardScheme) {
      e.byCardScheme[s.payment.cardScheme].count++;
      e.byCardScheme[s.payment.cardScheme].total += s.total;
    }
    if (s.payment.momoNetwork) {
      e.byMomoNetwork[s.payment.momoNetwork].count++;
      e.byMomoNetwork[s.payment.momoNetwork].total += s.total;
    }
    const t = (e.tills[s.tillCode] ??= { count: 0, cash: 0, card: 0, momo: 0 });
    t.count++;
    if (s.payment.method === 'CASH') t.cash += s.total;
    else if (s.payment.method === 'CARD') t.card += s.total;
    else t.momo += s.total;
  }
  return e;
}
