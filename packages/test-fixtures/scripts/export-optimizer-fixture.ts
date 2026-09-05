// Exports a deterministic OptimizerRunInput JSON fixture from the
// TypeScript synthetic generator, so both the Jest and pytest suites can
// parse the exact same document and catch any drift between the
// TypeScript contract (packages/contracts/src/optimizer.ts) and the
// pydantic mirror (services/optimizer/src/schemas.py) without codegen.
//
// Usage: pnpm --filter @railopt/test-fixtures run export:optimizer [seed]

import { writeFileSync } from "fs";
import { join } from "path";
import { generateScenario } from "@railopt/data-synthetic";
import { OptimizerRunInput } from "@railopt/contracts";

function buildOptimizerInput(seed: number): OptimizerRunInput {
  const s = generateScenario(seed);
  const assetById = new Map(s.assets.map((a) => [a.id, a]));

  return {
    scenarioId: s.scenario.id,
    strategy: "OPTIMIZED",
    configVersion: s.scenario.configVersion,
    corridors: s.corridors.map((c) => ({ id: c.id, code: c.code })),
    trackResources: s.trackResources.map((r) => ({
      id: r.id,
      code: r.code,
      type: r.type,
      corridorId: r.corridorId,
      capacity: r.capacity,
    })),
    maintenanceRequests: s.maintenanceRequests.map((r) => ({
      id: r.id,
      department: r.department,
      assetId: r.assetId,
      assetCriticality: assetById.get(r.assetId)!.criticality,
      corridorId: r.corridorId,
      segmentId: r.segmentId,
      workType: r.workType,
      criticality: r.criticality,
      urgency: r.urgency,
      dueDate: r.dueDate,
      estimatedDurationMinutes: r.estimatedDurationMinutes,
      requiredIsolation: r.requiredIsolation,
      requiredPower: r.requiredPower,
      requiredResources: r.requiredResources.map((rr) => ({ resourceId: rr.trackResourceId, quantity: rr.quantity })),
      status: r.status,
    })),
    requestDependencies: s.requestDependencies,
    taskCompatibilityRules: s.taskCompatibilityRules.map((r) => ({
      workTypeA: r.workTypeA,
      workTypeB: r.workTypeB,
      department: r.department,
      compatible: r.compatible,
    })),
    blockWindows: s.blockWindows.map((w) => ({
      id: w.id,
      corridorId: w.corridorId,
      segmentId: w.segmentId,
      startTime: w.startTime,
      endTime: w.endTime,
      durationMinutes: w.durationMinutes,
      permittedDepartments: w.permittedDepartments,
      allowsIsolationTypes: w.allowsIsolationTypes,
      allowsPowerTypes: w.allowsPowerTypes,
      maxConcurrentResources: w.maxConcurrentResources,
    })),
    trainMovements: s.trainMovements,
    options: {
      timeLimitSeconds: 20,
      randomSeed: seed,
      asOf: s.scenario.generatedAt,
    },
  };
}

const seed = process.argv[2] ? Number(process.argv[2]) : 42;
const input = buildOptimizerInput(seed);
const outPath = join(__dirname, "..", "optimizer", `scenario-seed-${seed}.json`);
writeFileSync(outPath, JSON.stringify(input, null, 2));
// eslint-disable-next-line no-console
console.log(`Wrote ${outPath} (${input.maintenanceRequests.length} maintenance requests, ${input.blockWindows.length} block windows)`);
