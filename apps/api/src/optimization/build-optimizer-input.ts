import { OptimizerRunInput, StrategyType } from "@railopt/contracts";
import { loadSolverSettingsV1 } from "@railopt/config";
import { PrismaService } from "../prisma/prisma.service";

/** Builds the OptimizerRunInput JSON contract from live Prisma data for one
 * scenario. This is the Nest-side counterpart to
 * packages/test-fixtures/scripts/export-optimizer-fixture.ts, which does
 * the same transform from the TypeScript generator's output instead of the
 * database - both produce the same OptimizerRunInput shape. */
export async function buildOptimizerInput(
  prisma: PrismaService,
  scenarioId: string,
  strategy: StrategyType,
): Promise<OptimizerRunInput> {
  const [corridors, trackResources, maintenanceRequests, taskCompatibilityRules, blockWindows, trainMovements] =
    await Promise.all([
      prisma.corridor.findMany(),
      prisma.trackResource.findMany(),
      prisma.maintenanceRequest.findMany({
        where: { scenarioId },
        include: { asset: true, requiredResources: true },
      }),
      prisma.taskCompatibilityRule.findMany(),
      prisma.blockWindow.findMany({ where: { scenarioId } }),
      prisma.trainMovement.findMany({ where: { scenarioId } }),
    ]);

  const maintenanceRequestIds = maintenanceRequests.map((r) => r.id);
  const requestDependencies = await prisma.requestDependency.findMany({
    where: {
      predecessorId: { in: maintenanceRequestIds },
      successorId: { in: maintenanceRequestIds },
    },
  });

  const solverSettings = loadSolverSettingsV1();

  return {
    scenarioId,
    strategy,
    configVersion: solverSettings.version,
    corridors: corridors.map((c) => ({ id: c.id, code: c.code })),
    trackResources: trackResources.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      corridorId: r.corridorId,
      capacity: r.capacity,
    })),
    maintenanceRequests: maintenanceRequests.map((r) => ({
      id: r.id,
      department: r.department,
      assetId: r.assetId,
      assetCriticality: r.asset.criticality,
      corridorId: r.corridorId,
      segmentId: r.segmentId,
      workType: r.workType,
      criticality: r.criticality,
      urgency: r.urgency,
      dueDate: r.dueDate.toISOString(),
      estimatedDurationMinutes: r.estimatedDurationMinutes,
      requiredIsolation: r.requiredIsolation,
      requiredPower: r.requiredPower,
      requiredResources: r.requiredResources.map((rr) => ({ resourceId: rr.trackResourceId, quantity: rr.quantity })),
      status: r.status,
    })),
    requestDependencies: requestDependencies.map((d) => ({ predecessorId: d.predecessorId, successorId: d.successorId })),
    taskCompatibilityRules: taskCompatibilityRules.map((r) => ({
      workTypeA: r.workTypeA,
      workTypeB: r.workTypeB,
      department: r.department,
      compatible: r.compatible,
    })),
    blockWindows: blockWindows.map((w) => ({
      id: w.id,
      corridorId: w.corridorId,
      segmentId: w.segmentId,
      startTime: w.startTime.toISOString(),
      endTime: w.endTime.toISOString(),
      durationMinutes: w.durationMinutes,
      permittedDepartments: w.permittedDepartments,
      allowsIsolationTypes: w.allowsIsolationTypes,
      allowsPowerTypes: w.allowsPowerTypes,
      maxConcurrentResources: w.maxConcurrentResources,
    })),
    trainMovements: trainMovements.map((t) => ({
      id: t.id,
      trainNumber: t.trainNumber,
      trainType: t.trainType,
      corridorId: t.corridorId,
      segmentId: t.segmentId,
      trackResourceId: t.trackResourceId,
      scheduledStart: t.scheduledStart.toISOString(),
      scheduledEnd: t.scheduledEnd.toISOString(),
      priority: t.priority,
    })),
    options: {
      timeLimitSeconds: solverSettings.timeLimitSeconds,
      randomSeed: solverSettings.randomSeed,
      asOf: new Date().toISOString(),
    },
  };
}
