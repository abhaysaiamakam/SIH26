// Maintenance demand generation. Two phases, deliberately kept separate:
//
//   1. Baseline demand - one plausible maintenance request per asset (most
//      assets get one, a few get none, a few get two), driven by the seed.
//   2. Engineered scenarios - explicit, always-present requests/pairs that
//      exercise every mechanism the optimizer must handle: an overdue
//      critical task, dependency chains, cross-department bundling
//      opportunities, incompatible-work pairs, and cross-corridor resource
//      conflicts. These are NOT left to chance - the brief is explicit that
//      "do not just generate random records" - so phase 2 always produces
//      them regardless of seed, while their exact asset/timing choices are
//      still seed-driven so different seeds still look different.
//
// `tags` on each request record which engineered scenario (if any) it
// demonstrates; tags are generator/test metadata only and are not persisted.

import { Department, IsolationType, PowerRequirement, WorkType } from "@railopt/contracts";
import { deterministicUuid } from "./ids";
import { SeededRng } from "./rng";
import {
  GenAsset,
  GenCorridor,
  GenCorridorSegment,
  GenMaintenanceRequest,
  GenRequestDependency,
  GenRequiredResource,
  GenTrackResource,
} from "./types";

const GENERATED_AT = new Date("2026-09-05T00:00:00.000Z");
function inDays(days: number): string {
  return new Date(GENERATED_AT.getTime() + days * 86_400_000).toISOString();
}

const DEPARTMENT_PREFIX: Record<Department, string> = {
  ENGINEERING: "ENG",
  TRD: "TRD",
  S_AND_T: "SNT",
};

const ASSET_TYPE_PROFILE: Record<
  string,
  { department: Department; workTypes: WorkType[] }
> = {
  RAIL: { department: "ENGINEERING", workTypes: ["TRACK_RENEWAL", "RAIL_GRINDING", "GENERAL_INSPECTION"] },
  BALLAST_BED: { department: "ENGINEERING", workTypes: ["BALLAST_CLEANING", "GENERAL_INSPECTION"] },
  POINTS_AND_CROSSING: { department: "ENGINEERING", workTypes: ["POINTS_CROSSING_MAINTENANCE", "GENERAL_INSPECTION"] },
  BRIDGE: { department: "ENGINEERING", workTypes: ["BRIDGE_INSPECTION", "GENERAL_INSPECTION"] },
  OHE_MAST: { department: "TRD", workTypes: ["OHE_MAINTENANCE", "GENERAL_INSPECTION"] },
  TRACTION_SUBSTATION: { department: "TRD", workTypes: ["TRACTION_SUBSTATION_MAINTENANCE", "GENERAL_INSPECTION"] },
  SIGNAL_INTERLOCKING: { department: "S_AND_T", workTypes: ["INTERLOCKING_UPGRADE", "SIGNAL_MAINTENANCE", "GENERAL_INSPECTION"] },
  TRACK_CIRCUIT: { department: "S_AND_T", workTypes: ["SIGNAL_MAINTENANCE", "GENERAL_INSPECTION"] },
};

const WORK_TYPE_DURATION_MINUTES: Record<WorkType, [number, number]> = {
  TRACK_RENEWAL: [240, 480],
  RAIL_GRINDING: [120, 240],
  BALLAST_CLEANING: [180, 360],
  POINTS_CROSSING_MAINTENANCE: [120, 240],
  BRIDGE_INSPECTION: [60, 180],
  SIGNAL_MAINTENANCE: [90, 180],
  INTERLOCKING_UPGRADE: [180, 360],
  OHE_MAINTENANCE: [120, 240],
  TRACTION_SUBSTATION_MAINTENANCE: [120, 300],
  GENERAL_INSPECTION: [60, 120],
};

const WORK_TYPE_REQUIREMENTS: Record<WorkType, { isolation: IsolationType; power: PowerRequirement }> = {
  TRACK_RENEWAL: { isolation: "TRACK_ISOLATION", power: "NONE" },
  RAIL_GRINDING: { isolation: "TRACK_ISOLATION", power: "NONE" },
  BALLAST_CLEANING: { isolation: "TRACK_ISOLATION", power: "NONE" },
  POINTS_CROSSING_MAINTENANCE: { isolation: "TRACK_ISOLATION", power: "NONE" },
  BRIDGE_INSPECTION: { isolation: "NONE", power: "NONE" },
  SIGNAL_MAINTENANCE: { isolation: "SIGNAL_ISOLATION", power: "LOW_VOLTAGE" },
  INTERLOCKING_UPGRADE: { isolation: "SIGNAL_ISOLATION", power: "LOW_VOLTAGE" },
  OHE_MAINTENANCE: { isolation: "POWER_ISOLATION", power: "TRACTION_POWER_OFF" },
  TRACTION_SUBSTATION_MAINTENANCE: { isolation: "POWER_ISOLATION", power: "TRACTION_POWER_OFF" },
  GENERAL_INSPECTION: { isolation: "NONE", power: "NONE" },
};

interface BuildContext {
  seed: number;
  rng: SeededRng;
  corridors: GenCorridor[];
  segments: GenCorridorSegment[];
  assets: GenAsset[];
  resources: GenTrackResource[];
  requests: GenMaintenanceRequest[];
  dependencies: GenRequestDependency[];
  seqByPrefix: Map<string, number>;
}

function nextRequestNumber(ctx: BuildContext, department: Department, corridorCode: string): string {
  const key = `${DEPARTMENT_PREFIX[department]}-${corridorCode}`;
  const seq = (ctx.seqByPrefix.get(key) ?? 0) + 1;
  ctx.seqByPrefix.set(key, seq);
  return `${key}-${String(seq).padStart(3, "0")}`;
}

function requiredResourcesFor(ctx: BuildContext, corridor: GenCorridor, workType: WorkType): GenRequiredResource[] {
  const corridorResource = (suffix: string) =>
    ctx.resources.find((r) => r.corridorId === corridor.id && r.code.endsWith(suffix));
  const globalResource = (code: string) => ctx.resources.find((r) => r.corridorId === null && r.code === code);

  const result: GenRequiredResource[] = [];
  switch (workType) {
    case "TRACK_RENEWAL":
      if (corridorResource("ENG-CREW")) result.push({ trackResourceId: corridorResource("ENG-CREW")!.id, quantity: 1 });
      if (globalResource("TM-1")) result.push({ trackResourceId: globalResource("TM-1")!.id, quantity: 1 });
      break;
    case "RAIL_GRINDING":
      if (corridorResource("ENG-CREW")) result.push({ trackResourceId: corridorResource("ENG-CREW")!.id, quantity: 1 });
      if (globalResource("RGM-1")) result.push({ trackResourceId: globalResource("RGM-1")!.id, quantity: 1 });
      break;
    case "BALLAST_CLEANING":
      if (corridorResource("ENG-CREW")) result.push({ trackResourceId: corridorResource("ENG-CREW")!.id, quantity: 1 });
      if (globalResource("BCM-1")) result.push({ trackResourceId: globalResource("BCM-1")!.id, quantity: 1 });
      break;
    case "POINTS_CROSSING_MAINTENANCE":
      if (corridorResource("ENG-CREW")) result.push({ trackResourceId: corridorResource("ENG-CREW")!.id, quantity: 1 });
      break;
    case "BRIDGE_INSPECTION":
      if (corridorResource("ENG-CREW")) result.push({ trackResourceId: corridorResource("ENG-CREW")!.id, quantity: 1 });
      if (globalResource("TOOL-UST-KIT")) result.push({ trackResourceId: globalResource("TOOL-UST-KIT")!.id, quantity: 1 });
      break;
    case "SIGNAL_MAINTENANCE":
    case "INTERLOCKING_UPGRADE":
      if (corridorResource("SNT-CREW")) result.push({ trackResourceId: corridorResource("SNT-CREW")!.id, quantity: 1 });
      break;
    case "OHE_MAINTENANCE":
    case "TRACTION_SUBSTATION_MAINTENANCE":
      if (corridorResource("TRD-CREW")) result.push({ trackResourceId: corridorResource("TRD-CREW")!.id, quantity: 1 });
      break;
    case "GENERAL_INSPECTION":
      if (globalResource("TOOL-UST-KIT")) result.push({ trackResourceId: globalResource("TOOL-UST-KIT")!.id, quantity: 1 });
      break;
  }
  return result;
}

function makeRequest(
  ctx: BuildContext,
  params: {
    asset: GenAsset;
    department: Department;
    workType: WorkType;
    dueInDays: number;
    criticality?: GenMaintenanceRequest["criticality"];
    urgency?: GenMaintenanceRequest["urgency"];
    tags?: string[];
  },
): GenMaintenanceRequest {
  const corridor = ctx.corridors.find((c) => c.id === params.asset.corridorId)!;
  const [minDur, maxDur] = WORK_TYPE_DURATION_MINUTES[params.workType];
  const req = WORK_TYPE_REQUIREMENTS[params.workType];

  const request: GenMaintenanceRequest = {
    id: deterministicUuid(ctx.seed, "maintenance", `${corridor.code}-${ctx.requests.length + 1}`),
    requestNumber: nextRequestNumber(ctx, params.department, corridor.code),
    department: params.department,
    assetId: params.asset.id,
    corridorId: corridor.id,
    segmentId: params.asset.segmentId,
    workType: params.workType,
    description: `${params.workType.replace(/_/g, " ").toLowerCase()} for ${params.asset.name}`,
    criticality: params.criticality ?? params.asset.criticality,
    urgency: params.urgency ?? params.asset.criticality,
    dueDate: inDays(params.dueInDays),
    estimatedDurationMinutes: ctx.rng.int(minDur, maxDur),
    requiredIsolation: req.isolation,
    requiredPower: req.power,
    status: ctx.rng.chance(0.2) ? "VERIFIED" : "OPEN",
    requiredResources: requiredResourcesFor(ctx, corridor, params.workType),
    tags: params.tags ?? [],
  };
  ctx.requests.push(request);
  return request;
}

function findAssetByType(assets: GenAsset[], corridorId: string, assetType: string, exclude: Set<string>): GenAsset | null {
  return assets.find((a) => a.corridorId === corridorId && a.assetType === assetType && !exclude.has(a.id)) ?? null;
}

export function buildMaintenanceDemand(
  seed: number,
  corridors: GenCorridor[],
  segments: GenCorridorSegment[],
  assets: GenAsset[],
  resources: GenTrackResource[],
): { requests: GenMaintenanceRequest[]; dependencies: GenRequestDependency[] } {
  const ctx: BuildContext = {
    seed,
    rng: new SeededRng(seed + 2002),
    corridors,
    segments,
    assets,
    resources,
    requests: [],
    dependencies: [],
    seqByPrefix: new Map(),
  };
  const usedAssets = new Set<string>();

  // ── Phase 1: baseline demand, ~1 request per asset ──────────────────
  for (const asset of assets) {
    const profile = ASSET_TYPE_PROFILE[asset.assetType];
    if (!profile) continue;
    if (!ctx.rng.chance(0.85)) continue; // some assets have no outstanding work this cycle

    const workType = ctx.rng.pick(profile.workTypes);
    const dueInDays = ctx.rng.int(-5, 30); // mix of overdue and upcoming
    makeRequest(ctx, { asset, department: profile.department, workType, dueInDays });
    usedAssets.add(asset.id);
  }

  // ── Phase 2: engineered scenarios (always present) ──────────────────

  // 2a. Overdue critical work: two CRITICAL assets with a materially
  // overdue due date and CRITICAL urgency.
  const criticalAssets = ctx.rng.shuffle(assets.filter((a) => a.criticality === "CRITICAL"));
  for (const asset of criticalAssets.slice(0, 2)) {
    const profile = ASSET_TYPE_PROFILE[asset.assetType];
    if (!profile) continue;
    makeRequest(ctx, {
      asset,
      department: profile.department,
      workType: profile.workTypes[0],
      dueInDays: -ctx.rng.int(4, 12),
      criticality: "CRITICAL",
      urgency: "CRITICAL",
      tags: ["overdue_critical"],
    });
  }

  // 2b. Dependency chains: inspection must precede repair, on the same asset.
  const dependencyCorridors = [corridors[0], corridors[2]];
  for (const corridor of dependencyCorridors) {
    const asset =
      findAssetByType(assets, corridor.id, "BRIDGE", usedAssets) ??
      findAssetByType(assets, corridor.id, "RAIL", usedAssets) ??
      assets.find((a) => a.corridorId === corridor.id);
    if (!asset) continue;
    const profile = ASSET_TYPE_PROFILE[asset.assetType];
    if (!profile) continue;
    const repairWorkType = profile.workTypes.find((w) => w !== "GENERAL_INSPECTION") ?? profile.workTypes[0];

    const inspection = makeRequest(ctx, {
      asset,
      department: profile.department,
      workType: "GENERAL_INSPECTION",
      dueInDays: ctx.rng.int(1, 4),
      criticality: asset.criticality,
      urgency: "HIGH",
      tags: ["dependency_chain", "dependency_predecessor"],
    });
    const repair = makeRequest(ctx, {
      asset,
      department: profile.department,
      workType: repairWorkType,
      dueInDays: ctx.rng.int(8, 15),
      criticality: asset.criticality,
      urgency: "HIGH",
      tags: ["dependency_chain", "dependency_successor"],
    });
    ctx.dependencies.push({ predecessorId: inspection.id, successorId: repair.id });
  }

  // 2c. Cross-department bundling opportunities: pairs whose work types are
  // in packages/config's crossDepartmentAllowList, same corridor/segment,
  // aligned due dates so they land in the same feasible window later.
  const bundlePlan: { corridorIndex: number; a: [Department, WorkType]; b: [Department, WorkType] }[] = [
    { corridorIndex: 0, a: ["ENGINEERING", "TRACK_RENEWAL"], b: ["TRD", "OHE_MAINTENANCE"] },
    { corridorIndex: 2, a: ["ENGINEERING", "POINTS_CROSSING_MAINTENANCE"], b: ["S_AND_T", "INTERLOCKING_UPGRADE"] },
    { corridorIndex: 4, a: ["ENGINEERING", "GENERAL_INSPECTION"], b: ["TRD", "OHE_MAINTENANCE"] },
  ];
  for (const plan of bundlePlan) {
    const corridor = corridors[plan.corridorIndex];
    const dueInDays = ctx.rng.int(5, 12);
    const [deptA, workA] = plan.a;
    const [deptB, workB] = plan.b;
    const assetA = assets.find((a) => a.corridorId === corridor.id && ASSET_TYPE_PROFILE[a.assetType]?.department === deptA);
    const assetB = assets.find((a) => a.corridorId === corridor.id && ASSET_TYPE_PROFILE[a.assetType]?.department === deptB);
    if (assetA) {
      makeRequest(ctx, { asset: assetA, department: deptA, workType: workA, dueInDays, tags: ["bundle_opportunity"] });
    }
    if (assetB) {
      makeRequest(ctx, {
        asset: assetB.corridorId === assetA?.corridorId ? assetB : { ...assetB, segmentId: assetA?.segmentId ?? assetB.segmentId },
        department: deptB,
        workType: workB,
        dueInDays,
        tags: ["bundle_opportunity"],
      });
    }
  }

  // 2d. Incompatible pairs: same corridor/segment, overlapping due window,
  // work types that packages/config marks incompatible.
  const incompatiblePlan: { corridorIndex: number; a: WorkType; b: WorkType }[] = [
    { corridorIndex: 1, a: "BALLAST_CLEANING", b: "TRACK_RENEWAL" }, // same-department incompatible
    { corridorIndex: 5, a: "BRIDGE_INSPECTION", b: "BALLAST_CLEANING" }, // hard incompatible
  ];
  for (const plan of incompatiblePlan) {
    const corridor = corridors[plan.corridorIndex];
    const dueInDays = ctx.rng.int(6, 14);
    const assetA = assets.find((a) => a.corridorId === corridor.id && ASSET_TYPE_PROFILE[a.assetType]?.workTypes.includes(plan.a));
    const assetB = assets.find(
      (a) => a.corridorId === corridor.id && a.id !== assetA?.id && ASSET_TYPE_PROFILE[a.assetType]?.workTypes.includes(plan.b),
    );
    if (assetA) {
      makeRequest(ctx, { asset: assetA, department: "ENGINEERING", workType: plan.a, dueInDays, tags: ["incompatible_pair"] });
    }
    if (assetB) {
      makeRequest(ctx, {
        asset: assetA ? { ...assetB, segmentId: assetA.segmentId } : assetB,
        department: "ENGINEERING",
        workType: plan.b,
        dueInDays,
        tags: ["incompatible_pair"],
      });
    }
  }

  // 2e. Cross-corridor resource conflicts: two requests on different
  // corridors both requiring the same scarce global machine, overlapping
  // due windows so their feasible candidate windows are likely to overlap.
  const scarceMachineCodes = ["RGM-1", "BCM-1"];
  const conflictWorkTypeByMachine: Record<string, WorkType> = { "RGM-1": "RAIL_GRINDING", "BCM-1": "BALLAST_CLEANING" };
  for (const machineCode of scarceMachineCodes) {
    const workType = conflictWorkTypeByMachine[machineCode];
    const candidateCorridors = corridors.filter((_, idx) => idx % 2 === (machineCode === "RGM-1" ? 0 : 1));
    const dueInDays = ctx.rng.int(6, 10);
    const picked = candidateCorridors.slice(0, 2);
    for (const corridor of picked) {
      const asset = assets.find((a) => a.corridorId === corridor.id && ASSET_TYPE_PROFILE[a.assetType]?.workTypes.includes(workType));
      if (asset) {
        makeRequest(ctx, {
          asset,
          department: "ENGINEERING",
          workType,
          dueInDays,
          tags: ["resource_conflict", `resource_conflict_${machineCode}`],
        });
      }
    }
  }

  return { requests: ctx.requests, dependencies: ctx.dependencies };
}
