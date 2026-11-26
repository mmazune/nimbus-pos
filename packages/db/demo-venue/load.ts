/**
 * Loads the Tapas Downtown demo venue into a throwaway local database, in one transaction.
 *
 *   eval "$(tools/test-env.sh)"; packages/db/demo-venue/run.sh      (the one command)
 *
 * Needs a database already migrated (with E1's migration) and seeded (db:seed makes the global
 * roles and permissions this venue's people are given). Refuses: a non-local or non-throwaway
 * database, data that fails the validator, a database that already holds the venue.
 *
 * Output: counts on stdout. The sign-in table (random passwords and PINs, made now, kept
 * nowhere) goes to stderr once. Never redirect stderr of this script to a file.
 *
 * The service in progress mirrors what the engine (apps/api orders, payments, kds) writes:
 * sentAt on every sent line, one ticket line per sent line on a station, totals from live
 * lines, cash tendered and change on payments, tables OCCUPIED only where the engine occupies
 * them, waiters' shifts OPEN, numbers in the ORD-/RES-/SHF- formats the generators parse.
 */
import {
  assertLocalThrowawayDb,
  readData,
  validate,
  flatItems,
  tableLabels,
  normalisePhone,
  LineRow,
} from './lib';

// The guard runs before Prisma is even loaded, so no .env file or inherited value can win.
const url = assertLocalThrowawayDb();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient, Prisma } = require('@prisma/client') as typeof import('@prisma/client');
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({ datasources: { db: { url } } });
const D = (v: number | string) => new Prisma.Decimal(v);

// Same as apps/api/src/modules/auth/quick-pin.service.ts:45 (pepper) and :573 (lookup hash)
// and :30 (bcrypt cost), so a loaded PIN signs in through the real quick-pin-login route.
const PIN_PEPPER = process.env.QUICK_PIN_PEPPER ?? 'nimbus-dev-pin-pepper';
const SALT_ROUNDS = 12;
// apps/api/src/modules/auth/quick-pin.constants.ts:14-25 and :40-45
const PIN_LENGTH: Record<string, number> = {
  WAITER: 6,
  CASHIER: 6,
  BARTENDER: 6,
  CHEF: 6,
  STOCK_MANAGER: 6,
  SUPERVISOR: 8,
  MANAGER: 8,
};

const lookupHash = (branchId: string, pin: string) =>
  crypto.createHmac('sha256', PIN_PEPPER).update(`${branchId}:${pin}`).digest('hex');
const randomDigits = (n: number) => {
  let s = '';
  while (s.length < n) s += String(crypto.randomInt(0, 10));
  return s;
};
const randomPassword = () => crypto.randomBytes(12).toString('base64url') + '#9a';

async function main() {
  const data = readData();
  const report = validate(data);
  if (report.errors.length) {
    console.error(`Validator: ${report.errors.length} error(s); nothing was loaded.`);
    for (const e of report.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const { venue, people, modifiers, stock, recipes, service } = data;
  const existing = await prisma.organization.findUnique({
    where: { slug: venue.organization.slug },
  });
  if (existing) {
    console.error(
      `Refusing: this database already holds the venue (organization "${venue.organization.slug}").`,
    );
    process.exit(1);
  }
  const roles = await prisma.role.findMany({
    where: { name: { in: [...new Set(people.map((p) => p.role))] } },
  });
  const roleByName = new Map(roles.map((r) => [r.name, r]));
  for (const p of people)
    if (!roleByName.has(p.role)) {
      console.error(
        `Refusing: role "${p.role}" is not in this database. Run db:seed first (run.sh does).`,
      );
      process.exit(1);
    }

  // Credentials are made now, before the transaction, because bcrypt is slow.
  const creds: {
    key: string;
    name: string;
    role: string;
    email: string;
    password: string;
    pin: string | null;
  }[] = [];
  const hashed = new Map<
    string,
    { passwordHash: string; pin: string | null; pinHash: string | null }
  >();
  for (const p of people) {
    const password = randomPassword();
    const jobRole = roleByName.get(p.role)!.jobRole ?? '';
    const pin = PIN_LENGTH[jobRole] ? randomDigits(PIN_LENGTH[jobRole]) : null;
    hashed.set(p.key, {
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
      pin,
      pinHash: pin ? await bcrypt.hash(pin, SALT_ROUNDS) : null,
    });
    creds.push({
      key: p.key,
      name: `${p.firstName} ${p.lastName}`,
      role: p.role,
      email:
        `${p.firstName}.${p.lastName}`.toLowerCase().replace(/[^a-z.]/g, '') +
        '@tapas-downtown.test',
      password,
      pin,
    });
  }

  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60_000);
  const items = flatItems(data.menu);
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

  await prisma.$transaction(
    async (tx) => {
      // ── Organization and branch ──
      const org = await tx.organization.create({
        data: { name: venue.organization.name, slug: venue.organization.slug },
      });
      const b = venue.branch;
      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: b.name,
          code: b.code,
          slug: b.slug,
          timezone: b.timezone,
          currencyCode: b.currencyCode,
          phone: normalisePhone(b.phone),
          address: b.address,
        },
      });
      const scope = { orgId: org.id, branchId: branch.id };

      // ── Floor: one floor plan per area, tables labelled by area ──
      const planByArea = new Map<string, string>();
      for (const a of venue.areas) {
        const fp = await tx.floorPlan.create({
          data: { ...scope, name: a.name, data: { area: a.name } },
        });
        planByArea.set(a.name, fp.id);
      }
      const tableByLabel = new Map<string, string>();
      for (const t of tableLabels(venue)) {
        const row = await tx.table.create({
          data: {
            ...scope,
            floorPlanId: planByArea.get(t.area)!,
            label: t.label,
            capacity: t.capacity,
            metadata: { area: t.area },
          },
        });
        tableByLabel.set(t.label, row.id);
        bump('tables');
      }

      // ── People: user, membership, role, employee, PIN ──
      const userByKey = new Map<string, string>();
      let empSeq = 0;
      for (const p of people) {
        const c = creds.find((x) => x.key === p.key)!;
        const h = hashed.get(p.key)!;
        const role = roleByName.get(p.role)!;
        const user = await tx.user.create({
          data: {
            email: c.email,
            passwordHash: h.passwordHash,
            firstName: p.firstName,
            lastName: p.lastName,
            displayName: `${p.firstName} ${p.lastName.charAt(0)}.`,
            ...(h.pin
              ? {
                  quickPinHash: h.pinHash,
                  pinLookupHash: lookupHash(branch.id, h.pin),
                  pinLength: h.pin.length,
                  pinTier: h.pin.length === 8 ? 'HIGH_8' : 'LOW_6',
                  quickPinEnabled: true,
                  lastPinChangedAt: new Date(now),
                  quickPinIssuedAt: new Date(now),
                  failedPinAttempts: 0,
                }
              : {}),
          },
        });
        userByKey.set(p.key, user.id);
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            branchId: branch.id,
            roleId: role.id,
            isDefaultBranch: true,
          },
        });
        await tx.employee.create({
          data: {
            ...scope,
            userId: user.id,
            employeeCode: `TD-${String(++empSeq).padStart(3, '0')}`,
            firstName: p.firstName,
            lastName: p.lastName,
            phone: normalisePhone(p.phone),
            email: c.email,
            hireDate: new Date(now - (200 + empSeq * 37) * 86_400_000),
            status: 'ACTIVE',
            employmentType: 'PERMANENT',
          },
        });
        bump('people');
      }

      // ── Menu: Food / Drinks → group → sub-group → item ──
      const groupIds = new Map<string, string>();
      const subgroupIds = new Map<string, { sub: string; cat: string }>();
      let sort = 0;
      for (const s of data.menu.sections)
        for (const g of s.groups) {
          const bg = await tx.menuBrowseGroup.create({
            data: { ...scope, section: s.section, name: g.name, sortOrder: sort++ },
          });
          groupIds.set(g.name, bg.id);
          for (const sg of g.subgroups) {
            const sub = await tx.menuBrowseSubgroup.create({
              data: { groupId: bg.id, name: sg.name, sortOrder: sort++ },
            });
            const cat = await tx.category.create({
              data: { ...scope, name: sg.name, sortOrder: sort },
            });
            subgroupIds.set(sg.name, { sub: sub.id, cat: cat.id });
          }
        }
      const modGroupIds = new Map<string, string>();
      const optionIds = new Map<string, Map<string, string>>();
      for (const [i, m] of modifiers.entries()) {
        const g = await tx.modifierGroup.create({
          data: {
            ...scope,
            name: m.name,
            min: m.min,
            max: m.max,
            required: m.required,
            sortOrder: i,
          },
        });
        modGroupIds.set(m.name, g.id);
        const opts = new Map<string, string>();
        for (const [j, [name, delta]] of m.options.entries()) {
          const o = await tx.modifierOption.create({
            data: { groupId: g.id, name, priceDelta: D(delta), sortOrder: j },
          });
          opts.set(name, o.id);
        }
        optionIds.set(m.name, opts);
      }
      const itemIds = new Map<string, string>();
      const servingIds = new Map<string, Map<string, string>>();
      for (const [i, it] of items.entries()) {
        const ids = subgroupIds.get(it.subgroup)!;
        const mi = await tx.menuItem.create({
          data: {
            ...scope,
            categoryId: ids.cat,
            browseGroupId: groupIds.get(it.group)!,
            browseSubgroupId: ids.sub,
            name: it.name,
            description: it.description ?? null,
            price: D(it.price),
            itemType: it.itemType,
            station: it.station,
            sortOrder: i,
          },
        });
        itemIds.set(it.name, mi.id);
        const sv = new Map<string, string>();
        for (const [j, [format, label, price]] of it.servings.entries()) {
          const row = await tx.menuItemServing.create({
            data: {
              menuItemId: mi.id,
              format: format as never,
              label,
              price: D(price),
              isDefault: j === 0,
              sortOrder: j,
            },
          });
          sv.set(label, row.id);
        }
        servingIds.set(it.name, sv);
        for (const [j, c] of it.choices.entries())
          await tx.menuItemOnGroup.create({
            data: { itemId: mi.id, groupId: modGroupIds.get(c)!, sortOrder: j },
          });
        bump('menuItems');
      }

      // ── Stock and recipes ──
      const stockIds = new Map<string, { id: string; unit: string; cost: number }>();
      for (const s of stock) {
        const row = await tx.inventoryItem.create({
          data: {
            ...scope,
            sku: s.sku,
            name: s.name,
            unit: s.unit,
            category: s.category,
            theoreticalUnitCost: D(s.unitCost),
            reorderLevel: D(s.reorderLevel),
            reorderQty: D(s.reorderQty),
          },
        });
        stockIds.set(s.sku, { id: row.id, unit: s.unit, cost: s.unitCost });
        bump('stockItems');
      }
      for (const [itemName, lines] of Object.entries(recipes)) {
        for (const [sku, qty, waste] of lines) {
          const st = stockIds.get(sku)!;
          await tx.recipeIngredient.create({
            data: {
              ...scope,
              menuItemId: itemIds.get(itemName)!,
              inventoryItemId: st.id,
              qtyPerUnit: D(qty),
              wastePct: D(waste),
              unit: st.unit,
            },
          });
        }
        bump('recipes');
      }
      const costOf = (itemName: string) => {
        const lines = recipes[itemName];
        if (!lines) return null;
        let c = D(0);
        for (const [sku, qty, waste] of lines)
          c = c.add(
            D(qty)
              .mul(D(1).add(D(waste).div(100)))
              .mul(D(stockIds.get(sku)!.cost)),
          );
        return c;
      };

      // ── Shifts and the till ──
      const shiftByKey = new Map<string, string>();
      let shiftSeq = 0;
      // Numbered oldest first, with createdAt set: inside one transaction now() is one instant,
      // and the API's next number is read from the newest createdAt (shifts.service.ts:41-51).
      for (const s of [...service.shifts].sort((x, y) => y.openedMinutesAgo - x.openedMinutesAgo)) {
        const row = await tx.shift.create({
          data: {
            ...scope,
            shiftNumber: `SHF-${String(++shiftSeq).padStart(6, '0')}`,
            openedById: userByKey.get(s.by)!,
            openedAt: ago(s.openedMinutesAgo),
            status: 'OPEN',
            createdAt: ago(s.openedMinutesAgo),
          },
        });
        shiftByKey.set(s.by, row.id);
      }
      const till = service.till;
      const tillShift = shiftByKey.get(till.operator) ?? [...shiftByKey.values()][0];

      // ── Orders: every open table and every paid bill, numbered in time order ──
      type Plan = {
        kind: 'open' | 'paid';
        at: number;
        table: string;
        waiter: string;
        lines: LineRow[];
        newLines: LineRow[];
        state?: string;
        payments?: [string, number][];
        booking?: string;
      };
      const plans: Plan[] = [
        ...service.paidBills.map((p) => ({
          kind: 'paid' as const,
          at: p.minutesAgo,
          table: p.table,
          waiter: p.waiter,
          lines: p.lines,
          newLines: [],
          payments: p.payments,
          booking: p.seatedBooking,
        })),
        ...service.openTables.map((t) => ({
          kind: 'open' as const,
          at: t.minutesAgo,
          table: t.table,
          waiter: t.waiter,
          lines: t.lines,
          newLines: t.newLines ?? [],
          state: t.state,
          booking: t.seatedBooking,
        })),
      ].sort((a, b) => b.at - a.at);

      const orderByBooking = new Map<string, string>();
      let orderSeq = 0;
      let cashTaken = D(0);
      for (const plan of plans) {
        const createdAt = ago(plan.at);
        const status =
          plan.kind === 'paid'
            ? 'CLOSED'
            : plan.state === 'not-sent'
              ? 'NEW'
              : plan.state === 'in-kitchen'
                ? 'IN_KITCHEN'
                : plan.state === 'ready'
                  ? 'READY'
                  : plan.state === 'served' || plan.state === 'bill-asked'
                    ? 'SERVED'
                    : 'SENT';
        const order = await tx.order.create({
          data: {
            ...scope,
            tableId: tableByLabel.get(plan.table)!,
            userId: userByKey.get(plan.waiter)!,
            orderNumber: `ORD-${String(++orderSeq).padStart(6, '0')}`,
            status,
            serviceType: 'DINE_IN',
            tillCode: plan.kind === 'paid' ? till.code : null,
            createdAt,
            updatedAt: createdAt,
          },
        });
        if (plan.booking) orderByBooking.set(plan.booking, order.id);
        const sentAt = status === 'NEW' ? null : new Date(createdAt.getTime() + 4 * 60_000);
        let subtotal = D(0);
        const sentLineIds: { id: string; station: string }[] = [];
        const writeLines = async (lines: LineRow[], sent: Date | null, offsetMin: number) => {
          for (const [name, qty, servingLabel, opts] of lines) {
            const it = items.find((x) => x.name === name)!;
            const servingId = servingLabel ? servingIds.get(name)!.get(servingLabel)! : null;
            const base = servingLabel
              ? it.servings.find((s) => s[1] === servingLabel)![2]
              : it.price;
            const picked = (opts ?? []).map((o) => {
              for (const c of it.choices) {
                const g = modifiers.find((m) => m.name === c)!;
                const op = g.options.find((x) => x[0] === o);
                if (op) return { group: c, name: o, delta: op[1], id: optionIds.get(c)!.get(o)! };
              }
              throw new Error(`unreachable: ${name}/${o}`);
            });
            const unit = D(base).add(picked.reduce((n, p) => n + p.delta, 0));
            const lineSubtotal = unit.mul(qty);
            const cu = costOf(name);
            const line = await tx.orderItem.create({
              data: {
                orderId: order.id,
                menuItemId: itemIds.get(name)!,
                menuItemServingId: servingId,
                quantity: qty,
                price: unit.toDecimalPlaces(2),
                subtotal: lineSubtotal.toDecimalPlaces(2),
                metadata: picked.length
                  ? {
                      selectedModifiers: picked.map((p) => ({
                        modifierOptionId: p.id,
                        groupName: p.group,
                        name: p.name,
                        priceDelta: String(p.delta),
                      })),
                    }
                  : Prisma.JsonNull,
                costUnit: cu ? cu.toDecimalPlaces(2) : null,
                costTotal: cu ? cu.mul(qty).toDecimalPlaces(2) : null,
                marginTotal: cu ? lineSubtotal.sub(cu.mul(qty)).toDecimalPlaces(2) : null,
                marginPct:
                  cu && lineSubtotal.gt(0)
                    ? lineSubtotal.sub(cu.mul(qty)).div(lineSubtotal).mul(100).toDecimalPlaces(2)
                    : null,
                sentAt: sent,
                createdAt: new Date(createdAt.getTime() + offsetMin * 60_000),
              },
            });
            subtotal = subtotal.add(lineSubtotal);
            if (sent && it.station !== 'NONE')
              sentLineIds.push({ id: line.id, station: it.station });
            bump('orderLines');
          }
        };
        await writeLines(plan.lines, sentAt, 1);
        // Tickets: one per station for the first send, made of exactly the lines it sent.
        const ticketStatus =
          plan.kind === 'paid' || ['ready', 'served', 'bill-asked'].includes(plan.state ?? '')
            ? 'READY'
            : 'QUEUED';
        const byStation = new Map<string, string[]>();
        for (const l of sentLineIds)
          byStation.set(l.station, [...(byStation.get(l.station) ?? []), l.id]);
        for (const [station, ids] of byStation) {
          await tx.kdsTicket.create({
            data: {
              ...scope,
              orderId: order.id,
              station,
              status: ticketStatus as never,
              startedAt: sentAt!,
              readyAt: ticketStatus === 'READY' ? new Date(sentAt!.getTime() + 14 * 60_000) : null,
              createdAt: sentAt!,
              items: { create: ids.map((orderItemId) => ({ orderItemId })) },
            },
          });
          bump('kitchenTickets');
        }
        // Lines added after the first send wait, unsent, for the next send (no ticket yet).
        await writeLines(plan.newLines, null, Math.max(2, plan.at - 5));

        const total = subtotal.toDecimalPlaces(2);
        await tx.order.update({ where: { id: order.id }, data: { subtotal: total, total } });
        if (sentAt) {
          await tx.auditLog.create({
            data: {
              actorUserId: userByKey.get(plan.waiter)!,
              action: 'ORDER_SENT',
              entityType: 'order',
              entityId: order.id,
              metadata: {
                ...scope,
                branchId: branch.id,
                previousStatus: 'NEW',
                newStatus: 'SENT',
                source: 'demo-venue',
              },
              createdAt: sentAt,
            },
          });
        }
        if (plan.state === 'bill-asked') {
          // The engine's own marker for "bill asked" (orders.service.ts requestBill): an audit row.
          await tx.auditLog.create({
            data: {
              actorUserId: userByKey.get(plan.waiter)!,
              action: 'ORDER_BILL_REQUESTED',
              entityType: 'order',
              entityId: order.id,
              metadata: {
                orgId: org.id,
                branchId: branch.id,
                orderStatus: 'SERVED',
                source: 'demo-venue',
              },
              createdAt: ago(Math.max(1, plan.at - 60)),
            },
          });
        }

        if (plan.kind === 'paid') {
          // Same arithmetic as payments.service.ts closeOrderWithPayment: non-cash must fit, cash
          // may be more, the last cash row absorbs the change; amount = what was applied.
          const due = total;
          const handed = plan.payments!.reduce((n, [, a]) => n.add(a), D(0));
          if (handed.lt(due))
            throw new Error(`paid bill ${plan.table}: ${handed} handed over on ${due}`);
          const change = handed.sub(due);
          const lastCash = plan.payments!.map((p) => p[0]).lastIndexOf('CASH');
          if (change.gt(0) && lastCash === -1)
            throw new Error(`paid bill ${plan.table}: overpaid without cash`);
          const paidAt = ago(Math.max(1, plan.at - 70));
          for (const [i, [method, amount]] of plan.payments!.entries()) {
            const isChangeRow = change.gt(0) && i === lastCash;
            const applied = isChangeRow ? D(amount).sub(change) : D(amount);
            await tx.payment.create({
              data: {
                ...scope,
                orderId: order.id,
                amount: applied,
                method: method as never,
                status: 'COMPLETED',
                captureMode: 'ONLINE_PROVIDER',
                tendered: method === 'CASH' ? D(amount) : null,
                changeGiven: method === 'CASH' ? (isChangeRow ? change : D(0)) : null,
                transactionId: method === 'CASH' ? null : `DEMO-${order.orderNumber}-${i + 1}`,
                postedAt: paidAt,
                tillCode: till.code,
                enteredById: userByKey.get(till.operator)!,
                createdAt: paidAt,
              },
            });
            if (method === 'CASH') cashTaken = cashTaken.add(applied);
            bump('payments');
          }
          await tx.auditLog.create({
            data: {
              actorUserId: userByKey.get(till.operator)!,
              action: 'ORDER_PAID_AND_CLOSED',
              entityType: 'order',
              entityId: order.id,
              metadata: {
                orgId: org.id,
                branchId: branch.id,
                newStatus: 'CLOSED',
                closedVia: 'payment',
                changeDue: change.toFixed(2),
                source: 'demo-venue',
              },
              createdAt: paidAt,
            },
          });
          await tx.order.update({ where: { id: order.id }, data: { updatedAt: paidAt } });
          bump('paidBills');
        } else {
          bump('openTables');
          // The engine occupies a table on the first send, or when a booking is seated on it.
          if (status !== 'NEW' || plan.booking)
            await tx.table.update({
              where: { id: tableByLabel.get(plan.table)! },
              data: { status: 'OCCUPIED' },
            });
        }
      }

      await tx.tillSession.create({
        data: {
          ...scope,
          shiftId: tillShift,
          tillCode: till.code,
          operatorUserId: userByKey.get(till.operator)!,
          openedById: userByKey.get(till.openedBy)!,
          openedAt: ago(till.openedMinutesAgo),
          openingFloat: D(till.openingFloat),
          expectedCash: D(till.openingFloat).add(cashTaken),
          status: 'OPEN',
        },
      });

      // ── Bookings for today, numbered in the order they were taken ──
      let resSeq = 0;
      const sorted = [...service.bookings].sort((a, b) => a.minutesFromNow - b.minutesFromNow);
      for (const bk of sorted) {
        const at = new Date(now + bk.minutesFromNow * 60_000);
        const taken = ago(600 - resSeq * 13); // later numbers taken later: the generator reads the newest
        const seatedOrderId = orderByBooking.get(bk.key) ?? null;
        await tx.reservation.create({
          data: {
            ...scope,
            reservationNumber: `RES-${String(++resSeq).padStart(6, '0')}`,
            customerName: bk.customerName,
            customerPhone: normalisePhone(bk.phone),
            partySize: bk.partySize,
            reservationAt: at,
            expectedDurationMinutes: 90,
            source: bk.source,
            status: bk.status,
            notes: bk.note ?? null,
            tableId: bk.table ? tableByLabel.get(bk.table)! : null,
            seatedOrderId,
            confirmedAt: bk.status === 'PENDING' ? null : taken,
            seatedAt: ['SEATED', 'COMPLETED'].includes(bk.status) ? at : null,
            completedAt: bk.status === 'COMPLETED' ? ago(30) : null,
            cancelledAt: bk.status === 'CANCELLED' ? ago(120) : null,
            noShowAt: bk.status === 'NO_SHOW' ? ago(20) : null,
            createdById: userByKey.get(service.till.openedBy)!,
            createdAt: taken,
          },
        });
        bump('bookingsToday');
      }
    },
    { timeout: 300_000, maxWait: 30_000 },
  );

  console.log('Tapas Downtown loaded:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(16)} ${v}`);

  // Sign-in, shown once, on stderr. Not written anywhere.
  console.error(
    '\nSign-in for this database only (shown once, kept nowhere; PIN sign-in is POS_DESKTOP):',
  );
  console.error(
    `  ${'key'.padEnd(12)} ${'role'.padEnd(14)} ${'email'.padEnd(40)} ${'password'.padEnd(22)} PIN`,
  );
  for (const c of creds)
    console.error(
      `  ${c.key.padEnd(12)} ${c.role.padEnd(14)} ${c.email.padEnd(40)} ${c.password.padEnd(22)} ${c.pin ?? '(none: role has no PIN)'}`,
    );
}

main()
  .catch((e) => {
    console.error(`Load failed, nothing was written: ${(e as Error).message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
