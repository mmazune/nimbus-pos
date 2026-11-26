import { Prisma, PrismaClient } from '@prisma/client';

/**
 * T2 phase 2 (E3): every table sits in an area, or the Floor never shows it. A table made
 * without one goes into the area named after its floor plan, else the branch's "Tables" area;
 * either is made if it does not exist yet (the same rule the phase 2 migration backfilled).
 */
export async function areaForNewTable(
  db: PrismaClient | Prisma.TransactionClient,
  ctx: { organizationId: string; branchId: string },
  floorPlanId?: string | null,
): Promise<string> {
  let name = 'Tables';
  if (floorPlanId) {
    const fp = await db.floorPlan.findFirst({ where: { id: floorPlanId, branchId: ctx.branchId } });
    if (fp) name = fp.name;
  }
  const found = await db.area.findUnique({
    where: { branchId_name: { branchId: ctx.branchId, name } },
  });
  if (found) return found.id;
  try {
    const made = await db.area.create({
      data: { orgId: ctx.organizationId, branchId: ctx.branchId, name, kind: 'TABLES' },
    });
    return made.id;
  } catch (e) {
    // made by someone else at the same moment
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const again = await db.area.findUniqueOrThrow({
        where: { branchId_name: { branchId: ctx.branchId, name } },
      });
      return again.id;
    }
    throw e;
  }
}
