import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill of entries...");

  // fetch entries missing relation
  const allAi = await prisma.aiEntry.findMany({ select: { id: true, userId: true, createdAt: true, userRef: true } });
  const allManual = await prisma.manualEntry.findMany({ select: { id: true, userId: true, createdAt: true, userRef: true } });
  const aiToUpdate = allAi.filter((e) => !e.userRef);
  const manualToUpdate = allManual.filter((e) => !e.userRef);

  // fetch users once for heuristic matching
  const users = await prisma.user.findMany({ select: { id: true, userId: true, createdAt: true } });

  const updatedAi: any[] = [];
  for (const e of aiToUpdate) {
    // if entry already carries userId, try linking directly
    if (e.userId) {
      const user = users.find((u) => u.userId === e.userId);
      if (user) {
        const u = await prisma.aiEntry.update({ where: { id: e.id }, data: { userRef: user.id } });
        updatedAi.push(u);
        console.log(`Linked AI entry ${e.id} -> userRef ${user.id} by userId`);
        continue;
      }
    }

    // heuristic: find nearest user by createdAt within threshold (120s)
    if (e.createdAt) {
      let best: any = null;
      let bestDiff = Number.MAX_SAFE_INTEGER;
      for (const u of users) {
        if (!u.createdAt) continue;
        const diff = Math.abs(new Date(e.createdAt).getTime() - new Date(u.createdAt).getTime());
        if (diff < bestDiff) {
          bestDiff = diff;
          best = u;
        }
      }
      if (best && bestDiff <= 120_000) {
        const u = await prisma.aiEntry.update({ where: { id: e.id }, data: { userRef: best.id, userId: best.userId } });
        updatedAi.push(u);
        console.log(`Heuristically linked AI entry ${e.id} -> userRef ${best.id} (diff ${bestDiff}ms)`);
      }
    }
  }

  const updatedManual: any[] = [];
  for (const e of manualToUpdate) {
    if (e.userId) {
      const user = users.find((u) => u.userId === e.userId);
      if (user) {
        const u = await prisma.manualEntry.update({ where: { id: e.id }, data: { userRef: user.id } });
        updatedManual.push(u);
        console.log(`Linked Manual entry ${e.id} -> userRef ${user.id} by userId`);
        continue;
      }
    }

    if (e.createdAt) {
      let best: any = null;
      let bestDiff = Number.MAX_SAFE_INTEGER;
      for (const u of users) {
        if (!u.createdAt) continue;
        const diff = Math.abs(new Date(e.createdAt).getTime() - new Date(u.createdAt).getTime());
        if (diff < bestDiff) {
          bestDiff = diff;
          best = u;
        }
      }
      if (best && bestDiff <= 120_000) {
        const u = await prisma.manualEntry.update({ where: { id: e.id }, data: { userRef: best.id, userId: best.userId } });
        updatedManual.push(u);
        console.log(`Heuristically linked Manual entry ${e.id} -> userRef ${best.id} (diff ${bestDiff}ms)`);
      }
    }
  }

  console.log(`Backfill complete. AI updated: ${updatedAi.length}, Manual updated: ${updatedManual.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
