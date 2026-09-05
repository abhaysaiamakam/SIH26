// Deterministic synthetic railway scenario generator - the single entry
// point used by the Prisma seed script (apps/api/prisma/seed.ts) and by
// the determinism/edge-case tests in tests/generator.spec.ts.
//
// Same seed -> byte-identical output. Different seed -> different output.
// See docs/PROJECT_SPEC.md for the required scale and the engineered
// scenarios this generator guarantees regardless of seed.

import { deterministicUuid } from "./ids";
import { buildNetwork } from "./network";
import { buildTrackResources } from "./resources";
import { buildAssets } from "./assets";
import { buildMaintenanceDemand } from "./maintenance";
import { buildTaskCompatibilityRules } from "./compatibilityRules";
import { buildBlockWindows } from "./blockWindows";
import { buildTrainMovements } from "./trainMovements";
import { buildScenarioEvents } from "./scenarioEvents";
import { GeneratedScenario } from "./types";

const CONFIG_VERSION = "v1";
const GENERATED_AT = "2026-09-05T00:00:00.000Z";

export function generateScenario(seed: number): GeneratedScenario {
  const network = buildNetwork(seed);
  const trackResources = buildTrackResources(seed, network.corridors);
  const assets = buildAssets(seed, network.corridors, network.segments);
  const { requests: maintenanceRequests, dependencies: requestDependencies } = buildMaintenanceDemand(
    seed,
    network.corridors,
    network.segments,
    assets,
    trackResources,
  );
  const taskCompatibilityRules = buildTaskCompatibilityRules();
  const blockWindows = buildBlockWindows(seed, network.corridors);
  const trainMovements = buildTrainMovements(seed, network.corridors, blockWindows);
  const scenarioEvents = buildScenarioEvents(seed, network.corridors);

  return {
    scenario: {
      id: deterministicUuid(seed, "scenario", "root"),
      name: `RAILOPT Synthetic Scenario (seed ${seed})`,
      seed,
      description:
        "Synthetic demonstration scenario for RAILOPT AI (SIH26027). All stations, corridors, assets, and traffic are fictitious.",
      configVersion: CONFIG_VERSION,
      generatedAt: GENERATED_AT,
    },
    divisions: network.divisions,
    stations: network.stations,
    corridors: network.corridors,
    segments: network.segments,
    trackResources,
    assets,
    maintenanceRequests,
    requestDependencies,
    taskCompatibilityRules,
    blockWindows,
    trainMovements,
    scenarioEvents,
  };
}

export * from "./types";

if (require.main === module) {
  const seedArg = process.argv[2];
  const seed = seedArg ? Number(seedArg) : 42;
  const scenario = generateScenario(seed);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(scenario, null, 2));
}
