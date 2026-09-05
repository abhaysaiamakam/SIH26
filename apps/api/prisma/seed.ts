// Loads a deterministic synthetic scenario (see data/synthetic/generator)
// into Postgres via Prisma, in FK-safe order. Usage:
//   pnpm --filter @railopt/api run seed [seed-number]
// Re-running with the same seed number is idempotent: existing scenario
// data for that seed is deleted and reloaded.

import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { generateScenario } from "@railopt/data-synthetic";

const prisma = new PrismaClient();

const DEMO_USERS: { email: string; name: string; roles: Role[] }[] = [
  { email: "admin@railopt.demo", name: "Ravi Admin", roles: ["ADMIN"] },
  { email: "field.engineer@railopt.demo", name: "Field Engineer", roles: ["FIELD_ENGINEER"] },
  { email: "dept.planner@railopt.demo", name: "Department Planner", roles: ["DEPARTMENT_PLANNER"] },
  { email: "div.planner@railopt.demo", name: "Divisional Planner", roles: ["DIVISIONAL_PLANNER"] },
  { email: "control.operator@railopt.demo", name: "Control Operator", roles: ["CONTROL_OPERATOR"] },
  { email: "management@railopt.demo", name: "Management", roles: ["MANAGEMENT"] },
];
const DEMO_PASSWORD = "railopt-demo-2026";

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name, passwordHash },
    });
    for (const role of u.roles) {
      // Compound-unique lookups can't take a null divisionId in Prisma
      // (SQL NULL <> NULL means the constraint doesn't dedupe it either),
      // so check-then-create instead of upsert.
      const existing = await prisma.roleAssignment.findFirst({ where: { userId: user.id, role, divisionId: null } });
      if (!existing) {
        await prisma.roleAssignment.create({ data: { userId: user.id, role } });
      }
    }
  }
  console.log(`Seeded ${DEMO_USERS.length} demo users (password: "${DEMO_PASSWORD}" for all).`);
}

async function main() {
  await seedUsers();

  const seedArg = process.argv[2];
  const seed = seedArg ? Number(seedArg) : 42;
  console.log(`Generating synthetic scenario with seed ${seed}...`);
  const s = generateScenario(seed);

  const existing = await prisma.planningScenario.findFirst({ where: { seed } });
  if (existing) {
    console.log(`Removing existing scenario for seed ${seed} (${existing.id})...`);

    // Planning artifacts (Plan/PlanRevision/PlanBlock/PlanTask/etc.) hold FK
    // references down to MaintenanceRequest, so they must be cleared first -
    // a reseed is a dev-time reset of everything derived from this scenario.
    const oldPlans = await prisma.plan.findMany({ where: { scenarioId: existing.id }, select: { id: true } });
    const oldPlanIds = oldPlans.map((p) => p.id);
    const oldRevisions = await prisma.planRevision.findMany({ where: { planId: { in: oldPlanIds } }, select: { id: true } });
    const oldRevisionIds = oldRevisions.map((r) => r.id);
    await prisma.approvalDecision.deleteMany({ where: { planRevisionId: { in: oldRevisionIds } } });
    await prisma.validationRun.deleteMany({ where: { planRevisionId: { in: oldRevisionIds } } });
    await prisma.simulationRun.deleteMany({ where: { planRevisionId: { in: oldRevisionIds } } });
    await prisma.planTask.deleteMany({ where: { planRevisionId: { in: oldRevisionIds } } });
    await prisma.planBlock.deleteMany({ where: { planRevisionId: { in: oldRevisionIds } } });
    await prisma.planningRun.updateMany({ where: { scenarioId: existing.id }, data: { resultPlanId: null } });
    await prisma.planRevision.deleteMany({ where: { id: { in: oldRevisionIds } } });
    await prisma.plan.deleteMany({ where: { id: { in: oldPlanIds } } });
    await prisma.planningRun.deleteMany({ where: { scenarioId: existing.id } });

    const oldRequests = await prisma.maintenanceRequest.findMany({
      where: { scenarioId: existing.id },
      select: { id: true },
    });
    const oldRequestIds = oldRequests.map((r) => r.id);
    await prisma.maintenanceRequestResource.deleteMany({
      where: { maintenanceRequestId: { in: oldRequestIds } },
    });
    await prisma.requestDependency.deleteMany({
      where: { OR: [{ predecessorId: { in: oldRequestIds } }, { successorId: { in: oldRequestIds } }] },
    });
    await prisma.maintenanceRequest.deleteMany({ where: { scenarioId: existing.id } });
    await prisma.blockWindow.deleteMany({ where: { scenarioId: existing.id } });
    await prisma.trainMovement.deleteMany({ where: { scenarioId: existing.id } });
    await prisma.scenarioEvent.deleteMany({ where: { scenarioId: existing.id } });
    await prisma.planningScenario.delete({ where: { id: existing.id } });
  }

  console.log("Loading reference data...");
  await prisma.division.createMany({ data: s.divisions, skipDuplicates: true });
  await prisma.station.createMany({ data: s.stations, skipDuplicates: true });
  await prisma.corridor.createMany({ data: s.corridors, skipDuplicates: true });
  await prisma.corridorSegment.createMany({ data: s.segments, skipDuplicates: true });
  await prisma.trackResource.createMany({ data: s.trackResources, skipDuplicates: true });
  await prisma.asset.createMany({
    data: s.assets.map((a) => ({
      ...a,
      installDate: new Date(a.installDate),
      lastMaintenanceDate: a.lastMaintenanceDate ? new Date(a.lastMaintenanceDate) : null,
    })),
    skipDuplicates: true,
  });

  console.log("Creating planning scenario...");
  await prisma.planningScenario.create({
    data: {
      id: s.scenario.id,
      name: s.scenario.name,
      seed: s.scenario.seed,
      description: s.scenario.description,
      configVersion: s.scenario.configVersion,
      generatedAt: new Date(s.scenario.generatedAt),
    },
  });

  console.log(`Loading ${s.maintenanceRequests.length} maintenance requests...`);
  for (const r of s.maintenanceRequests) {
    await prisma.maintenanceRequest.create({
      data: {
        id: r.id,
        requestNumber: r.requestNumber,
        department: r.department,
        assetId: r.assetId,
        corridorId: r.corridorId,
        segmentId: r.segmentId,
        workType: r.workType,
        description: r.description,
        criticality: r.criticality,
        urgency: r.urgency,
        dueDate: new Date(r.dueDate),
        estimatedDurationMinutes: r.estimatedDurationMinutes,
        requiredIsolation: r.requiredIsolation,
        requiredPower: r.requiredPower,
        status: r.status as never,
        scenarioId: s.scenario.id,
        requiredResources: {
          create: r.requiredResources.map((rr) => ({
            trackResourceId: rr.trackResourceId,
            quantity: rr.quantity,
          })),
        },
      },
    });
  }

  console.log(`Loading ${s.requestDependencies.length} request dependencies...`);
  for (const dep of s.requestDependencies) {
    await prisma.requestDependency.create({
      data: { predecessorId: dep.predecessorId, successorId: dep.successorId },
    });
  }

  console.log(`Loading ${s.taskCompatibilityRules.length} explicit compatibility rules...`);
  // Postgres unique constraints do not de-duplicate NULL columns (department
  // is nullable here), so skipDuplicates cannot be relied on across reseeds -
  // clear and reinsert this small, generator-owned rule set instead.
  await prisma.taskCompatibilityRule.deleteMany({});
  await prisma.taskCompatibilityRule.createMany({
    data: s.taskCompatibilityRules.map((rule) => ({
      workTypeA: rule.workTypeA,
      workTypeB: rule.workTypeB,
      department: rule.department,
      compatible: rule.compatible,
      reason: rule.reason,
    })),
    skipDuplicates: true,
  });

  console.log(`Loading ${s.blockWindows.length} block windows...`);
  await prisma.blockWindow.createMany({
    data: s.blockWindows.map((w) => ({
      ...w,
      startTime: new Date(w.startTime),
      endTime: new Date(w.endTime),
      scenarioId: s.scenario.id,
    })),
    skipDuplicates: true,
  });

  console.log(`Loading ${s.trainMovements.length} train movements...`);
  await prisma.trainMovement.createMany({
    data: s.trainMovements.map((t) => ({
      ...t,
      scheduledStart: new Date(t.scheduledStart),
      scheduledEnd: new Date(t.scheduledEnd),
      scenarioId: s.scenario.id,
    })),
    skipDuplicates: true,
  });

  console.log(`Loading ${s.scenarioEvents.length} scenario events...`);
  await prisma.scenarioEvent.createMany({
    data: s.scenarioEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      source: e.source,
      payload: e.payload as object,
      scenarioId: s.scenario.id,
    })),
    skipDuplicates: true,
  });

  console.log(`Done. Scenario ${s.scenario.id} (seed ${seed}) loaded.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
