// T2 — shared helpers for the T2 e2e specs (new file; existing helpers are not edited).
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma';

export const DEMO = {
  owner: ['owner@demo.local', 'Owner#123'],
  manager: ['manager@demo.local', 'Manager#123'],
  supervisor: ['supervisor@demo.local', 'Supervisor#123'],
  waiter: ['waiter@demo.local', 'Waiter#123'],
  chef: ['chef@demo.local', 'Chef#123'],
} as const;

export interface T2World {
  app: INestApplication;
  prisma: PrismaService;
  branchId: string;
  orgId: string;
  categoryId: string;
  run: string;
  tokens: Record<keyof typeof DEMO | 'cashier', string>;
  http: () => request.SuperTest<request.Test>;
  as: (token: string) => Record<string, string>;
}

export async function bootWorld(): Promise<T2World> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  // Listen once on a real port: supertest given a non-listening server starts one per
  // request, and thirty requests at once then reset each other (ECONNRESET).
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const prisma = app.get(PrismaService);
  const http = () => request(baseUrl) as unknown as request.SuperTest<request.Test>;

  const tokens = {} as Record<keyof typeof DEMO | 'cashier', string>;
  for (const [k, [email, password]] of Object.entries(DEMO)) {
    const r = await http().post('/api/auth/login').send({ email, password });
    if (r.status !== 201) throw new Error(`login ${k} gave ${r.status}`);
    tokens[k as keyof typeof DEMO] = r.body.accessToken;
  }
  const me = await http().get('/api/auth/me').set('Authorization', `Bearer ${tokens.owner}`);
  const branchId: string = me.body.context?.defaultBranchId;
  const branch = await prisma.branch.findUniqueOrThrow({
    where: { id: branchId },
    select: { organizationId: true },
  });
  const cat = await prisma.category.findFirstOrThrow({ where: { branchId } });
  const w: T2World = {
    app,
    prisma,
    branchId,
    orgId: branch.organizationId,
    categoryId: cat.id,
    run: Date.now().toString(36),
    tokens,
    http,
    as: (token: string) => ({ Authorization: `Bearer ${token}`, 'X-Branch-Id': branchId }),
  };
  // The demo cashier's password is changed by bg1-onboarding's reset flow (T4 finding C2),
  // so the T2 specs bring their own cashier instead of depending on the order of files.
  tokens.cashier = (await makeStaff(w, 'Cashier', 'Cashier')).token;
  return w;
}

let staffSeq = 0;
/**
 * A throwaway staff member for this run: user, role, membership in the test branch, and a
 * random password made here and never written anywhere. Fictional names only.
 */
export async function makeStaff(w: T2World, roleName: string, firstName: string) {
  const password = `T2-${randomBytes(12).toString('base64url')}#1a`;
  const email = `t2.${roleName.toLowerCase()}.${w.run}.${++staffSeq}@example.test`;
  const role = await w.prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const user = await w.prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 4),
      firstName,
      lastName: `T2 ${staffSeq}`,
    },
  });
  await w.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  await w.prisma.membership.create({
    data: {
      userId: user.id,
      organizationId: w.orgId,
      branchId: w.branchId,
      roleId: role.id,
      isDefaultBranch: true,
    },
  });
  const r = await w.http().post('/api/auth/login').send({ email, password });
  if (r.status !== 201) throw new Error(`login ${roleName} gave ${r.status}`);
  return { id: user.id, token: r.body.accessToken as string, firstName };
}

export async function makeItem(
  w: T2World,
  name: string,
  price: number,
  station: 'KITCHEN' | 'BAR',
  extra: Record<string, unknown> = {},
) {
  return w.prisma.menuItem.create({
    data: {
      orgId: w.orgId,
      branchId: w.branchId,
      categoryId: w.categoryId,
      name: `${name} ${w.run}`,
      price,
      itemType: station === 'BAR' ? 'DRINK' : 'FOOD',
      station,
      ...extra,
    },
  });
}

export async function makeTable(w: T2World, label: string, capacity = 4) {
  return w.prisma.table.create({
    data: { orgId: w.orgId, branchId: w.branchId, label: `${label}-${w.run}`, capacity },
  });
}

/** Opens the user's shift if they have none (waiters need one to write). */
export async function ensureShift(w: T2World, token: string) {
  const open = await w.http().post('/api/shifts/open').set(w.as(token)).send({});
  if (open.status === 201 || open.status === 200) return open.body.id as string;
  const active = await w.http().get('/api/shifts/active').set(w.as(token));
  return (active.body?.id ?? active.body?.shift?.id) as string;
}

export async function openOrder(w: T2World, token: string, tableId: string) {
  const r = await w
    .http()
    .post('/api/pos/orders')
    .set(w.as(token))
    .send({ serviceType: 'DINE_IN', tableId });
  if (r.status !== 201) throw new Error(`open order gave ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.id as string;
}

export function addLine(
  w: T2World,
  token: string,
  orderId: string,
  menuItemId: string,
  quantity = 1,
  extra: Record<string, unknown> = {},
): request.Test {
  return w
    .http()
    .post(`/api/pos/orders/${orderId}/items`)
    .set(w.as(token))
    .send({ menuItemId, quantity, ...extra });
}

export const send = (
  w: T2World,
  token: string,
  orderId: string,
  body: Record<string, unknown> = {},
): request.Test => w.http().post(`/api/pos/orders/${orderId}/send`).set(w.as(token)).send(body);
